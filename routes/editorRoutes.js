const express = require('express');
const router = express.Router();
const editorController = require('../controllers/editorController');
const authMiddleware = require('../middleware/authMiddleware');

// כל הנתיבים כאן דורשים משתמש מחובר (verifyToken) עם הרשאת עורך בלבד (requireEditor)
router.use(authMiddleware.verifyToken, authMiddleware.requireEditor);

router.get('/articles', editorController.dashboard);
router.get('/articles/:id/review', editorController.reviewForm);
router.post('/articles/:id/approve', editorController.approve);
router.post('/articles/:id/return', editorController.returnToReporter);
router.post('/articles/:id/delete', editorController.remove);
router.get('/articles/:id/analytics', editorController.analyticsPage);

module.exports = router;