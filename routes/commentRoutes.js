const router = require("express").Router();
const c = require("../controllers/commentController");
const a = require("../middleware/authMiddleware");
router.get("/article/:articleId", c.getCommentsByArticle);
router.post("/create", c.createComment);
router.put("/update/:id", a.verifyToken, a.requireEditor, c.updateComment);
router.delete("/delete/:id", a.verifyToken, a.requireEditor, c.deleteComment);
module.exports = router;
