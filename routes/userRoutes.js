const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Route to handle POST requests for creating a new user
router.post('/create', userController.createUser);

// Export the router to be used in the main app file
module.exports = router;