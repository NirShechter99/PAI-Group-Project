const Article = require("../models/Article");
const User = require("../models/User");
const service = require("../services/articles");
exports.createArticle = async (req, res) => {
  const reporter =
    req.user.role === "Reporter" ? req.user.userId : req.body.reporter;
  if (!(await User.exists({ _id: reporter, role: "Reporter" })))
    return res.status(400).json({ message: "יש לבחור כתב" });
  const article = new Article({ reporter, status: "Draft" });
  service.applyValues(article, req.body);
  await article.save();
  res.status(201).json({ article });
};
exports.getArticles = async (req, res) => {
  const filter =
    req.user.role === "Reporter" ? { reporter: req.user.userId } : {};
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const articles = await Article.find(filter)
    .sort({ updatedAt: -1 })
    .skip((page - 1) * 20)
    .limit(20);
  res.json({ articles });
};
exports.updateArticle = async (req, res) => {
  const filter = { _id: req.params.id };
  if (req.user.role === "Reporter") filter.reporter = req.user.userId;
  const article = await Article.findOne(filter);
  if (!article) return res.status(404).json({ message: "כתבה לא נמצאה" });
  if (req.user.role === "Reporter" && article.status === "Pending")
    return res.status(409).json({ message: "הכתבה נמצאת בבדיקת עורך" });
  if (article.status === "Published") article.status = "Draft";
  service.applyValues(article, req.body);
  article.draftClock = (article.draftClock || 0) + 1;
  await article.save();
  res.json({ article });
};
exports.publishArticle = async (req, res) => {
  const article = await Article.findById(req.params.id);
  if (!article) return res.status(404).json({ message: "כתבה לא נמצאה" });
  res.json({ article: await service.publish(article) });
};
exports.deleteArticle = async (req, res) => {
  await service.remove(req.params.id);
  res.json({ ok: true });
};

// Get only published articles for the public homepage with search, filter, sort, and pagination
exports.getPublicArticles = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        // מתחילים עם הפילטר הקבוצתי המוגדר מראש (Published)
        let query = { ...PUBLIC_FILTER };

        // 1. חיפוש טקסטואלי (כותרת או תוכן)
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            query.$or = [
                { title: searchRegex },
                { content: searchRegex },
                { 'publishedVersion.title': searchRegex },
                { 'publishedVersion.content': searchRegex }
            ];
        }

        // 2. סינון לפי קטגוריה
        if (req.query.category && req.query.category !== 'all') {
            query.$or = [
                { category: req.query.category },
                { 'publishedVersion.category': req.query.category }
            ];
        }

        // 3. הגדרת מיון (Sort)
        let sortOption = { 'publishedVersion.publishedAt': -1 }; // ברירת מחדל: חדש לישן
        if (req.query.sort === 'oldest') {
            sortOption = { 'publishedVersion.publishedAt': 1 };
        } else if (req.query.sort === 'popular') {
            sortOption = { views: -1 };
        }

        // שליפת הכתבות מהמסד לפי כל התנאים
        const articles = await Article.find(query)
            .populate('reporter', 'username')
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

        const totalArticles = await Article.countDocuments(query);

        res.status(200).json({
            message: 'Public articles fetched successfully',
            count: articles.length,
            total: totalArticles,
            currentPage: page,
            totalPages: Math.ceil(totalArticles / limit),
            articles: articles.map(toPublicArticle)
        });
    } catch (error) {
        logger.logError('Error fetching public articles with filters', error);
        
        res.status(500).json({ 
            message: 'Error fetching public articles', 
            error: error.message 
        });
    }
};
