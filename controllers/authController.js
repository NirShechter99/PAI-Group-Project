const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = 'TheDailyWeb_SecretKey_2026';

// Login a user and create a session
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Check if user exists
        const user = await User.findOne({ username: username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // 2. Compare the provided password with the hashed password in DB
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // 3. Generate a JWT token including the user's ID and Role
        const token = jwt.sign(
            { userId: user._id, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '24h' } // Token expires in 24 hours
        );

        // 4. Send the token in an HTTP-only Cookie
        res.cookie('token', token, {
            httpOnly: true, // Prevents client-side JS from reading the cookie (XSS protection)
            maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
        });

        res.status(200).json({
            message: 'Logged in successfully',
            user: {
                id: user._id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        logger.logError('Error during user login', error);

        res.status(500).json({ 
            message: 'Error during login', 
            error: error.message 
        });
    }
};

// Logout a user by clearing the cookie
exports.logout = async (req, res) => {
    try {
        res.clearCookie('token');
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        logger.logError('Error during user logout', error);
        res.status(500).json({ message: 'Error during logout', error: error.message });
    }
};