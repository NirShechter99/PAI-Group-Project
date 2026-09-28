const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');

// Route to get weather data for the sidebar (Public)
router.get('/current', weatherController.getWeather);

module.exports = router;