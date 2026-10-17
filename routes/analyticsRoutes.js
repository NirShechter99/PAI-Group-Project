const router = require("express").Router();
const c = require("../controllers/analyticsController");
const a = require("../middleware/authMiddleware");
router.use(a.verifyToken, a.requireEditor);
router.post("/record/:articleId", c.recordView);
router.get("/article/:articleId", c.getAnalyticsByArticle);
router.put("/update/:id", c.updateAnalytics);
router.delete("/delete/:id", c.deleteAnalytics);
module.exports = router;
