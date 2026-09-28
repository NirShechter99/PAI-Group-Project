const Analytics = require('../models/Analytics');
const logger = require('../utils/logger');

// Record a view for an article (Upsert - Create/Update)
exports.recordView = async (req, res) => {
    try {
        const articleId = req.params.articleId;

        // 1. Calculate the current time window (round down to the start of the current hour)
        const now = new Date();
        const timeWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);

        // 2. Find the record for this hour, increment views by 1, or create it if it doesn't exist
        const analyticsRecord = await Analytics.findOneAndUpdate(
            { article: articleId, timeWindow: timeWindow }, // Search condition
            { $inc: { views: 1 } },                         // Increment operation
            { new: true, upsert: true }                     // Return updated doc, create if missing
        );

        res.status(200).json({
            message: 'View recorded successfully',
            analytics: analyticsRecord
        });
    } catch (error) {
        logger.logError('Error recording analytics view', error);

        res.status(500).json({ 
            message: 'Error recording view', 
            error: error.message 
        });
    }
};

// Get analytics data for a specific article to draw the graph (Read)
exports.getAnalyticsByArticle = async (req, res) => {
    try {
        const articleId = req.params.articleId;

        // Fetch all time windows for this article, sorted chronologically (oldest to newest)
        const analyticsData = await Analytics.find({ article: articleId }).sort({ timeWindow: 1 });

        res.status(200).json({
            message: 'Analytics fetched successfully',
            count: analyticsData.length,
            data: analyticsData
        });
    } catch (error) {
        logger.logError('Error fetching analytics by article', error);

        res.status(500).json({ 
            message: 'Error fetching analytics', 
            error: error.message 
        });
    }
};

// Update an analytics record (CRUD: Update)
exports.updateAnalytics = async (req, res) => {
    try {
        const updatedRecord = await Analytics.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedRecord) return res.status(404).json({ message: 'Record not found' });
        res.status(200).json({ message: 'Record updated', record: updatedRecord });
    } catch (error) {
        logger.logError('Error updating analytics record', error);
        res.status(500).json({ message: 'Error updating record', error: error.message });
    }
};

// Delete an analytics record (CRUD: Delete)
exports.deleteAnalytics = async (req, res) => {
    try {
        const deletedRecord = await Analytics.findByIdAndDelete(req.params.id);
        if (!deletedRecord) return res.status(404).json({ message: 'Record not found' });
        res.status(200).json({ message: 'Record deleted successfully' });
    } catch (error) {
        logger.logError('Error deleting analytics record', error);
        res.status(500).json({ message: 'Error deleting record', error: error.message });
    }
};