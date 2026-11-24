"use strict";

const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

const themeStorageKey = "openformosa-theme";
const themeMedia = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function savedTheme() {
  try {
    const value = localStorage.getItem(themeStorageKey);
    return value === "dark" || value === "light" ? value : "";
  } catch (error) {
    return "";
  }
}

function systemTheme() {
  return themeMedia && themeMedia.matches ? "dark" : "light";
}

function setTheme(theme, options = {}) {
  const persist = options.persist !== false;
  const nextTheme = theme === "dark" || theme === "light" ? theme : systemTheme();
  document.documentElement.dataset.theme = nextTheme;

  const themeColor = document.querySelector("[data-theme-color]");
  if (themeColor) themeColor.setAttribute("content", nextTheme === "dark" ? "#11100e" : "#fff9ed");

  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    const active = button.dataset.themeOption === nextTheme;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch (error) {
      // Some private browsing modes block storage; the current page can still switch.
    }
  }

  window.dispatchEvent(new CustomEvent("openformosa:theme", { detail: { theme: nextTheme } }));
}

document.querySelectorAll("[data-theme-option]").forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeOption));
});

if (themeMedia) {
  const syncSystemTheme = () => {
    if (!savedTheme()) setTheme(systemTheme(), { persist: false });
  };

  if (themeMedia.addEventListener) {
    themeMedia.addEventListener("change", syncSystemTheme);
  } else if (themeMedia.addListener) {
    themeMedia.addListener(syncSystemTheme);
  }
}

setTheme(savedTheme() || document.documentElement.dataset.theme || systemTheme(), { persist: false });

const search = document.querySelector("[data-blog-search]");
const tag = document.querySelector("[data-blog-tag]");
const cards = [...document.querySelectorAll("[data-post-card]")];

function filterPosts() {
  const q = (search?.value || "").toLowerCase();
  const t = (tag?.value || "all").toLowerCase();
  cards.forEach((card) => {
    const hay = `${card.dataset.title} ${card.dataset.zhTitle} ${card.dataset.tags} ${card.textContent}`.toLowerCase();
    const tagOk = t === "all" || card.dataset.tags.toLowerCase().includes(t);
    card.hidden = !(hay.includes(q) && tagOk);
  });
}

search?.addEventListener("input", filterPosts);
tag?.addEventListener("change", filterPosts);
window.addEventListener("openformosa:language", filterPosts);

// Support SearchAction query param (/blog/?q=...) for search engines and shareable links.
if (search) {
  const initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) {
    search.value = initialQuery;
    filterPosts();
  }
}

const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealTargets = [...document.querySelectorAll(".reveal")];

if (revealTargets.length) {
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((el) => el.classList.add("is-in"));
  } else {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealTargets.forEach((el) => revealObserver.observe(el));
  }
}

// Inject a copy button into each rendered code block. Rouge wraps fenced
// blocks in `.highlighter-rouge`; the button is appended as a sibling of the
// `<pre>` so its own label never lands inside the copied text. Buttons follow
// the generic [data-copy] contract below, so i18n labelling (action_copy /
// action_copied) and analytics tracking apply without extra wiring.
document.querySelectorAll(".prose .highlighter-rouge").forEach((block, index) => {
  const code = block.querySelector("pre code");
  if (!code || block.querySelector(".code-copy")) return;
  if (!code.id) code.id = `of-code-${index + 1}`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "code-copy";
  button.dataset.copy = `#${code.id}`;
  button.dataset.i18n = "action_copy";
  button.textContent = "Copy"; // English default; i18n localizes on apply
  block.appendChild(button);
});

document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const target = document.querySelector(btn.dataset.copy);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
    } catch (error) {
      return; // clipboard unavailable (e.g. insecure context) — leave label as-is
    }
    btn.textContent = window.OpenFormosaI18n?.text("action_copied", "Copied") || "Copied";
    setTimeout(() => {
      window.OpenFormosaI18n?.applyLanguage(window.OpenFormosaI18n.getLanguage());
    }, 1400);
  });
});

// ===== Inline TTS listening demos (blog posts) =====
(function () {
  const cards = [...document.querySelectorAll("[data-tts-card]")];
  if (!cards.length) return;

  const players = [];

  function format(time) {
    if (!isFinite(time) || time < 0) return "0:00";
    const seconds = Math.floor(time % 60);
    return `${Math.floor(time / 60)}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  cards.forEach((card) => {
    const audio = card.querySelector("[data-tts-audio]");
    const playBtn = card.querySelector("[data-tts-play]");
    const fill = card.querySelector("[data-tts-fill]");
    const timeEl = card.querySelector("[data-tts-time]");
    const revealBtn = card.querySelector("[data-tts-reveal]");
    const asrPanel = card.querySelector("[data-tts-asr]");
    if (!audio || !playBtn) return;

    players.push(audio);

    playBtn.addEventListener("click", () => {
      if (audio.paused) {
        players.forEach((other) => {
          if (other !== audio) other.pause();
        });
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });

    audio.addEventListener("play", () => card.classList.add("is-playing"));
    audio.addEventListener("pause", () => card.classList.remove("is-playing"));
    audio.addEventListener("ended", () => {
      card.classList.remove("is-playing");
      if (fill) fill.style.width = "0%";
      if (timeEl && audio.duration) timeEl.textContent = `0:00 / ${format(audio.duration)}`;
    });
    audio.addEventListener("timeupdate", () => {
      if (!audio.duration) return;
      if (fill) fill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
      if (timeEl) timeEl.textContent = `${format(audio.currentTime)} / ${format(audio.duration)}`;
    });
    audio.addEventListener("loadedmetadata", () => {
      if (timeEl) timeEl.textContent = `0:00 / ${format(audio.duration)}`;
    });

    if (revealBtn && asrPanel) {
      revealBtn.addEventListener("click", () => {
        const opening = asrPanel.hasAttribute("hidden");
        if (opening) asrPanel.removeAttribute("hidden");
        else asrPanel.setAttribute("hidden", "");
        revealBtn.setAttribute("aria-expanded", String(opening));
      });
    }
  });

  // Switching site language hides the inactive-language copy — stop any audio first.
  window.addEventListener("openformosa:language", () => {
    players.forEach((audio) => audio.pause());
  });
})();
