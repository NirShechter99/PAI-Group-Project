const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { faker } = require('@faker-js/faker');

// Import all models
const User = require('../models/User');
const Article = require('../models/Article');
const Comment = require('../models/Comment');
const Analytics = require('../models/Analytics');

const MONGO_URI = 'mongodb+srv://nir:passwordtest123@cluster0.hwi3ljx.mongodb.net/?appName=Cluster0';

const seedDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB. Clearing old data...');

        // 1. Clear existing data to start fresh
        await User.deleteMany({});
        await Article.deleteMany({});
        await Comment.deleteMany({});
        await Analytics.deleteMany({});

        console.log('Creating users...');
        const hashedPassword = await bcrypt.hash('123456', 10);
        
        // Create 1 Editor
        const editor = await User.create({
            username: 'MainEditor',
            password: hashedPassword,
            role: 'Editor'
        });

        // Create 5 Reporters
        const reporters = [];
        for (let i = 0; i < 5; i++) {
            const reporter = await User.create({
                username: faker.internet.username(),
                password: hashedPassword,
                role: 'Reporter'
            });
            reporters.push(reporter);
        }

        console.log('Creating 500 articles with comments and analytics...');
        const categories = ['Technology', 'Sports', 'Politics', 'Economy', 'Entertainment'];
        const statuses = ['Draft', 'Pending', 'Published', 'Returned'];

        for (let i = 0; i < 500; i++) {
            const randomReporter = reporters[Math.floor(Math.random() * reporters.length)];
            const randomCategory = categories[Math.floor(Math.random() * categories.length)];
            // Bias the status to have more published articles (60% chance)
            const randomStatus = Math.random() > 0.4 ? 'Published' : statuses[Math.floor(Math.random() * statuses.length)];

            const articleData = {
                title: faker.lorem.sentence(),
                reporter: randomReporter._id,
                category: randomCategory,
                mainImage: faker.image.url(),
                content: faker.lorem.paragraphs(3),
                status: randomStatus
            };

            // If it's published or was edited after publishing, fill the publishedVersion
            if (randomStatus === 'Published' || randomStatus === 'Pending') {
                articleData.publishedVersion = {
                    title: articleData.title,
                    category: articleData.category,
                    mainImage: articleData.mainImage,
                    content: faker.lorem.paragraphs(2), // Simulate a slightly different older version
                    publishedAt: faker.date.recent({ days: 30 })
                };
            }

            // Add an editor note if it was returned
            if (randomStatus === 'Returned') {
                articleData.editorNote = 'Please fix the intro paragraph and add a better image.';
            }

            const article = await Article.create(articleData);

            // Generate Comments and Analytics ONLY for Published articles
            if (randomStatus === 'Published') {
                // Generate 2-5 comments per article
                const commentsCount = Math.floor(Math.random() * 4) + 2;
                for (let j = 0; j < commentsCount; j++) {
                    await Comment.create({
                        article: article._id,
                        authorName: faker.person.fullName(),
                        content: faker.lorem.sentence(),
                        ipAddress: faker.internet.ipv4()
                    });
                }

                // Generate Analytics (simulating views over the last 24 hours)
                const analyticsRecords = [];
                for (let h = 0; h < 24; h++) {
                    const timeWindow = new Date();
                    timeWindow.setHours(timeWindow.getHours() - h, 0, 0, 0);
                    
                    analyticsRecords.push({
                        article: article._id,
                        timeWindow: timeWindow,
                        views: Math.floor(Math.random() * 50) + 1
                    });
                }
                await Analytics.insertMany(analyticsRecords);
            }
        }

        console.log('Seed completed successfully! You now have 500 articles, users, comments, and analytics.');
        process.exit();
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
};

seedDatabase();