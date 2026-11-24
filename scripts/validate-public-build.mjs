#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const siteDir = path.resolve(args.find((arg) => !arg.startsWith("--")) || "_site");
const requireAbsolute = args.includes("--require-absolute");
const expectedBase = args.find((arg) => arg.startsWith("--expected-base="))?.split("=")[1] || "";
const errors = [];
let expectedBasePath = "";
const requiredFiles = [
  "index.html",
  "sitemap.xml",
  "robots.txt",
  "feed.xml",
  "llms.txt",
  "llms-full.txt",
  "assets/css/main.css",
  "assets/js/i18n.js",
  "assets/img/openformosa-og.png"
];

function fail(message) {
  errors.push(message);
}

if (expectedBase) {
  try {
    expectedBasePath = new URL(expectedBase).pathname.replace(/\/$/, "");
    if (expectedBasePath === "/") expectedBasePath = "";
  } catch {
    fail(`--expected-base is not a valid URL: ${expectedBase}`);
  }
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(siteDir, relPath));
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(fullPath));
    else out.push(fullPath);
  }
  return out;
}

function routeForHtml(file) {
  const rel = "/" + path.relative(siteDir, file).replaceAll(path.sep, "/");
  if (rel === "/index.html") return "/";
  if (rel.endsWith("/index.html")) return rel.slice(0, -"index.html".length);
  return rel;
}

function htmlAttr(html, selector) {
  return html.match(selector)?.[1] || "";
}

function assertAbsolute(url, context) {
  if (!/^https:\/\//.test(url)) fail(`${context} must be an absolute HTTPS URL: ${url || "(empty)"}`);
  if (url.includes("openformosa.example")) fail(`${context} still uses the example production URL`);
  if (expectedBase && !url.startsWith(expectedBase)) fail(`${context} does not start with ${expectedBase}: ${url}`);
}

function stripExpectedBasePath(urlPath) {
  if (!expectedBasePath) return urlPath;
  if (urlPath === expectedBasePath) return "/";
  if (urlPath.startsWith(`${expectedBasePath}/`)) return urlPath.slice(expectedBasePath.length) || "/";
  return urlPath;
}

if (!fs.existsSync(siteDir)) fail(`Build output does not exist: ${siteDir}`);

for (const rel of requiredFiles) {
  if (!exists(rel)) fail(`Missing required output: ${rel}`);
}

if (errors.length === 0) {
  const allFiles = walk(siteDir);
  const htmlFiles = allFiles.filter((file) => file.endsWith(".html"));
  const routes = new Set(["/"]);
  for (const file of htmlFiles) {
    const rel = "/" + path.relative(siteDir, file).replaceAll(path.sep, "/");
    routes.add(rel);
    routes.add(routeForHtml(file));
  }

  if (exists("SECURITY/index.html") || exists("CODE_OF_CONDUCT/index.html") || exists("CONTRIBUTING/index.html")) {
    fail("Repository maintenance documents leaked into the public site output");
  }

  for (const file of htmlFiles) {
    const html = read(file);
    const rel = path.relative(siteDir, file);
    const title = htmlAttr(html, /<title>([^<]+)<\/title>/);
    const description = htmlAttr(html, /<meta name="description" content="([^"]*)">/);
    const canonical = htmlAttr(html, /<link rel="canonical" href="([^"]*)">/);
    const ogUrl = htmlAttr(html, /<meta property="og:url" content="([^"]*)">/);
    const ogImage = htmlAttr(html, /<meta property="og:image" content="([^"]*)">/);
    const ogLocale = htmlAttr(html, /<meta property="og:locale" content="([^"]*)">/);
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];

    if (!title) fail(`${rel} is missing <title>`);
    if (!description) fail(`${rel} is missing meta description`);
    if (!canonical) fail(`${rel} is missing canonical URL`);
    if (!ogUrl) fail(`${rel} is missing og:url`);
    if (!ogImage) fail(`${rel} is missing og:image`);
    if (ogLocale !== "zh_TW") fail(`${rel} should declare og:locale zh_TW`);
    if (!/<html lang="zh-Hant">/.test(html)) fail(`${rel} should render html lang zh-Hant`);
    if (!jsonLd) {
      fail(`${rel} is missing JSON-LD`);
    } else {
      try {
        JSON.parse(jsonLd);
      } catch (error) {
        fail(`${rel} has invalid JSON-LD: ${error.message}`);
      }
    }

    if (requireAbsolute) {
      assertAbsolute(canonical, `${rel} canonical`);
      assertAbsolute(ogUrl, `${rel} og:url`);
      assertAbsolute(ogImage, `${rel} og:image`);
    }

    const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
    for (const url of urls) {
      if (/^(https?:|mailto:|tel:|#|data:)/.test(url)) continue;
      const clean = stripExpectedBasePath(url.split("#")[0].split("?")[0]);
      if (!clean || clean.startsWith("//")) continue;
      if (clean.startsWith("/assets/")) {
        if (!fs.existsSync(path.join(siteDir, clean))) fail(`${rel} links missing asset ${url}`);
        continue;
      }
      if (!routes.has(clean) && !routes.has(`${clean}/`) && !fs.existsSync(path.join(siteDir, clean))) {
        fail(`${rel} links missing page ${url}`);
      }
    }
  }

  const sitemap = exists("sitemap.xml") ? read(path.join(siteDir, "sitemap.xml")) : "";
  const robots = exists("robots.txt") ? read(path.join(siteDir, "robots.txt")) : "";
  const feed = exists("feed.xml") ? read(path.join(siteDir, "feed.xml")) : "";
  const llms = exists("llms.txt") ? read(path.join(siteDir, "llms.txt")) : "";
  const llmsFull = exists("llms-full.txt") ? read(path.join(siteDir, "llms-full.txt")) : "";
  const sitemapLocs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const feedLinks = [...feed.matchAll(/(?:href|<id>)(?:=")?([^"<]+)(?:"|<\/id>)/g)].map((match) => match[1]);

  if (!sitemap.includes("</urlset>")) fail("sitemap.xml is missing closing urlset");
  if (!feed.includes("</feed>")) fail("feed.xml is missing closing feed");
  if (!robots.includes("Sitemap:")) fail("robots.txt is missing Sitemap line");
  if (!llms.includes("# OpenFormosa")) fail("llms.txt is missing canonical # OpenFormosa heading");
  if (!llmsFull.includes("# OpenFormosa")) fail("llms-full.txt is missing canonical # OpenFormosa heading");
  if (sitemap.includes("/404/") || sitemap.includes("/SECURITY/")) fail("sitemap.xml includes non-public routes");

  if (requireAbsolute) {
    for (const loc of sitemapLocs) assertAbsolute(loc, "sitemap loc");
    for (const link of feedLinks.filter((value) => value.startsWith("http") || value.startsWith("/"))) {
      assertAbsolute(link, "feed URL");
    }
    const robotsSitemap = robots.match(/^Sitemap:\s*(.+)$/m)?.[1] || "";
    assertAbsolute(robotsSitemap, "robots Sitemap");
    if (expectedBase && !llms.includes(expectedBase)) fail(`llms.txt does not reference ${expectedBase}`);
    if (expectedBase && !llmsFull.includes(expectedBase)) fail(`llms-full.txt does not reference ${expectedBase}`);
  }

  const publicText = allFiles
    .filter((file) => /\.(html|xml|txt|css|js)$/.test(file))
    .map((file) => read(file))
    .join("\n");
  for (const forbidden of ["TODO", "FIXME", "lorem ipsum", "openformosa.example"]) {
    if (publicText.includes(forbidden)) fail(`Public output contains forbidden marker: ${forbidden}`);
  }
}

if (errors.length) {
  console.error(`Public build validation failed for ${siteDir}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Public build validation passed: ${siteDir}${requireAbsolute ? " (absolute URLs required)" : ""}`);
