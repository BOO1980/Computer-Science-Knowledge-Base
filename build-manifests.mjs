import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const CONTENT = path.join(ROOT, "content");

async function readTitle(file) {
  try {
    const txt = await fs.readFile(file, "utf8");
    const m = txt.match(/<title>([\s\S]*?)<\/title>/i);
    const raw = (m?.[1] || path.basename(file, ".html"));
    return raw.replace(/\s+/g, " ").replace(/[-_]/g, " ").trim();
  } catch {
    return path.basename(file, ".html").replace(/[-_]/g, " ");
  }
}

async function walkHtml(dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkHtml(p, acc);
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".html") && e.name.toLowerCase() !== "index.html") {
      acc.push(p);
    }
  }
  return acc;
}

export async function buildModuleManifest(moduleDir) {
  const mod = path.basename(moduleDir);
  const entries = (await walkHtml(moduleDir)).sort((a,b)=>a.localeCompare(b));
  const topics = [];
  for (const f of entries) {
    const title = await readTitle(f);
    const href = path.relative(moduleDir, f).split(path.sep).join("/");
    topics.push({ title, href });
  }
  const manifest = { module: mod, topics };
  const js = 
    "window.OU_MODULE_MANIFESTS = window.OU_MODULE_MANIFESTS || {};\n" +
    `window.OU_MODULE_MANIFESTS[${JSON.stringify(mod)}] = ${JSON.stringify(manifest)};\n`;
  await fs.writeFile(path.join(moduleDir, "manifest.js"), js, "utf8");
  return { module: mod, count: topics.length };
}

export async function buildAll() {
  await fs.access(CONTENT).catch(() => { throw new Error("Could not find 'content' folder next to build-manifests.mjs"); });
  const modules = (await fs.readdir(CONTENT, { withFileTypes: true }))
    .filter(d => d.isDirectory())
    .map(d => path.join(CONTENT, d.name));

  if (!modules.length) {
    console.warn("No modules found under /content");
    return;
  }

  let total = 0;
  for (const m of modules) {
    const { count } = await buildModuleManifest(m);
    total += count;
  }
  return total;
}

// Allow running directly
if (process.argv[1] && process.argv[1].endsWith("build-manifests.mjs")) {
  (async () => {
    try {
      const total = await buildAll();
      console.log("Done. Total topics:", total ?? 0);
    } catch (err) {
      console.error("Manifest build failed:", err.message || err);
      process.exit(1);
    }
  })();
}
