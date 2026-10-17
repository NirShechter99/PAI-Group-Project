const router = require("express").Router();
const c = require("../controllers/userController");
const a = require("../middleware/authMiddleware");
router.use(a.verifyToken, a.requireEditor);
router.get("/", c.list);
router.post("/create", c.createUser);
router.put("/:id", c.update);
router.delete("/:id", c.remove);
module.exports = router;
