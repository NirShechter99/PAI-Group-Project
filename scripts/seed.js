const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Article = require("../models/Article");
const Comment = require("../models/Comment");
const Analytics = require("../models/Analytics");
const ReadingHistory = require("../models/ReadingHistory");
const RateLimit = require("../models/RateLimit");
// Deliberately deterministic content: the defense can repeat the same scenarios.
async function seedDatabase(password, { reset = false, count = 500 } = {}) {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    Buffer.byteLength(password) > 72
  )
    throw new Error(
      "DEMO_PASSWORD must have 10+ characters and at most 72 bytes",
    );
  if (!reset && (await User.exists({})))
    throw new Error(
      "Database is not empty. Explicit --reset is required to replace demo data.",
    );
  if (reset)
    for (const model of [
      User,
      Article,
      Comment,
      Analytics,
      ReadingHistory,
      RateLimit,
    ])
      await model.deleteMany({});
  const passwordHash = await bcrypt.hash(password, 10);
  const users = await User.insertMany([
    { username: "MainEditor", password: passwordHash, role: "Editor" },
    ...Array.from({ length: 5 }, (_, i) => ({
      username: `Reporter${i + 1}`,
      password: passwordHash,
      role: "Reporter",
    })),
  ]);
  const categories = [
    "Technology",
    "Sports",
    "Politics",
    "Economy",
    "Entertainment",
  ];
  const titles = [
    "הטכנולוגיה שמשנה את הדרך שבה אנחנו חיים",
    "הדור הבא של הספורט הישראלי",
    "הסיפורים שמאחורי ההחלטות הציבוריות",
    "עסקים מקומיים מסתכלים קדימה",
    "הקולות החדשים של התרבות הישראלית",
  ];
  const introductions = [
    "כלים חדשים, שאלות גדולות ואנשים שחושבים אחרת. יצאנו לבדוק איך נראית המציאות שמשתנה סביבנו.",
    "מעבר לתוצאות ולכותרות, יש כאן סיפור של התמדה, קהילה והזדמנות להתחלה חדשה.",
    "מה קורה כשעוצרים לרגע כדי להבין את התמונה המלאה? מבט על המהלכים שישפיעו על חיי היום־יום.",
    "משיחות עם בעלי עסקים ועד יוזמות חדשות בשכונה: האנשים שמניעים את הכלכלה המקומית.",
    "בין הבמות הגדולות למרחבים הקטנים, דור חדש של יוצרים מוצא את הקול שלו.",
  ];
  const articles = [],
    analytics = [],
    comments = [];
  const hour = Math.floor(Date.now() / 3600000) * 3600000;
  for (let i = 0; i < count; i++) {
    const category = categories[i % 5],
      status = ["Published", "Pending", "Draft", "Returned"][i % 4];
    const title = `${titles[i % 5]} · ${i + 1}`;
    const content = `${introductions[i % 5]}\n\nבמערכת The Daily Web אנחנו מחפשים את הסיפורים שמוסיפים הקשר לחדשות. בשבוע האחרון פגשנו אנשי מקצוע, תושבים ויוצרים כדי לשמוע מהם מה השתנה ומה כדאי לדעת.\n\nהסיפור הזה הוא תוכן הדגמה לפרויקט אקדמי. הנתונים והדמויות נועדו להמחיש את חוויית הקריאה ואת תהליך העבודה של מערכת חדשות.\n\nבהמשך הדרך נמשיך לעקוב אחר ההתפתחויות, לשאול שאלות ולתת מקום לקולות נוספים.`;
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      title,
      content,
      category,
      mainImage: "/images/news.svg",
      reporter: users[1 + (i % 5)]._id,
      status,
      editorNote:
        status === "Returned"
          ? "יש לחדד את הפתיח ולהוסיף הקשר לפני הגשה חוזרת."
          : "",
      publicationHistory: [],
      totalViews: 0,
    };
    if (status === "Published" || i % 5 === 0) {
      const first = hour - 48 * 3600000 - i * 60000;
      const times = [
        first,
        first + 15 * 3600000 + 17 * 60000,
        first + 32 * 3600000 + 43 * 60000,
      ];
      doc.publicationHistory = times.map((t, j) => ({
        publishedAt: new Date(t),
        title: `${title} — גרסה ${j + 1}`,
      }));
      doc.publishedVersion = {
        title,
        content,
        category,
        mainImage: doc.mainImage,
        publishedAt: new Date(times[2]),
      };
      if (status !== "Published")
        doc.content +=
          "\n\nעדכון חדש שנמצא בעבודה ואינו מופיע עדיין באתר הציבורי.";
      for (let h = 0; h < 48; h++) {
        const views = 5 + ((i * 7 + h * 13) % 50) + (h > 32 ? 20 : 0);
        doc.totalViews += views;
        analytics.push({
          article: doc._id,
          timeWindow: new Date(hour - (47 - h) * 3600000),
          views,
        });
      }
      for (let c = 0; c < 3; c++)
        comments.push({
          article: doc._id,
          authorName: ["נועה", "איתי", "מיכל"][c],
          content: [
            "מעניין לקרוא גם את הרקע לסיפור.",
            "תודה על נקודת המבט הנוספת.",
            "נשמח לעדכון בהמשך.",
          ][c],
          ipAddress: "127.0.0.1",
        });
    }
    articles.push(doc);
  }
  await Article.insertMany(articles);
  if (analytics.length) await Analytics.insertMany(analytics);
  if (comments.length) await Comment.insertMany(comments);
  return {
    users: users.length,
    articles: articles.length,
    analytics: analytics.length,
    comments: comments.length,
  };
}
if (require.main === module) {
  const config = require("../config");
  (async () => {
    await mongoose.connect(config.mongoUri);
    const result = await seedDatabase(process.env.DEMO_PASSWORD, {
      reset: process.argv.includes("--reset"),
    });
    console.log("Seed completed:", result);
    console.log(
      "Accounts: MainEditor, Reporter1 through Reporter5. Password: your local DEMO_PASSWORD.",
    );
  })()
    .catch((error) => {
      console.error(
        error.name === "Error"
          ? error.message
          : "Seed failed. Check database configuration.",
      );
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
module.exports = { seedDatabase };
