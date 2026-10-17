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
  const { article, authorName, content } = req.body;
  if (typeof content !== "string" || !content.trim() || content.length > 2000)
    return res
      .status(400)
      .json({ message: "יש להזין תגובה באורך עד 2,000 תווים" });
  if (!(await Article.exists({ _id: article, ...PUBLIC_FILTER })))
    return res.status(404).json({ message: "כתבה לא נמצאה" });
  if (!(await reserve(`comments:${req.deviceId}`, 3, 60000))) {
    res.set("Retry-After", "60");
    return res
      .status(429)
      .json({ message: "ניתן לפרסם עד 3 תגובות בדקה. נסו שוב בעוד דקה." });
  }
  const comment = await Comment.create({
    article,
    content: content.trim(),
    authorName:
      typeof authorName === "string" && authorName.trim()
        ? authorName.trim().slice(0, 80)
        : "אורח",
    ipAddress: req.ip,
  });
  res.status(201).json({ comment: publicComment(comment) });
};
exports.getCommentsByArticle = async (req, res) => {
  if (!(await Article.exists({ _id: req.params.articleId, ...PUBLIC_FILTER })))
    return res.status(404).json({ message: "כתבה לא נמצאה" });
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const comments = await Comment.find({ article: req.params.articleId })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * 20)
    .limit(21);
  res.json({
    comments: comments.slice(0, 20).map(publicComment),
    hasMore: comments.length > 20,
  });
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
