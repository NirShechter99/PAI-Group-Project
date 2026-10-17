const { randomBytes, timingSafeEqual } = require("node:crypto");
const { production } = require("../config");
const cookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: production,
  path: "/",
};
exports.cookieOptions = cookieOptions;
exports.security = (req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("X-Frame-Options", "DENY");
  res.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  const existing = req.signedCookies.csrf;
  const token =
    typeof existing === "string" ? existing : randomBytes(24).toString("hex");
  if (!existing) res.cookie("csrf", token, { ...cookieOptions, signed: true });
  res.locals.csrf = token;
  req.deviceId =
    typeof req.signedCookies.deviceId === "string"
      ? req.signedCookies.deviceId
      : randomBytes(24).toString("hex");
  if (!req.signedCookies.deviceId)
    res.cookie("deviceId", req.deviceId, {
      ...cookieOptions,
      signed: true,
      maxAge: 365 * 86400000,
    });
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const sent = req.get("X-CSRF-Token") || req.body?._csrf;
    const a = Buffer.from(token),
      b = Buffer.from(typeof sent === "string" ? sent : "");
    if (!existing || a.length !== b.length || !timingSafeEqual(a, b))
      return res
        .status(403)
        .json({ message: "תוקף הטופס פג. יש לרענן את הדף ולנסות שוב." });
  }
  next();
};
