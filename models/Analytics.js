const mongoose = require('mongoose');

// Define the schema for the Analytics model
const analyticsSchema = new mongoose.Schema({
    article: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Article',
        required: true
    },
    // The specific hour this record represents (e.g., 2026-09-26 14:00:00)
    timeWindow: {
        type: Date,
        required: true
    },
    views: {
        type: Number,
        default: 1
    }
});

// Compound index to ensure only one document exists per article per specific hour
analyticsSchema.index({ article: 1, timeWindow: 1 }, { unique: true });

module.exports = mongoose.model('Analytics', analyticsSchema);