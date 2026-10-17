const Article = require('../models/Article');
const logger = require('../utils/logger');
const { PUBLIC_FILTER, toPublicArticle } = require('../utils/publicArticle');

// Create a new article (CRUD: Create)
exports.createArticle = async (req, res) => {
    try {
        const { title, reporter, category, mainImage, content } = req.body;

        // Create a new Article instance
        const newArticle = new Article({
            title: title,
            reporter: reporter,
            category: category,
            mainImage: mainImage,
            content: content,
            status: 'Draft' // New articles always start as draft
        });

        // Save the article to the database
        const savedArticle = await newArticle.save();

        res.status(201).json({
            message: 'Article created successfully as a draft',
            article: savedArticle
        });

    } catch (error) {
        // Record the error in the logs/errors.log file
        logger.logError('Error creating article', error);

        res.status(500).json({ 
            message: 'Error creating article', 
            error: error.message 
        });
    }
};

// Get all articles (CRUD: Read)
exports.getArticles = async (req, res) => {
    try {
        // Fetch all articles from the database
        const articles = await Article.find();

        // Send successful response with the articles array
        res.status(200).json({
            message: 'Articles fetched successfully',
            count: articles.length,
            articles: articles
        });
    } catch (error) {
        logger.logError('Error fetching articles', error);

        // Handle errors without crashing the server
        res.status(500).json({ 
            message: 'Error fetching articles', 
            error: error.message 
        });
    }
};

// Update an existing article (CRUD: Update)
exports.updateArticle = async (req, res) => {
    try {
        // Extract the article ID from the URL parameters
        const articleId = req.params.id;
        const updateData = req.body;

        // Find the article by ID and update it with the new data
        const updatedArticle = await Article.findByIdAndUpdate(
            articleId,
            updateData,
            { new: true, runValidators: true }
        );

        // If no article matches the given ID
        if (!updatedArticle) {
            return res.status(404).json({ message: 'Article not found' });
        }

        res.status(200).json({
            message: 'Article updated successfully',
            article: updatedArticle
        });
    } catch (error) {
        logger.logError('Error updating article', error);

        res.status(500).json({ 
            message: 'Error updating article', 
            error: error.message 
        });
    }
};

// Delete an article (CRUD: Delete)
exports.deleteArticle = async (req, res) => {
    try {
        // Extract the article ID from the URL parameters
        const articleId = req.params.id;

        // Find the article by ID and delete it from the database
        const deletedArticle = await Article.findByIdAndDelete(articleId);

        // If no article matches the given ID
        if (!deletedArticle) {
            return res.status(404).json({ message: 'Article not found' });
        }

        res.status(200).json({
            message: 'Article deleted successfully',
            deletedArticleId: deletedArticle._id
        });
    } catch (error) {
        logger.logError('Error deleting article', error);

        res.status(500).json({ 
            message: 'Error deleting article', 
            error: error.message 
        });
    }
};

// Approve and publish an article (Editor action)
exports.publishArticle = async (req, res) => {
    try {
        const articleId = req.params.id;
        const article = await Article.findById(articleId);

        if (!article) {
            return res.status(404).json({ message: 'Article not found' });
        }

        // Copy the current working draft into the publishedVersion object
        article.publishedVersion = {
            title: article.title,
            category: article.category,
            mainImage: article.mainImage,
            content: article.content,
            publishedAt: new Date()
        };
        
        // Update the status to 'Published'
        article.status = 'Published';
        
        const savedArticle = await article.save();

        res.status(200).json({
            message: 'Article published successfully',
            article: savedArticle
        });
    } catch (error) {
        logger.logError('Error publishing article', error);

        res.status(500).json({ 
            message: 'Error publishing article', 
            error: error.message 
        });
    }
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