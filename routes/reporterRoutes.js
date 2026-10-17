const express = require("express");
const router = express.Router();
const reporterController = require("../controllers/reporterController");
const authMiddleware = require("../middleware/authMiddleware");

// Every route in this file requires a logged in user (verifyToken) with the Reporter role (requireReporter)
router.use(authMiddleware.verifyToken, authMiddleware.requireReporter);

router.get("/articles", reporterController.list);
router.post("/articles/new", reporterController.create);
router.get("/articles/:id/edit", reporterController.editForm);
router.post("/articles/:id/save", reporterController.saveDraft);
router.post("/articles/:id/autosave", reporterController.autosave);
router.post("/articles/:id/submit", reporterController.submit);
router.post("/articles/:id/delete", reporterController.remove);

module.exports = router;
