// Node 22+ loads local settings without a runtime dependency.
const fs = require("node:fs");
const path = require("node:path");
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    "Set JWT_SECRET to a random value of at least 32 characters in .env",
  );
}
module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/daily_web",
  port: Number(process.env.PORT) || 3000,
  production: process.env.NODE_ENV === "production",
};
