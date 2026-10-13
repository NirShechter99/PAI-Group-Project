const mongoose = require('mongoose');
// Drafts may be incomplete (auto-save stores work in progress).
// Full validation applies once the article is sent to the editor.
const requiredUnlessDraft = function () {
    return !['Draft', 'Returned'].includes(this.status);
};

// Define the schema for the Article model
const articleSchema = new mongoose.Schema({
    // --- Work-in-Progress Fields (Reporter's Draft) ---
    title: {
        type: String,
        required: requiredUnlessDraft
    },
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: requiredUnlessDraft
    },
    mainImage: {
        type: String,
        required: requiredUnlessDraft
    },
    content: {
        type: String,
        required: requiredUnlessDraft
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