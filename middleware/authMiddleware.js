const jwt = require('jsonwebtoken');

const JWT_SECRET = 'TheDailyWeb_SecretKey_2026';

// Middleware to verify if the user is logged in
exports.verifyToken = (req, res, next) => {
    // 1. Get the token from the cookies
    const token = req.cookies.token;

    // 2. If there is no token, deny access
    if (!token) {
        return res.status(401).json({ message: 'Access denied. Please log in.' });
    }

    try {
        // 3. Verify the token using our secret key
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 4. Attach the decoded user data (userId, role) to the request object
        req.user = decoded;
        
        // 5. Move to the next function (the Controller)
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

// Middleware to restrict access to Editors only
exports.requireEditor = (req, res, next) => {
    if (req.user && req.user.role === 'Editor') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Editors only.' });
    }
};

// Middleware to restrict access to Reporters or Editors
exports.requireStaff = (req, res, next) => {
    if (req.user && (req.user.role === 'Reporter' || req.user.role === 'Editor')) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Staff only.' });
    }
};