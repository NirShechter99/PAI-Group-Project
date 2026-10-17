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
exports.getPublicArticles = async (req, res) =>
  res.json(await service.listPublic(req.query, req.deviceId));
