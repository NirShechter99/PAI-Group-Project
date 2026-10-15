const mongoose = require('mongoose');
const Article = require('../models/Article');
const Analytics = require('../models/Analytics');
const logger = require('../utils/logger');

const STATUS_LABELS = {
    Draft: 'בהכנה',
    Pending: 'ממתינה לאישור עורך',
    Published: 'פורסמה',
    Returned: 'הוחזרה לתיקונים'
};

function wasPublished(article) {
    return Boolean(article.publishedVersion && article.publishedVersion.publishedAt);
}

// GET /editor/articles: לוח הבקרה הראשי של העורך
exports.dashboard = async (req, res) => {
    try {
        // מציג כתבות שממתינות לאישור או שפורסמו, מהחדש לישן
        const articles = await Article.find({ status: { \$in: ['Pending', 'Published', 'Returned'] } })
            .populate('reporter', 'username')
            .sort({ updatedAt: -1 });

        res.render('editor/dashboard', { articles, STATUS_LABELS, wasPublished });
    } catch (error) {
        logger.logError('Error loading editor dashboard', error);
        res.status(500).send('שגיאה בטעינת לוח הבקרה של העורך');
    }
};

// GET /editor/articles/:id/review: עמוד בדיקת כתבה והשוואת גרסאות (Diff)
exports.reviewForm = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('כתבה לא נמצאה');
        const article = await Article.findById(req.params.id).populate('reporter', 'username');
        if (!article) return res.status(404).send('כתבה לא נמצאה');

        res.render('editor/review', {
            article,
            STATUS_LABELS,
            hasPublishedVersion: wasPublished(article)
        });
    } catch (error) {
        logger.logError('Error loading article review page', error);
        res.status(500).send('שגיאה בטעינת עמוד הבדיקה');
    }
};

// POST /editor/articles/:id/approve: אישור כתבה ופרסומה
exports.approve = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('כתבה לא נמצאה');
        const article = await Article.findById(req.params.id);
        if (!article) return res.status(404).send('כתבה לא נמצאה');

        // העתקת הטיוטה הנוכחית לגרסה המפורסמת לציבור
        article.publishedVersion = {
            title: article.title,
            category: article.category,
            mainImage: article.mainImage,
            content: article.content,
            publishedAt: new Date()
        };
        article.status = 'Published';
        article.editorNote = ''; // איפוס הערות קודמות לאחר אישור

        await article.save();
        logger.logEvent(`Article ${article._id} approved and published by editor ${req.user.userId}`);
        res.redirect('/editor/articles');
    } catch (error) {
        logger.logError('Error approving article', error);
        res.status(500).send('שגיאה באישור הכתבה');
    }
};

// POST /editor/articles/:id/return: החזרת כתבה לכתב לתיקונים עם הערות
exports.returnToReporter = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('כתבה לא נמצאה');
        const article = await Article.findById(req.params.id);
        if (!article) return res.status(404).send('כתבה לא נמצאה');

        article.status = 'Returned';
        article.editorNote = String(req.body.editorNote || 'נא לבצע תיקונים ולשלוח שוב').slice(0, 1000);

        await article.save();
        logger.logEvent(`Article ${article._id} returned to reporter by editor ${req.user.userId}`);
        res.redirect('/editor/articles');
    } catch (error) {
        logger.logError('Error returning article to reporter', error);
        res.status(500).send('שגיאה בהחזרת הכתבה לכתב');
    }
};

// POST /editor/articles/:id/delete: מחיקת כתבה על ידי עורך
exports.remove = async (req, res) => {
    try {
        if (mongoose.isValidObjectId(req.params.id)) {
            await Article.findByIdAndDelete(req.params.id);
            await Analytics.deleteMany({ article: req.params.id });
            logger.logEvent(`Article ${req.params.id} deleted by editor ${req.user.userId}`);
        }
        res.redirect('/editor/articles');
    } catch (error) {
        logger.logError('Error deleting article by editor', error);
        res.status(500).send('שגיאה במחיקת הכתבה');
    }
};

// GET /editor/articles/:id/analytics: עמוד הסטטיסטיקות והגרף (Impact Analytics)
exports.analyticsPage = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('כתבה לא נמצאה');
        const article = await Article.findById(req.params.id).populate('reporter', 'username');
        if (!article) return res.status(404).send('כתבה לא נמצאה');

        const analyticsData = await Analytics.find({ article: article._id }).sort({ timeWindow: 1 });

        res.render('editor/analytics', {
            article,
            analyticsData
        });
    } catch (error) {
        logger.logError('Error loading article analytics page', error);
        res.status(500).send('שגיאה בטעינת עמוד הסטטיסטיקות');
    }
};