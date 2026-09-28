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

module.exports = router;