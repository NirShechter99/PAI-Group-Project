const Article = require("../models/Article");
const service = require("../services/articles");
const { PUBLIC_FILTER, toPublicArticle } = require("../utils/publicArticle");
exports.home = async (req, res) =>
  res.render("index", {
    feed: await service.listPublic(req.query, req.deviceId),
    filters: req.query,
  });
exports.article = async (req, res) => {
  const article = await Article.findOne({
    _id: req.params.id,
    ...PUBLIC_FILTER,
  }).populate("reporter", "username");
  if (!article)
    return res
      .status(404)
      .render("error", {
        title: "כתבה לא נמצאה",
        message: "הכתבה אינה זמינה לצפייה.",
      });
  await service.recordView(article._id, req.deviceId);
  res.render("article", { article: toPublicArticle(article) });
};
