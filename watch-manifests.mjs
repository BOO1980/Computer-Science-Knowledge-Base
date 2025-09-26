import chokidar from "chokidar";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { buildAll, buildModuleManifest } from "./build-manifests.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const CONTENT = path.join(ROOT, "content");

// Debounce helper
function debounce(fn, delay=250) {
  let t; 
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

async function init() {
  try {
    await fs.access(CONTENT);
  } catch {
    console.error("❌ Could not find 'content' folder next to watch-manifests.mjs");
    process.exit(1);
  }

  console.log("Building manifests...");
  await buildAll().then(total => console.log(`✓ Initial build complete (total topics: ${total ?? 0})`))
                  .catch(err => console.error("Initial build failed:", err));

  const watcher = chokidar.watch(CONTENT, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    ignored: /(^|[\/])\../ // ignore dotfiles
  });

  const rebuildAll = debounce(async () => {
    try {
      const total = await buildAll();
      console.log(`✓ Rebuilt all manifests (total topics: ${total ?? 0})`);
    } catch (e) {
      console.error("Rebuild failed:", e);
    }
  }, 400);

  watcher
    .on("add", file => {
      if (file.toLowerCase().endsWith(".html")) {
        console.log("➕ File added:", path.relative(ROOT, file));
        rebuildAll();
      }
    })
    .on("change", file => {
      if (file.toLowerCase().endsWith(".html")) {
        console.log("✏️  File changed:", path.relative(ROOT, file));
        rebuildAll();
      }
    })
    .on("unlink", file => {
      if (file.toLowerCase().endsWith(".html")) {
        console.log("🗑️  File removed:", path.relative(ROOT, file));
        rebuildAll();
      }
    })
    .on("addDir", dir => {
      console.log("📁 Folder added:", path.relative(ROOT, dir));
      rebuildAll();
    })
    .on("unlinkDir", dir => {
      console.log("📁 Folder removed:", path.relative(ROOT, dir));
      rebuildAll();
    });

  console.log("👀 Watching for changes in:", path.relative(ROOT, CONTENT) || "content/");
  console.log("Press Ctrl+C to stop.");
}

init().catch(err => {
  console.error("Watch init failed:", err);
  process.exit(1);
});
