const Comment = require("../models/Comment");
const Article = require("../models/Article");
const reserve = require("../services/rateLimit");
const { PUBLIC_FILTER } = require("../utils/publicArticle");
const publicComment = (c) => ({
  _id: c._id,
  authorName: c.authorName,
  content: c.content,
  createdAt: c.createdAt,
});
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
exports.updateComment = async (req, res) => {
  if (
    typeof req.body.content !== "string" ||
    !req.body.content.trim() ||
    req.body.content.length > 2000
  )
    return res.status(400).json({ message: "תגובה לא תקינה" });
  const comment = await Comment.findByIdAndUpdate(
    req.params.id,
    { content: req.body.content.trim() },
    { returnDocument: "after", runValidators: true },
  );
  if (!comment) return res.status(404).json({ message: "הפריט לא נמצא" });
  res.json({ comment: publicComment(comment) });
};
exports.deleteComment = async (req, res) => {
  await Comment.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
};
