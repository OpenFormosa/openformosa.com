#!/usr/bin/env node
// Tell IndexNow search engines (Bing, Yandex, Naver, Seznam and others) that the site changed.
// Bing's index also feeds ChatGPT search and Copilot, so new pages show up there sooner.
//
// Usage: node scripts/indexnow.mjs _site https://openformosa.com
// The key file <key>.txt sits at the site root; see https://www.indexnow.org/documentation.

import fs from "node:fs";
import path from "node:path";

const siteDir = path.resolve(process.argv[2] || "_site");
const base = (process.argv[3] || "").replace(/\/$/, "");
if (!/^https:\/\/openformosa\.com$/.test(base)) {
  console.log(`indexnow: skipped, site base is ${base || "(empty)"}`);
  process.exit(0);
}
const keyFile = fs.readdirSync(siteDir).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) {
  console.log("indexnow: skipped, no key file at site root");
  process.exit(0);
}
const key = fs.readFileSync(path.join(siteDir, keyFile), "utf8").trim();
const sitemap = fs.readFileSync(path.join(siteDir, "sitemap.xml"), "utf8");
const urls = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))]
  .filter((u) => u.startsWith(base + "/"))
  .concat([`${base}/llms.txt`, `${base}/llms-full.txt`]);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/${keyFile}`, urlList: urls.slice(0, 10000) }),
});
console.log(`indexnow: submitted ${urls.length} URLs, HTTP ${res.status}`);
