const Analytics = require("../models/Analytics");
const Article = require("../models/Article");
const { PUBLIC_FILTER } = require("../utils/publicArticle");
exports.recordView = async (req, res) => {
  if (!(await Article.exists({ _id: req.params.articleId, ...PUBLIC_FILTER })))
    return res.sendStatus(404);
  await require("../services/articles").recordView(
    req.params.articleId,
    req.deviceId,
  );
  res.json({ ok: true });
};
exports.getAnalyticsByArticle = async (req, res) => {
  const article = await Article.findById(req.params.articleId);
  if (!article) return res.sendStatus(404);
  res.json({
    data: await Analytics.find({ article: article._id }).sort({
      timeWindow: 1,
    }),
    publications: article.publicationHistory,
  });
};
exports.updateAnalytics = async (req, res) => {
  const views = req.body.views;
  if (!Number.isSafeInteger(views) || views < 0)
    return res.status(400).json({ message: "מספר צפיות לא תקין" });
  const old = await Analytics.findByIdAndUpdate(req.params.id, { views });
  if (!old) return res.sendStatus(404);
  await Article.updateOne(
    { _id: old.article },
    { $inc: { totalViews: views - old.views } },
  );
  res.json({ ok: true });
};
exports.deleteAnalytics = async (req, res) => {
  const old = await Analytics.findByIdAndDelete(req.params.id);
  if (!old) return res.sendStatus(404);
  await Article.updateOne(
    { _id: old.article },
    { $inc: { totalViews: -old.views } },
  );
  res.json({ ok: true });
};
