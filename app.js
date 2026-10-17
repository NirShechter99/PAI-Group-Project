const config = require("./config");
const express = require("express");
const mongoose = require("mongoose");
const path = require("node:path");
const cookieParser = require("cookie-parser");
const logger = require("./utils/logger");
const auth = require("./middleware/authMiddleware");
const { security } = require("./middleware/requestSecurity");
const articles = require("./services/articles");
const app = express();
app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: config.production ? "1h" : 0,
  }),
);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ message: "Request body must be an object" });
  }
  next();
});
app.use(cookieParser(config.jwtSecret));
app.use(security);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store"); // HTML includes a visitor-specific CSRF token.
  res.locals.currentUser = null;
  res.locals.categories = articles.categories;
  res.locals.STATUS_LABELS = articles.statuses;
  res.locals.date = (value) =>
    value
      ? new Date(value).toLocaleString("he-IL", {
          timeZone: "Asia/Jerusalem",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
  res.locals.safeImage = (value) =>
    typeof value === "string" && (/^https:\/\//i.test(value) || /^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(value))
      ? value
      : "/images/news.svg";
  next();
});
app.use(auth.loadUser);
for (const name of [
  "user",
  "article",
  "comment",
  "analytics",
  "auth",
  "weather",
]) {
  const mount =
    { user: "users", article: "articles", comment: "comments" }[name] || name;
  app.use(`/api/${mount}`, require(`./routes/${name}Routes`));
}
app.use("/reporter", require("./routes/reporterRoutes"));
app.use("/editor", require("./routes/editorRoutes"));
app.get("/login", (req, res) => res.render("login"));
app.get("/", require("./controllers/publicController").home);
app.use((req, res) => {
  if (req.path.startsWith("/api/"))
    return res.status(404).json({ message: "הנתיב לא נמצא" });
  res
    .status(404)
    .render("error", {
      title: "העמוד לא נמצא",
      message: "אפשר לחזור לחדשות או להשתמש בתפריט הראשי.",
    });
});
app.use((error, req, res, next) => {
  let status =
    error.status ||
    (error.name === "VersionError" ? 409 : 0) ||
    (["ValidationError", "CastError"].includes(error.name)
      ? 400
      : error.code === 11000
        ? 409
        : 500);
  if (status < 400 || status > 599) status = 500;
  // Do not expose DB connection details, passwords or provider URLs in logs/responses.
  logger.logError(`${req.method} ${req.path}`, {
    message: `${error.name || "Error"} (${status})`,
  });
  const message =
    status === 500
      ? "אירעה שגיאת שרת. נסו שוב."
      : status === 409
        ? "הפעולה מתנגשת במצב הנוכחי. רעננו ונסו שוב."
        : "הבקשה אינה תקינה או שהפריט אינו זמין.";
  if (!res.locals.csrf)
    return res.status(status).type("text/plain").send(message);
  if (req.path.startsWith("/api/") || req.path.endsWith("/autosave") || req.path.endsWith("/image"))
    return res.status(status).json({ message });
  res
    .status(status)
    .render("error", { title: "לא ניתן להשלים את הפעולה", message });
});
async function start() {
  await mongoose.connect(config.mongoUri);
  const server = app.listen(config.port, () =>
    logger.logEvent(`Server listening on ${config.port}`),
  );
  return server;
}
if (require.main === module)
  start().catch(() => {
    console.error("Startup failed. Check MONGO_URI and database availability.");
    process.exitCode = 1;
  });
module.exports = { app, start };
