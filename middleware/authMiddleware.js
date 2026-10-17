const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { jwtSecret } = require("../config");
// Load current roles and account state on every request; signed sessions survive restart.
exports.loadUser = async (req, res, next) => {
  req.user = null;
  res.locals.currentUser = null;
  if (req.cookies.token) {
    let claims;
    try {
      claims = jwt.verify(req.cookies.token, jwtSecret, {
        algorithms: ["HS256"],
      });
    } catch {
      return next();
    }
    const user = await User.findById(claims.userId).select(
      "username role tokenVersion",
    );
    if (user && (user.tokenVersion || 0) === claims.version) {
      req.user = {
        userId: String(user._id),
        username: user.username,
        role: user.role,
      };
      res.locals.currentUser = req.user;
    }
  }
  next();
};
exports.verifyToken = (req, res, next) => {
  if (req.user) return next();
  if (req.method === "GET" && !req.originalUrl.startsWith("/api/"))
    return res.redirect("/login");
  res.status(401).json({ message: "יש להתחבר למערכת" });
};
const requireRole = (roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) return next();
  res.status(403).json({ message: "אין לך הרשאה לפעולה זו" });
};
exports.requireEditor = requireRole(["Editor"]);
exports.requireStaff = requireRole(["Reporter", "Editor"]);
exports.requireReporter = requireRole(["Reporter"]);
