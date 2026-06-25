const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "src-tauri", "resources");
const dest = path.join(__dirname, "..", "src-tauri", "target", "debug", "resources");

function sync(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      sync(s, d);
    } else {
      if (!fs.existsSync(d) || fs.statSync(s).mtimeMs > fs.statSync(d).mtimeMs) {
        fs.copyFileSync(s, d);
      }
    }
  }
}

if (!fs.existsSync(dest)) {
  console.log("[sync-assets] Copying resources from src-tauri/resources/ to target/debug/resources/");
  sync(src, dest);
}
