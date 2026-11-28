#!/usr/bin/env node
// Bake the Traditional Chinese strings from assets/js/i18n.js into the built HTML.
//
// Why: pages are written in English and switched to Chinese by i18n.js after load.
// Search and AI crawlers that do not run JavaScript (GPTBot, ClaudeBot, PerplexityBot,
// most link-preview bots) therefore read an English page that declares lang="zh-Hant".
// Readers also see English for a moment before the switch.
//
// What: for every element with data-i18n="key" whose key has a Chinese string, the
// script writes the Chinese text into the HTML and keeps the English original in
// data-i18n-default. i18n.js already reads data-i18n-default as the English fallback,
// so the language switch keeps working. The same is done for aria-label, alt, and
// placeholder. Elements whose key has no Chinese string are left untouched.
//
// Usage: node scripts/prerender-zh.mjs _site

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(process.argv[2] || "_site");
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const i18nSource = fs.readFileSync(path.join(repo, "assets/js/i18n.js"), "utf8");
const match = i18nSource.match(/const OpenFormosaZh = (\{[\s\S]*?\n\});/);
if (!match) {
  console.error("prerender-zh: could not find OpenFormosaZh in assets/js/i18n.js");
  process.exit(1);
}
const zh = vm.runInNewContext(`(${match[1]})`);

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title"]);
const ATTRS = [
  ["data-i18n-aria-label", "aria-label", "data-i18n-aria-label-default"],
  ["data-i18n-alt", "alt", "data-i18n-alt-default"],
  ["data-i18n-placeholder", "placeholder", "data-i18n-placeholder-default"],
];

const has = (key) => Object.prototype.hasOwnProperty.call(zh, key);
const escText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, ent) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return String.fromCodePoint(code);
    }
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", middot: "·", rarr: "→", larr: "←", copy: "©", times: "×" };
    return Object.prototype.hasOwnProperty.call(named, ent.toLowerCase()) ? named[ent.toLowerCase()] : all;
  });
}

// Read one tag starting at html[i] === "<". Handles quoted attribute values.
function readTag(html, i) {
  let j = i + 1;
  let quote = null;
  while (j < html.length) {
    const c = html[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      break;
    }
    j += 1;
  }
  return html.slice(i, j + 1);
}

function parseAttrs(tag) {
  const attrs = new Map();
  const body = tag.replace(/^<[a-zA-Z][\w:-]*/, "").replace(/\/?>$/, "");
  const re = /([^\s=\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(body))) attrs.set(m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}

function setAttr(tag, name, value) {
  const re = new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s"'>]+)`, "i");
  if (re.test(tag)) return tag.replace(re, `$1"${escAttr(value)}"`);
  return tag.replace(/\s*(\/?)>$/, ` ${name}="${escAttr(value)}"$1>`);
}

// Find the index just past the matching end tag for an element that starts at `from`.
function findClose(html, from, name) {
  const re = new RegExp(`<(/?)${name}(?=[\\s>/])`, "gi");
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    const tag = readTag(html, m.index);
    if (m[1]) {
      depth -= 1;
      if (depth === 0) return { innerEnd: m.index, end: m.index + tag.length };
    } else if (!tag.endsWith("/>")) {
      depth += 1;
    }
    re.lastIndex = m.index + tag.length;
  }
  return null;
}

function rewrite(html, stats) {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt);
      const stop = end === -1 ? html.length : end + 3;
      out += html.slice(lt, stop);
      i = stop;
      continue;
    }
    const nameMatch = /^<([a-zA-Z][\w:-]*)/.exec(html.slice(lt, lt + 64));
    if (!nameMatch) {
      out += "<";
      i = lt + 1;
      continue;
    }
    const name = nameMatch[1].toLowerCase();
    let tag = readTag(html, lt);
    let next = lt + tag.length;

    if (RAW.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, next);
      const stop = close === -1 ? html.length : close;
      out += tag + html.slice(next, stop);
      i = stop;
      continue;
    }

    if (tag.includes("data-i18n")) {
      const attrs = parseAttrs(tag);
      for (const [keyAttr, target, keep] of ATTRS) {
        const key = attrs.get(keyAttr);
        if (key && has(key) && !attrs.has(keep)) {
          tag = setAttr(tag, keep, decode(attrs.get(target) || ""));
          tag = setAttr(tag, target, zh[key]);
          stats.attrs += 1;
        }
      }
      const key = attrs.get("data-i18n");
      if (key && has(key) && !VOID.has(name) && !tag.endsWith("/>") && !attrs.has("data-i18n-default")) {
        const close = findClose(html, next, name);
        if (close) {
          const inner = html.slice(next, close.innerEnd);
          const english = decode(inner.replace(/<[^>]*>/g, ""));
          tag = setAttr(tag, "data-i18n-default", english);
          out += tag + escText(zh[key]) + html.slice(close.innerEnd, close.end);
          stats.text += 1;
          i = close.end;
          continue;
        }
      }
    }
    out += tag;
    i = next;
  }
  return out;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

const stats = { files: 0, text: 0, attrs: 0 };
for (const file of walk(root)) {
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes("data-i18n")) continue;
  const result = rewrite(html, stats);
  if (result !== html) {
    fs.writeFileSync(file, result);
    stats.files += 1;
  }
}
console.log(`prerender-zh: ${stats.files} files, ${stats.text} text nodes, ${stats.attrs} attributes`);
