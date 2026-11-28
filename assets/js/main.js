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
      window.dispatchEvent(new CustomEvent("openformosa:copy_failed", { detail: { target: btn.dataset.copy } }));
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

/* BlackBear-ASR post: streaming caption illustration and bar animation */
(() => {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const steps = [["", ""], ["", "今仔"], ["", "今仔日天"], ["今仔日", "天氣真"], ["今仔日天氣", "真好，我"],
    ["今仔日天氣真好，", "我們等"], ["今仔日天氣真好，我們", "等一下去"], ["今仔日天氣真好，我們等一下", "去夜市"],
    ["今仔日天氣真好，我們等一下去夜市", ""]];
  document.querySelectorAll("[data-asr-stream]").forEach((fig) => {
    const c = fig.querySelector(".asr-stream__c"), p = fig.querySelector(".asr-stream__p");
    const ticks = fig.querySelector(".asr-stream__ticks");
    if (!c || !p || !ticks) return;
    steps.forEach(() => ticks.appendChild(document.createElement("span")));
    const show = (k) => {
      c.textContent = steps[k][0]; p.textContent = steps[k][1];
      [...ticks.children].forEach((t, i) => { t.className = i < k ? "is-done" : i === k ? "is-now" : ""; });
    };
    if (reduce || !("IntersectionObserver" in window)) { show(steps.length - 1); return; }
    let timer = null;
    const play = () => {
      clearInterval(timer); let k = 0; show(0);
      timer = setInterval(() => { k += 1; if (k >= steps.length) { clearInterval(timer); setTimeout(play, 2400); return; } show(k); }, 640);
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { play(); io.disconnect(); } }), { threshold: .5 });
    io.observe(fig);
  });
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-playing"); io.unobserve(e.target); } }), { threshold: .3 });
    document.querySelectorAll(".asr-bars").forEach((s) => io.observe(s));
  }
})();

/* BlackBear-ASR post: flow motion graphic, live-caption replay (real streaming events), hotword toggle */
(() => {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const allAudio = () => [...document.querySelectorAll("audio")];
  const playOnly = (audio) => { allAudio().forEach((a) => { if (a !== audio) a.pause(); }); return audio.play().catch(() => {}); };

  document.querySelectorAll("[data-asr-flow]").forEach((fig) => {
    let scenes; try { scenes = JSON.parse(fig.dataset.scenes); } catch (e) { return; }
    const instr = fig.querySelector("[data-flow-instr]"), out = fig.querySelector("[data-flow-out]");
    if (!instr || !out || !scenes.length || reduce) return;
    let k = 0, timer = null, running = false;
    const type = (text, done) => {
      let i = 0; out.textContent = ""; out.classList.add("is-typing");
      const chars = [...text];
      timer = setInterval(() => {
        i += 1; out.textContent = chars.slice(0, i).join("");
        if (i >= chars.length) { clearInterval(timer); out.classList.remove("is-typing"); timer = setTimeout(done, 2200); }
      }, 90);
    };
    const next = () => {
      if (!running) return;
      k = (k + 1) % scenes.length; instr.style.opacity = "0";
      timer = setTimeout(() => { instr.textContent = scenes[k][0]; instr.style.opacity = "1"; timer = setTimeout(() => type(scenes[k][1], next), 900); }, 300);
    };
    const start = () => { if (running) return; running = true; type(scenes[k][1], next); };
    const stop = () => { running = false; clearInterval(timer); clearTimeout(timer); out.classList.remove("is-typing"); out.textContent = scenes[k][1]; };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? start() : stop())), { threshold: .4 }).observe(fig);
    }
  });

  document.querySelectorAll("[data-asr-replay]").forEach((fig) => {
    let data; try { data = JSON.parse(fig.querySelector("[data-replay-events]").textContent); } catch (e) { return; }
    const c = fig.querySelector("[data-replay-c]"), p = fig.querySelector("[data-replay-p]"), line = c && c.parentElement;
    const ticks = fig.querySelector("[data-replay-ticks]"), timeEl = fig.querySelector("[data-replay-time]");
    const btn = fig.querySelector("[data-replay-play]"), tabs = [...fig.querySelectorAll("[data-clip][role=tab]")];
    const audios = {}; fig.querySelectorAll("audio[data-clip]").forEach((a) => { audios[a.dataset.clip] = a; });
    let clip = tabs.length ? tabs[0].dataset.clip : Object.keys(data)[0];
    const show = (t, ended) => {
      const evs = data[clip] || []; let idx = -1;
      evs.forEach((e, i) => { if (e.t <= t + 0.02 && (e.final == null || ended)) idx = i; });
      const ev = idx >= 0 ? evs[idx] : null;
      const fin = ev && ev.final != null;
      c.textContent = ev ? (fin ? ev.final : ev.committed) : "";
      let k2 = 0; if (ev && !fin) { while (k2 < ev.committed.length && ev.partial[k2] === ev.committed[k2]) k2 += 1; }
      p.textContent = ev && !fin ? ev.partial.slice(k2) : "";
      line.classList.toggle("is-final", !!fin);
      [...ticks.children].forEach((s, i) => { s.className = i < idx ? "is-done" : i === idx ? (fin ? "is-done" : "is-now") : ""; });
      timeEl.textContent = `${t.toFixed(1)} s`;
    };
    const build = () => {
      ticks.innerHTML = ""; (data[clip] || []).forEach(() => ticks.appendChild(document.createElement("span")));
      const evs = data[clip] || []; const last = evs[evs.length - 1];
      show(last ? last.t : 0, true);   // before playing, show the final result
    };
    Object.entries(audios).forEach(([name, a]) => {
      a.addEventListener("timeupdate", () => { if (name === clip) show(a.currentTime, false); });
      a.addEventListener("play", () => { if (name === clip) { fig.classList.add("is-playing"); show(0, false); } });
      a.addEventListener("pause", () => fig.classList.remove("is-playing"));
      a.addEventListener("ended", () => { fig.classList.remove("is-playing"); if (name === clip) show(a.duration || 99, true); });
    });
    btn.addEventListener("click", () => {
      const a = audios[clip]; if (!a) return;
      if (a.paused) { if (a.ended || a.currentTime > 0 && a.currentTime >= (a.duration || 0) - .05) a.currentTime = 0; playOnly(a); } else a.pause();
    });
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      Object.values(audios).forEach((a) => { a.pause(); a.currentTime = 0; });
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab))); clip = tab.dataset.clip; build();
    }));
    build();
  });

  document.querySelectorAll("[data-asr-toggle]").forEach((fig) => {
    let states; try { states = JSON.parse(fig.dataset.states); } catch (e) { return; }
    const instr = fig.querySelector("[data-toggle-instr]"), out = fig.querySelector("[data-toggle-out]");
    const audio = fig.querySelector("audio"), btn = fig.querySelector("[data-toggle-play]");
    fig.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => {
      const v = Number(b.dataset.v);
      fig.querySelectorAll("[data-v]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      instr.textContent = states[v][0]; out.innerHTML = states[v][1];
      out.classList.remove("is-swap"); void out.offsetWidth; out.classList.add("is-swap");
    }));
    if (audio && btn) {
      btn.addEventListener("click", () => { if (audio.paused) playOnly(audio); else audio.pause(); });
      audio.addEventListener("play", () => fig.classList.add("is-playing"));
      audio.addEventListener("pause", () => fig.classList.remove("is-playing"));
      audio.addEventListener("ended", () => fig.classList.remove("is-playing"));
    }
  });
})();
