const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const versions = new Map();

// Content versions make a new release bypass old, still-fresh browser cache entries.
// Paths come only from our templates. Restart Node after installing an update.
module.exports = function asset(url) {
  if (!/^\/(css|js)\/[\w.-]+\.(css|js)$/.test(url))
    throw new Error("Invalid asset path");
  if (!versions.has(url)) {
    const content = fs.readFileSync(path.join(__dirname, "../public", url));
    versions.set(url, createHash("sha256").update(content).digest("hex").slice(0, 16));
  }
  return `${url}?v=${versions.get(url)}`;
};
