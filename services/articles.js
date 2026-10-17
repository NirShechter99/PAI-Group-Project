const Article = require("../models/Article");
const Analytics = require("../models/Analytics");
const Comment = require("../models/Comment");
const ReadingHistory = require("../models/ReadingHistory");
const { PUBLIC_FILTER, toPublicArticle } = require("../utils/publicArticle");
const categories = {
  Technology: "טכנולוגיה",
  Sports: "ספורט",
  Politics: "פוליטיקה",
  Economy: "כלכלה",
  Entertainment: "תרבות",
};
const statuses = {
  Draft: "בהכנה",
  Pending: "ממתינה לאישור עורך",
  Published: "פורסמה",
  Returned: "הוחזרה לתיקונים",
};
const fields = ["title", "category", "mainImage", "content"];
function applyValues(article, body) {
  for (const key of fields)
    if (body[key] !== undefined) {
      if (typeof body[key] !== "string")
        throw Object.assign(new Error("Invalid field"), { status: 400 });
      article[key] = (key === "content" ? body[key] : body[key].trim()).slice(
        0,
        key === "content" ? 50000 : key === "mainImage" ? 2000 : 300,
      );
    }
  if (article.category && !categories[article.category])
    throw Object.assign(new Error("Invalid category"), { status: 400 });
  if (
    article.mainImage &&
    !/^https:\/\//i.test(article.mainImage) &&
    article.mainImage !== "/images/news.svg"
  )
    throw Object.assign(new Error("Image must use HTTPS"), { status: 400 });
}
async function publish(article) {
  if (article.status !== "Pending")
    throw Object.assign(new Error("Only pending articles can be published"), {
      status: 409,
    });
  const publishedAt = new Date();
  article.publishedVersion = Object.fromEntries(
    fields.map((f) => [f, article[f]]),
  );
  article.publishedVersion.publishedAt = publishedAt;
  article.publicationHistory.push({ publishedAt, title: article.title });
  article.status = "Published";
  article.draftClock = (article.draftClock || 0) + 1;
  article.editorNote = "";
  return article.save();
}
async function remove(id) {
  await Article.findByIdAndDelete(id);
  await Promise.all([
    Analytics.deleteMany({ article: id }),
    Comment.deleteMany({ article: id }),
    ReadingHistory.deleteMany({ article: id }),
  ]);
}
async function listPublic(query, deviceId) {
  const page = Math.min(100000, Math.max(1, parseInt(query.page) || 1));
  const limit = 20;
  const filter = { ...PUBLIC_FILTER };
  if (typeof query.q === "string" && query.q.trim())
    filter["publishedVersion.title"] = {
      $regex: query.q
        .trim()
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  if (Object.hasOwn(categories, query.category))
    filter["publishedVersion.category"] = query.category;
  const readIds = await ReadingHistory.distinct("article", { deviceId });
  if (query.viewed === "read") filter._id = { $in: readIds };
  if (query.viewed === "unread") filter._id = { $nin: readIds };
  const sort =
    query.sort === "popular"
      ? { totalViews: -1, _id: -1 }
      : { "publishedVersion.publishedAt": -1, _id: -1 };
  const [items, total] = await Promise.all([
    Article.find(filter)
      .populate("reporter", "username")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Article.countDocuments(filter),
  ]);
  const read = new Set(readIds.map(String));
  return {
    articles: items.map((a) => ({
      ...toPublicArticle(a),
      viewed: read.has(String(a._id)),
      totalViews: a.totalViews,
    })),
    total,
    currentPage: page,
    totalPages: Math.ceil(total / limit),
  };
}
async function recordView(articleId, deviceId) {
  const timeWindow = new Date(Math.floor(Date.now() / 3600000) * 3600000);
  try {
    await Analytics.updateOne(
      { article: articleId, timeWindow },
      { $inc: { views: 1 } },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    await Analytics.updateOne(
      { article: articleId, timeWindow },
      { $inc: { views: 1 } },
    );
  }
  await Article.updateOne({ _id: articleId }, { $inc: { totalViews: 1 } });
  try {
    await ReadingHistory.updateOne(
      { article: articleId, deviceId },
      { $setOnInsert: { article: articleId, deviceId } },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}
module.exports = {
  categories,
  statuses,
  applyValues,
  publish,
  remove,
  listPublic,
  recordView,
};
