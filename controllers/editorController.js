const Article = require("../models/Article");
const Analytics = require("../models/Analytics");
const service = require("../services/articles");
const logger = require("../utils/logger");
exports.dashboard = async (req, res) => {
  const filter = service.statuses[req.query.status]
    ? { status: req.query.status }
    : {};
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const [articles, total, pending] = await Promise.all([
    Article.find(filter)
      .populate("reporter", "username")
      .sort({ updatedAt: -1 })
      .skip((page - 1) * 20)
      .limit(20),
    Article.countDocuments(filter),
    Article.countDocuments({ status: "Pending" }),
  ]);
  res.render("editor/dashboard", {
    articles,
    total,
    pending,
    page,
    pages: Math.ceil(total / 20),
    selectedStatus: req.query.status || "",
  });
};
async function getArticle(req) {
  const article = await Article.findById(req.params.id).populate(
    "reporter",
    "username",
  );
  if (!article)
    throw Object.assign(new Error("Article not found"), { status: 404 });
  return article;
}
exports.reviewForm = async (req, res) =>
  res.render("editor/review", { article: await getArticle(req) });
exports.save = async (req, res) => {
  const article = await getArticle(req);
  if (article.status !== "Pending")
    return res
      .status(409)
      .json({ message: "ניתן לערוך כאן כתבה שממתינה לאישור" });
  service.applyValues(article, req.body);
  await article.save();
  res.redirect(`/editor/articles/${article._id}/review?saved=1`);
};
exports.approve = async (req, res) => {
  const article = await getArticle(req);
  await service.publish(article);
  logger.logEvent(`Article ${article._id} published by ${req.user.userId}`);
  res.redirect("/editor/articles");
};
exports.returnToReporter = async (req, res) => {
  const article = await getArticle(req);
  if (article.status !== "Pending")
    return res
      .status(409)
      .json({ message: "רק כתבה שממתינה לאישור יכולה לחזור לתיקונים" });
  const note =
    typeof req.body.editorNote === "string" ? req.body.editorNote.trim() : "";
  if (!note) return res.status(400).json({ message: "יש להזין הערה לכתב" });
  article.status = "Returned";
  article.editorNote = note.slice(0, 1000);
  await article.save();
  res.redirect("/editor/articles");
};
exports.remove = async (req, res) => {
  await service.remove(req.params.id);
  res.redirect("/editor/articles");
};
exports.analyticsPage = async (req, res) => {
  const article = await getArticle(req);
  const analyticsData = await Analytics.find({ article: article._id })
    .sort({ timeWindow: 1 })
    .lean();
  res.render("editor/analytics", { article, analyticsData });
};
