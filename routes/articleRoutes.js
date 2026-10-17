const router = require("express").Router();
const c = require("../controllers/articleController");
const a = require("../middleware/authMiddleware");
router.get("/public", c.getPublicArticles);
router.get("/view/:id", async (req, res) => {
  const Article = require("../models/Article");
  const { PUBLIC_FILTER, toPublicArticle } = require("../utils/publicArticle");
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
  await require("../services/articles").recordView(article._id, req.deviceId);
  res.render("article", { article: toPublicArticle(article) });
});
router.use(a.verifyToken, a.requireStaff);
router.get("/all", c.getArticles);
router.post("/create", c.createArticle);
router.put("/update/:id", c.updateArticle);
router.put("/publish/:id", a.requireEditor, c.publishArticle);
router.delete("/delete/:id", a.requireEditor, c.deleteArticle);
module.exports = router;
