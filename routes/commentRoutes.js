const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');

// Route to handle POST requests for creating a new comment
router.post('/create', commentController.createComment);

// Route to handle GET requests for fetching comments by article ID
router.get('/article/:articleId', commentController.getCommentsByArticle);

// Route to update a comment
router.put('/update/:id', commentController.updateComment);

// Route to delete a comment
router.delete('/delete/:id', commentController.deleteComment);

module.exports = router;