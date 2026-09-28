const mongoose = require('mongoose');

// Define the schema for the Article model
const articleSchema = new mongoose.Schema({
    // --- Work-in-Progress Fields (Reporter's Draft) ---
    title: {
        type: String,
        required: true
    },
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true
    },
    mainImage: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Draft', 'Pending', 'Published', 'Returned'],
        default: 'Draft'
    },
    editorNote: {
        type: String,
        default: ''
    },
    
    // --- Published Version Fields (Public Facing) ---
    // This object holds the snapshot of the last approved version.
    publishedVersion: {
        title: { type: String },
        category: { type: String },
        mainImage: { type: String },
        content: { type: String },
        publishedAt: { type: Date }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Article', articleSchema);