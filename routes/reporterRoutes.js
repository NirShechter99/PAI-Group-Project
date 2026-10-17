const express = require('express');
const router = express.Router();
const reporterController = require('../controllers/reporterController');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');

// הגדרת אחסון קבצי תמונה בתיקייה הציבורית public/uploads
const upload = multer({ dest: 'public/uploads/' });

// Every route in this file requires a logged in user (verifyToken) with the Reporter role (requireReporter)
router.use(authMiddleware.verifyToken, authMiddleware.requireReporter);

router.get('/articles', reporterController.list);
router.get('/articles/new', reporterController.create);
router.get('/articles/:id/edit', reporterController.editForm);

// הוספת upload.single('mainImage') לקליטת קובץ התמונה מהמחשב בשמירה ובשליחה
router.post('/articles/:id/save', upload.single('mainImage'), reporterController.saveDraft);
router.post('/articles/:id/autosave', reporterController.autosave);
router.post('/articles/:id/submit', upload.single('mainImage'), reporterController.submit);
router.post('/articles/:id/delete', reporterController.remove);

module.exports = router;