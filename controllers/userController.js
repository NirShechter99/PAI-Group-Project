const User = require("../models/User");
const Article = require("../models/Article");
const bcrypt = require("bcrypt");
const publicUser = (u) => ({ _id: u._id, username: u.username, role: u.role });
function validate(body, creating) {
  if (
    (creating || body.username !== undefined) &&
    (typeof body.username !== "string" ||
      !/^[\p{L}\p{N}_.-]{2,40}$/u.test(body.username))
  )
    throw Object.assign(new Error("Invalid username"), { status: 400 });
  if (
    (creating || body.password) &&
    (typeof body.password !== "string" ||
      body.password.length < 10 ||
      Buffer.byteLength(body.password) > 72)
  )
    throw Object.assign(
      new Error("Password must be 10+ characters and at most 72 bytes"),
      { status: 400 },
    );
  if (
    body.role !== undefined &&
    !["Guest", "Reporter", "Editor"].includes(body.role)
  )
    throw Object.assign(new Error("Invalid role"), { status: 400 });
}
exports.createUser = async (req, res) => {
  validate(req.body, true);
  const user = await User.create({
    username: req.body.username,
    role: req.body.role || "Guest",
    password: await bcrypt.hash(req.body.password, 10),
  });
  res.status(201).json({ user: publicUser(user) });
};
exports.list = async (req, res) => {
  const filter =
    typeof req.query.q === "string"
      ? {
          username: {
            $regex: req.query.q
              .slice(0, 40)
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        }
      : {};
  const users = await User.find(filter).sort({ username: 1 }).limit(100);
  res.json({ users: users.map(publicUser) });
};
exports.update = async (req, res) => {
  validate(req.body, false);
  if (
    req.params.id === req.user.userId &&
    req.body.role &&
    req.body.role !== "Editor"
  )
    return res
      .status(409)
      .json({ message: "לא ניתן להסיר את הרשאת העורך של עצמך" });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "הפריט לא נמצא" });
  for (const f of ["username", "role"])
    if (req.body[f] !== undefined) user[f] = req.body[f];
  if (req.body.password)
    user.password = await bcrypt.hash(req.body.password, 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.json({ user: publicUser(user) });
};
exports.remove = async (req, res) => {
  if (
    req.params.id === req.user.userId ||
    (await Article.exists({ reporter: req.params.id }))
  )
    return res
      .status(409)
      .json({ message: "לא ניתן למחוק משתמש פעיל שלך או משתמש בעל כתבות" });
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
};
