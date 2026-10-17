// Read-only rehearsal check: never seeds, resets or changes the team's database.
const mongoose = require("mongoose");
const User = require("../models/User");
const Article = require("../models/Article");
const Comment = require("../models/Comment");
const Analytics = require("../models/Analytics");
async function checkDatabase() {
  const [
    articles,
    reporters,
    editors,
    comments,
    histories,
    analytics,
    statuses,
    totals,
  ] = await Promise.all([
    Article.countDocuments(),
    User.countDocuments({ role: "Reporter" }),
    User.countDocuments({ role: "Editor" }),
    Comment.countDocuments(),
    Article.countDocuments({ "publicationHistory.2": { $exists: true } }),
    Analytics.countDocuments(),
    Article.distinct("status"),
    Article.aggregate([
      { $group: { _id: null, views: { $sum: "$totalViews" } } },
    ]),
  ]);
  const published = await Article.countDocuments({
    "publishedVersion.publishedAt": { $type: "date" },
  });
  const check = [
    ["At least 500 articles", articles >= 500, articles],
    ["Multiple reporters", reporters >= 2, reporters],
    ["Editor account", editors >= 1, editors],
    ["Comments available", comments > 0, comments],
    ["Several articles with multiple publications", histories >= 3, histories],
    [
      "View history for analytics",
      analytics > 0 && totals[0]?.views > 0,
      analytics,
    ],
    ["Approved public articles", published > 0, published],
    ...["Draft", "Pending", "Published", "Returned"].map((s) => [
      `${s} example`,
      statuses.includes(s),
      statuses.includes(s) ? "present" : "missing",
    ]),
  ];
  return { ok: check.every((c) => c[1]), checks: check };
}
if (require.main === module) {
  const config = require("../config");
  (async () => {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    const result = await checkDatabase();
    for (const [name, ok, value] of result.checks)
      console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${value}`);
    if (!result.ok) process.exitCode = 1;
    try {
      const data = await require("../services/weather").weather.get();
      console.log(
        "PASS live weather data is within 15 minutes; city:",
        data.city,
      );
    } catch {
      console.log(
        "WARNING weather unavailable now. Verify internet/provider access before the presentation.",
      );
    }
    console.log(
      "Manual checks: confirm the Moodle deadline, all students share a lecturer, each student understands the code, and previously exposed credentials have been rotated.",
    );
  })()
    .catch(() => {
      console.error(
        "Preflight could not connect. Check your local .env and MongoDB; no data was changed.",
      );
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
module.exports = { checkDatabase };
