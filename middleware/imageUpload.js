const multer = require("multer");
const { randomBytes } = require("node:crypto");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const Article = require("../models/Article");
const parse = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 0 } }).single("image");

exports.upload = async (req, res, next) => {
  try {
    const article = await Article.findOne({ _id: req.params.id, reporter: req.user.userId });
    if (!article) return res.status(404).json({ message: "Article not found" });
    if (article.status === "Pending") return res.status(409).json({ message: "Article is under review" });
    parse(req, res, async (error) => {
      if (error) return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message: "Use one PNG, JPEG or WebP image up to 3 MB" });
      try {
        const b = req.file?.buffer;
        let ext;
        if (b?.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext = "png";
        else if (b?.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) ext = "jpg";
        else if (b?.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") ext = "webp";
        if (!ext) return res.status(400).json({ message: "Unsupported image contents" });
        const name = `${randomBytes(16).toString("hex")}.${ext}`;
        const dir = path.join(__dirname, "..", "public", "uploads");
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, name), b, { flag: "wx" });
        res.status(201).json({ url: `/uploads/${name}` });
      } catch (err) { next(err); }
    });
  } catch (error) { next(error); }
};
