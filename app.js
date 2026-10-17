const logger = require('./utils/logger');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // נוסף לצורך יצירת סיסמאות מוצפנות למשתמשים

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static client files (e.g. public/js/autosave.js)
app.use(express.static('public'));

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

// Reporter work area (EJS pages)
const reporterRoutes = require('./routes/reporterRoutes');
app.use('/reporter', reporterRoutes);

// Editor work area & Login page (EJS pages)
const editorRoutes = require('./routes/editorRoutes');
app.use('/editor', editorRoutes);
app.get('/login', (req, res) => res.render('login'));

const MONGO_URI = 'mongodb+srv://nir:passwordtest123@cluster0.hwi3ljx.mongodb.net/?appName=Cluster0';

// ייבוא מודל המשתמש והכתבות
const User = require('./models/User');
const Article = require('./models/Article');
const { PUBLIC_FILTER, toPublicArticle } = require('./utils/publicArticle');

mongoose.connect(MONGO_URI)
    .then(async () => {
        const msg = 'Connected to MongoDB successfully';
        console.log(msg);
        logger.logEvent(msg); // Log operational event

        // יצירה אוטומטית של משתמשי בדיקה קבועים לנוחות ההתחברות למערכת
        try {
            const hashedPassword = await bcrypt.hash('123456', 10);
            
            // בדיקה ויצירה של עורך ראשי
            const editorExists = await User.findOne({ username: 'MainEditor' });
            if (!editorExists) {
                await User.create({
                    username: 'MainEditor',
                    password: hashedPassword,
                    role: 'Editor'
                });
                console.log('Default Editor created -> Username: MainEditor | Password: 123456');
            }

            // בדיקה ויצירה של כתב קבוע
            const reporterExists = await User.findOne({ username: 'reporter1' });
            if (!reporterExists) {
                await User.create({
                    username: 'reporter1',
                    password: hashedPassword,
                    role: 'Reporter'
                });
                console.log('Default Reporter created -> Username: reporter1 | Password: 123456');
            }
        } catch (err) {
            console.error('Error ensuring default users:', err);
        }
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        logger.logError('Failed to connect to MongoDB', err); // Log error
    });

// Route for the homepage news feed (Server-Side Rendering for SEO & Infinite Scroll)
app.get('/', async (req, res) => {
    try {
        // שליפת כל הכתבות המפורסמות לצורך תצוגה, סינון וגלילה אינסופית חלקה בדף הבית
        const articles = await Article.find(PUBLIC_FILTER)
            .populate('reporter', 'username')
            .sort({ 'publishedVersion.publishedAt': -1 });

        res.render('index', { articles: articles.map(toPublicArticle) });
    } catch (err) {
        console.error('Error loading homepage feed:', err);
        res.status(500).send('שגיאת שרת בטעינת הפיד');
    }
});

// Example of logging the server start
app.listen(PORT, () => {
    const msg = `Server is running on port ${PORT}`;
    console.log(msg);
    logger.logEvent(msg); // Log operational event
});
