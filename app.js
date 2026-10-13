const logger = require('./utils/logger');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Import the user routes
const userRoutes = require('./routes/userRoutes');

// Register the user routes under the '/api/users' path
app.use('/api/users', userRoutes);

const articleRoutes = require('./routes/articleRoutes');
app.use('/api/articles', articleRoutes);

const commentRoutes = require('./routes/commentRoutes');
app.use('/api/comments', commentRoutes);

const analyticsRoutes = require('./routes/analyticsRoutes');
app.use('/api/analytics', analyticsRoutes);

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const weatherRoutes = require('./routes/weatherRoutes');
app.use('/api/weather', weatherRoutes);

const MONGO_URI = 'mongodb+srv://nir:passwordtest123@cluster0.hwi3ljx.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => {
        const msg = 'Connected to MongoDB successfully';
        console.log(msg);
        logger.logEvent(msg); // Log operational event
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        logger.logError('Failed to connect to MongoDB', err); // Log error
    });

    // ייבוא מודל הכתבות במידת הצורך עבור דף הבית
const Article = require('./models/Article');

// Route for the homepage news feed (Server-Side Rendering for SEO)
app.get('/', async (req, res) => {
    try {
        // שליפת 5 הכתבות הראשונות המפורסמות לצורך הצגה ראשונית בדף הבית
        const articles = await Article.find({ status: 'Published' })
            .sort({ 'publishedVersion.publishedAt': -1 })
            .limit(5);

        res.render('index', { articles });
    } catch (err) {
        console.error('Error loading homepage feed:', err);
        res.status(500).send('שגיאת שרת בטעינת הפיד');
    }
});

// Example of logging the server start
app.listen(3000, () => {
    const msg = 'Server is running on port 3000';
    console.log(msg);
    logger.logEvent(msg); // Log operational event
});