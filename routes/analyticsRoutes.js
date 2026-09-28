const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Route to record a view (triggered when a user opens an article)
router.post('/record/:articleId', analyticsController.recordView);

// Route to fetch analytics data for the graph
router.get('/article/:articleId', analyticsController.getAnalyticsByArticle);

// Route to update an analytics record
router.put('/update/:id', analyticsController.updateAnalytics);

// Route to delete an analytics record
router.delete('/delete/:id', analyticsController.deleteAnalytics);

module.exports = router;