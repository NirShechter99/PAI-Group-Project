const Comment = require('../models/Comment');
const logger = require('../utils/logger');

// Create a new comment with anti-spam protection (Max 3 per minute per IP)
exports.createComment = async (req, res) => {
    try {
        // תמיכה בשני שמות השדה (article או articleId) למניעת שגיאות ולידציה
        const articleRef = req.body.article || req.body.articleId;
        const { authorName, content } = req.body;
        
        // Extract the user's IP address from the request
        const userIp = req.ip || req.connection.remoteAddress;

        // --- Anti-Spam Mechanism ---
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        
        const recentCommentsCount = await Comment.countDocuments({
            ipAddress: userIp,
            createdAt: { $gte: oneMinuteAgo }
        });

        if (recentCommentsCount >= 3) {
            return res.status(429).json({ 
                message: 'Spam protection: You can only post 3 comments per minute. Please wait.' 
            });
        }
        // ---------------------------

        const newComment = new Comment({
            article: articleRef,
            authorName: authorName && authorName.trim() ? authorName.trim() : 'Guest',
            content: content,
            ipAddress: userIp
        });

        const savedComment = await newComment.save();

        res.status(201).json({
            message: 'Comment added successfully',
            comment: savedComment
        });
    } catch (error) {
        logger.logError('Error creating comment', error);
        res.status(500).json({ 
            message: 'Error creating comment', 
            error: error.message 
        });
    }
};

// Get all comments for a specific article (CRUD: Read)
exports.getCommentsByArticle = async (req, res) => {
    try {
        const articleId = req.params.articleId;
        const comments = await Comment.find({ article: articleId }).sort({ createdAt: -1 });

        res.status(200).json({
            message: 'Comments fetched successfully',
            count: comments.length,
            comments: comments
        });
    } catch (error) {
        logger.logError('Error fetching comments by article', error);
        res.status(500).json({ 
            message: 'Error fetching comments', 
            error: error.message 
        });
    }
};

// Update an existing comment (CRUD: Update)
exports.updateComment = async (req, res) => {
    try {
        const updatedComment = await Comment.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!updatedComment) return res.status(404).json({ message: 'Comment not found' });
        res.status(200).json({ message: 'Comment updated', comment: updatedComment });
    } catch (error) {
        logger.logError('Error updating comment', error);
        res.status(500).json({ message: 'Error updating comment', error: error.message });
    }
};

// Delete a comment (CRUD: Delete)
exports.deleteComment = async (req, res) => {
    try {
        const deletedComment = await Comment.findByIdAndDelete(req.params.id);
        if (!deletedComment) return res.status(404).json({ message: 'Comment not found' });
        res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
        logger.logError('Error deleting comment', error);
        res.status(500).json({ message: 'Error deleting comment', error: error.message });
    }
};