const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { createHash } = require("node:crypto");
const { jwtSecret } = require("../config");
const { cookieOptions } = require("../middleware/requestSecurity");
const reserve = require("../services/rateLimit");
exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    password.length > 128
  )
    return res.status(400).json({ message: "יש להזין שם משתמש וסיסמה" });
  const key = createHash("sha256")
    .update(req.ip || "")
    .digest("hex");
  if (!(await reserve(`login:${key}`, 20, 60000)))
    return res
      .status(429)
      .json({ message: "יותר מדי ניסיונות. נסו שוב בעוד דקה." });
  const user = await User.findOne({ username: username.trim() });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: "שם משתמש או סיסמה שגויים" });
  const token = jwt.sign(
    { userId: user._id, version: user.tokenVersion || 0 },
    jwtSecret,
    { algorithm: "HS256", expiresIn: "24h" },
  );
  res.cookie("token", token, { ...cookieOptions, maxAge: 86400000 });
  res.json({
    message: "התחברת בהצלחה",
    user: { id: user._id, username: user.username, role: user.role },
  });
};
exports.logout = async (req, res) => {
  if (req.user)
    await User.updateOne(
      { _id: req.user.userId },
      { $inc: { tokenVersion: 1 } },
    );
  res.clearCookie("token", cookieOptions);
  res.json({ message: "התנתקת בהצלחה" });
};
