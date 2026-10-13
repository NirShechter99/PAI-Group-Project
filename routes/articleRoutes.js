const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const authMiddleware = require('../middleware/authMiddleware'); // ייבוא מנגנון ההרשאות

// Route to handle POST requests for creating a new article (Protected: Logged in staff only)
router.post('/create', authMiddleware.verifyToken, authMiddleware.requireStaff, articleController.createArticle);

// Route to handle GET requests for fetching all articles (Public for now)
router.get('/all', articleController.getArticles);

// Route for homepage to get only published articles (Public)
router.get('/public', articleController.getPublicArticles);

// Route to handle PUT requests for updating an article by ID (Protected)
router.put('/update/:id', authMiddleware.verifyToken, authMiddleware.requireStaff, articleController.updateArticle);

// Route for editor to publish an article (Protected: Editor only)
router.put('/publish/:id', authMiddleware.verifyToken, authMiddleware.requireEditor, articleController.publishArticle);

// Route to handle DELETE requests for removing an article by ID (Protected: Editor only)
router.delete('/delete/:id', authMiddleware.verifyToken, authMiddleware.requireEditor, articleController.deleteArticle);

// Route to get a single article page rendered in EJS (Public)
router.get('/view/:id', async (req, res) => {
    try {
        // שליפת המודל הקיים מתוך Mongoose ישירות בלי טעינה כפולה של הקובץ
        const mongoose = require('mongoose');
        const Article = mongoose.model('Article');
        
        const { PUBLIC_FILTER, toPublicArticle } = require('../utils/publicArticle');

        // Only an approved article is public, and only its approved version is shown
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).send('הכתבה לא נמצאה');
        }
        const article = await Article.findOne({ _id: req.params.id, ...PUBLIC_FILTER })
            .populate('reporter', 'username');
                    
        if (!article) {
            return res.status(404).send('הכתבה לא נמצאה');
        }
        
        // רינדור קובץ ה-EJS שיצרנו בתיקיית views והעברת הנתונים
        res.render('article', { article: toPublicArticle(article) });
    } catch (err) {
        console.error(err);
        res.status(500).send('שגיאת שרת');
    }
});

module.exports = router;