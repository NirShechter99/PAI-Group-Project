const User = require('../models/User');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

// Create a new user (CRUD: Create)
exports.createUser = async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // Hash the password before saving for security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create a new User instance with the hashed password
        const newUser = new User({
            username: username,
            password: hashedPassword,
            role: role
        });

        // Save the user to the database
        const savedUser = await newUser.save();

        // Send success response without the password
        res.status(201).json({
            message: 'User created successfully',
            user: {
                _id: savedUser._id,
                username: savedUser.username,
                role: savedUser.role
            }
        });
    } catch (error) {
        logger.logError('Error creating user', error);

        // Handle errors without crashing the server
        res.status(500).json({ 
            message: 'Error creating user', 
            error: error.message 
        });
    }
};