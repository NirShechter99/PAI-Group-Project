const mongoose = require('mongoose');

// Define the schema for the User model
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Guest', 'Reporter', 'Editor'],
        default: 'Guest'
    }
}, { 
    // Automatically add createdAt and updatedAt fields
    timestamps: true 
});

// Compile and export the model
module.exports = mongoose.model('User', userSchema);