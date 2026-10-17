const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "logs"].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (p.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", p], {
        stdio: "inherit",
      });
      if (result.status) process.exitCode = 1;
    }
  }
}
walk(path.join(__dirname, ".."));
