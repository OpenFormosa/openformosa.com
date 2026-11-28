// OpenFormosa — GA4 v2.1 Precision Analytics, Pain-Point & UX Friction Intelligence
// Covers:
// 1. Multi-Touch Session Attribution (shared with first-hit google-analytics.html; zero double counting)
// 2. Precision Time, Section Reading & Drop-Off Tracking (active-only timer, audio-aware idle,
//    fast-bounce capture, active bilingual post H2 dwell & last_section drop-off)
// 3. Full Conversion & Content Funnel (canonicalized model interest with accurate shipped/in_progress/planned
//    status, outbound asset classification, header/footer nav, code & prose copy, blog search + URL ?q= +
//    zero-result tag filters, post micro-feedback including quickstart/comprehension pain points)
// 4. Pain-Point & Demand Intelligence (pain-point selector, per-tag finalized votes, partial funnel,
//    form abandonment capture, pain-point & FAQ card engagement, privacy-safe PII scrubbing)
// 5. UX Friction & Reliability Diagnostics (rage clicks, dead clicks on non-interactive cards,
//    audio/image/clipboard failures, Core Web Vitals with Good/Needs-Improvement/Poor rating, 404 & JS errors)
//
// Note: Interactive UI handlers (Demand Poll & Post Feedback) ALWAYS initialize even when
// gtag is blocked by privacy extensions; only telemetry dispatch is gated on gtag/debug mode.

(function () {
  "use strict";

  // Persistent debug flag: ?debug_ga=1 enables console logging across navigation; ?debug_ga=0 disables.
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get("debug_ga");
  try {
    if (debugParam === "1") localStorage.setItem("openformosa_debug_ga", "1");
    else if (debugParam === "0") localStorage.removeItem("openformosa_debug_ga");
  } catch (e) {}

  let isDebug = debugParam === "1";
  try {
    if (!isDebug && localStorage.getItem("openformosa_debug_ga") === "1") isDebug = true;
  } catch (e) {}

  const hasGtag = typeof window.gtag === "function";
  const trackingEnabled = hasGtag || isDebug;

  // Keep a lightweight in-memory debug ring buffer when ?debug_ga=1 for automated & manual QA
  if (isDebug) {
    window.__OF_GA_EVENTS__ = window.__OF_GA_EVENTS__ || [];
  }

  function emitGtag(command, action, params) {
    if (isDebug) {
      window.__OF_GA_EVENTS__.push({ command, action, params: Object.assign({}, params), ts: Date.now() });
      console.log("[GA4 Debug]", command, action, params);
    }
    if (typeof window.gtag === "function") {
      window.gtag(command, action, params);
    }
  }

  const body = document.body;
  const PAGE_KEY = (body && body.dataset && body.dataset.pageKey) || "unknown";
  const PAGE_TYPE = (body && body.dataset && body.dataset.pageType) || "page";

  function language() {
    try {
      const api = window.OpenFormosaI18n;
      if (api && typeof api.getLanguage === "function") return api.getLanguage();
    } catch (error) {}
    return document.documentElement.lang || "zh-Hant";
  }

  function i18nText(key, fallback) {
    try {
      const api = window.OpenFormosaI18n;
      if (api && typeof api.text === "function") return api.text(key, fallback);
    } catch (error) {}
    return fallback;
  }

  // Privacy-safe text scrubbing & GA4 length enforcement
  function sanitizeText(raw, maxLen) {
    const limit = maxLen || 100;
    if (raw == null) return "";
    let text = String(raw).replace(/\s+/g, " ").trim();
    // Strip emails, Taiwan mobile/landline numbers, Taiwan National IDs, long digit sequences
    text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
    text = text.replace(/(?:\+?886|0)[-\s]?9\d{2}[-\s]?\d{3}[-\s]?\d{3}/g, "[phone]");
    text = text.replace(/(?:\+?886|0)[-\s]?[2-8][-\s]?\d{3,4}[-\s]?\d{4}/g, "[phone]");
    text = text.replace(/\b[A-Za-z][1289]\d{8}\b/g, "[id]");
    text = text.replace(/\b\d{13,19}\b/g, "[number]");
    return text.slice(0, limit);
  }

  // Comma-boundary truncation so user_properties (<= 36 chars) never chop mid-tag
  function trimTagList(tags, maxLen) {
    if (!Array.isArray(tags) || !tags.length) return "";
    let out = "";
    for (let i = 0; i < tags.length; i += 1) {
      const t = String(tags[i] || "").trim();
      if (!t) continue;
      const next = out ? `${out},${t}` : t;
      if (next.length > maxLen) break;
      out = next;
    }
    return out || String(tags[0] || "").slice(0, maxLen);
  }

  // Canonicalize model names across zh-Hant / en / URLs so GA4 reports never fragment
  function canonicalModelName(raw) {
    if (!raw) return null;
    const s = String(raw).toLowerCase();
    // Check combined multimodal adapters FIRST so "ASR / TTS / OCR adapters" never misclassifies as TTS
    if (/asr\s*\/\s*tts\s*\/\s*ocr|multimodal.*adapter/.test(s)) return "Multimodal-Adapters";
    if (/barbet|五色鳥|記住台灣|記得住|base_1b|1b\s*(?:base|compact|backbone)|openformosa-base|long[_\s-]?context|128k\s*[→~-]\s*1m|core\s*·\s*backbone/.test(s)) return "Barbet";
    if (/blue\s*magpie|藍鵲|說出台灣|說得出|\btts\b/.test(s)) return "BlueMagpie-TTS";
    if (/pangolin|穿山甲|ubitok|tokenizer|斷詞器/.test(s)) return "PangolinTokenizer";
    if (/black\s*bear|黑熊|聽懂台灣|聽得懂|\basr\b/.test(s)) return "BlackBear-ASR";
    if (/sika\s*deer|梅花鹿|讀懂台灣|讀得懂|\bocr\b/.test(s)) return "SikaDeer-OCR";
    return null;
  }

  const CANONICAL_MODEL_STATUS = {
    Barbet: "shipped",
    "BlueMagpie-TTS": "shipped",
    PangolinTokenizer: "shipped",
    "BlackBear-ASR": "shipped",
    "SikaDeer-OCR": "planned",
    "Multimodal-Adapters": "in_progress"
  };

  function resolveModelStatus(cardEl, canonModel) {
    const statusBadge = cardEl && cardEl.querySelector ? cardEl.querySelector(".status-badge") : null;
    if (statusBadge) {
      if (statusBadge.classList.contains("is-planned")) return "planned";
      if (statusBadge.classList.contains("is-progress")) return "in_progress";
      if (statusBadge.classList.contains("is-shipped")) return "shipped";
    }
    if (canonModel && CANONICAL_MODEL_STATUS[canonModel]) {
      return CANONICAL_MODEL_STATUS[canonModel];
    }
    return "unknown";
  }

  function resolveSectionName(el) {
    if (!el || !el.closest) return "body";
    const explicit = el.closest("[data-demand-poll], [data-post-feedback], [data-tts-demo], #faq, #status");
    if (explicit) {
      if (explicit.hasAttribute("data-demand-poll")) return "demand_poll_widget";
      if (explicit.hasAttribute("data-post-feedback")) return "post_feedback_widget";
      if (explicit.hasAttribute("data-tts-demo")) return "tts_listening_demo";
      if (explicit.id === "faq") return "home_faq";
      if (explicit.id === "status") return "status_board";
    }
    const section = el.closest("section, article, header, footer");
    if (!section) return "body";
    return sanitizeText(section.id || (section.className && String(section.className).split(" ")[0]) || section.tagName.toLowerCase(), 40);
  }

  function getViewportClass() {
    const w = window.innerWidth || (window.screen && window.screen.width) || 1024;
    if (w < 768) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  }

  function getNetworkType() {
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return (conn && conn.effectiveType) || "unknown";
    } catch (e) {
      return "unknown";
    }
  }

  function setUserProps(props) {
    if (!trackingEnabled || !props) return;
    const clean = {};
    let hasKeys = false;
    Object.keys(props).forEach((key) => {
      if (props[key] != null && props[key] !== "") {
        clean[key] = String(props[key]).slice(0, 36);
        hasKeys = true;
      }
    });
    if (hasKeys) {
      emitGtag("set", "user_properties", clean);
    }
  }

  // ==========================================
  // 1. Multi-Touch Session Attribution & Depth
  // ==========================================
  function classifyReferrer(refStr) {
    if (!refStr) return { domain: "(direct)", category: "direct" };
    try {
      const refUrl = new URL(refStr);
      const host = refUrl.hostname.toLowerCase();
      if (host === window.location.hostname.toLowerCase()) {
        return { domain: host, category: "internal" };
      }
      if (/chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|you\.com|phind\.com/i.test(host)) {
        return { domain: host, category: "ai_search" };
      }
      if (/google\.|bing\.com|yahoo\.|duckduckgo\.com|baidu\.com|ecosia\.org|kagi\.com/i.test(host)) {
        return { domain: host, category: "search" };
      }
      if (/github\.com|gist\.github\.com/i.test(host)) {
        return { domain: host, category: "github" };
      }
      if (/huggingface\.co|hf\.co/i.test(host)) {
        return { domain: host, category: "huggingface" };
      }
      if (/discord\.gg|discord\.com|discordapp\.com/i.test(host)) {
        return { domain: host, category: "discord" };
      }
      if (/ptt\.cc|dcard\.tw|plurk\.com|ithome\.com\.tw|bahamut\.com\.tw|mobile01\.com|disp\.cc|line\.me/i.test(host)) {
        return { domain: host, category: "taiwan_community" };
      }
      if (/news\.ycombinator\.com|lobste\.rs|medium\.com|substack\.com|dev\.to|qiita\.com|zenn\.dev|v2ex\.com|juejin\.cn|zhihu\.com/i.test(host)) {
        return { domain: host, category: "tech_community" };
      }
      if (/twitter\.com|t\.co|x\.com|threads\.net|facebook\.com|fb\.com|instagram\.com|linkedin\.com|lnkd\.in|reddit\.com|bsky\.app|youtube\.com|youtu\.be/i.test(host)) {
        return { domain: host, category: "social" };
      }
      return { domain: host, category: "referral" };
    } catch (e) {
      return { domain: "(unknown)", category: "referral" };
    }
  }

  function initSessionAttribution() {
    // Reuse pre-computed context from google-analytics.html so session_page_depth is never double-incremented
    if (window.__OF_GA_CTX__ && window.__OF_GA_CTX__.session) {
      return window.__OF_GA_CTX__;
    }

    const ref = classifyReferrer(document.referrer);
    const current = {
      utm_source: urlParams.get("utm_source") || undefined,
      utm_medium: urlParams.get("utm_medium") || undefined,
      utm_campaign: urlParams.get("utm_campaign") || undefined,
      utm_content: urlParams.get("utm_content") || undefined,
      utm_term: urlParams.get("utm_term") || undefined,
      referrer_domain: ref.domain,
      referrer_category: ref.category
    };

    let sessionAcq = null;
    let sessionDepth = 1;
    try {
      const prevDepth = parseInt(sessionStorage.getItem("openformosa_session_depth") || "0", 10) || 0;
      sessionDepth = prevDepth + 1;
      sessionStorage.setItem("openformosa_session_depth", String(sessionDepth));

      const rawSaved = sessionStorage.getItem("openformosa_session_acq_v2");
      if (rawSaved) {
        sessionAcq = JSON.parse(rawSaved);
      }
      if (!sessionAcq || current.utm_source || (sessionAcq.entry_referrer_category === "direct" && current.referrer_category !== "internal" && current.referrer_category !== "direct")) {
        sessionAcq = {
          entry_referrer_category: current.referrer_category === "internal" ? "direct" : current.referrer_category,
          entry_referrer_domain: current.referrer_category === "internal" ? "(direct)" : current.referrer_domain,
          entry_utm_source: current.utm_source || (sessionAcq && sessionAcq.entry_utm_source) || undefined,
          entry_utm_medium: current.utm_medium || (sessionAcq && sessionAcq.entry_utm_medium) || undefined,
          entry_utm_campaign: current.utm_campaign || (sessionAcq && sessionAcq.entry_utm_campaign) || undefined,
          landing_page_key: (sessionAcq && sessionAcq.landing_page_key) || PAGE_KEY
        };
        sessionStorage.setItem("openformosa_session_acq_v2", JSON.stringify(sessionAcq));
      }
    } catch (e) {
      sessionAcq = {
        entry_referrer_category: current.referrer_category === "internal" ? "direct" : current.referrer_category,
        entry_referrer_domain: current.referrer_category === "internal" ? "(direct)" : current.referrer_domain,
        entry_utm_source: current.utm_source,
        entry_utm_medium: current.utm_medium,
        entry_utm_campaign: current.utm_campaign,
        landing_page_key: PAGE_KEY
      };
    }

    return { current, session: sessionAcq, sessionDepth };
  }

  const attribution = initSessionAttribution();
  const viewportClass = getViewportClass();
  const pageLoadTime = Date.now();
  let interactionCount = 0;

  // Refresh dynamic user properties on page load
  try {
    const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setUserProps({
      viewport_class: viewportClass,
      preferred_theme: document.documentElement.dataset.theme || (isDark ? "dark" : "light"),
      browser_language: navigator.language || "unknown",
      ui_language: language(),
      hardware_concurrency: String(navigator.hardwareConcurrency || "unknown"),
      network_type: getNetworkType(),
      touch_support: String(("ontouchstart" in window) || (navigator.maxTouchPoints > 0)),
      reduced_motion: String(Boolean(reducedMotion))
    });
  } catch (e) {}

  // Unified event dispatch
  function track(name, params, options) {
    if (!trackingEnabled) return;
    const payload = {
      page_key: PAGE_KEY,
      page_type: PAGE_TYPE,
      content_language: language(),
      referrer_category: attribution.current.referrer_category,
      entry_referrer_category: attribution.session.entry_referrer_category,
      entry_referrer_domain: attribution.session.entry_referrer_domain,
      landing_page_key: attribution.session.landing_page_key,
      session_page_depth: attribution.sessionDepth
    };
    const utmSource = attribution.current.utm_source || attribution.session.entry_utm_source;
    const utmCampaign = attribution.current.utm_campaign || attribution.session.entry_utm_campaign;
    if (utmSource) payload.utm_source = sanitizeText(utmSource, 100);
    if (utmCampaign) payload.utm_campaign = sanitizeText(utmCampaign, 100);

    if (params) {
      Object.keys(params).forEach((key) => {
        const val = params[key];
        if (val != null && val !== "") {
          payload[key] = typeof val === "string" ? sanitizeText(val, 100) : val;
        }
      });
    }
    if (options && options.beacon) {
      payload.transport_type = "beacon";
    }
    emitGtag("event", name, payload);
  }

  // ==========================================
  // 2. Dynamic Persona, Model Interest & Engagement Scoring
  // ==========================================
  let intentState = {
    personas: { developer: 0, researcher: 0, enterprise: 0, speech_creator: 0 },
    models: {},
    points: 0,
    topPersona: null,
    topModel: null,
    tier: "casual"
  };

  try {
    const saved = localStorage.getItem("openformosa_intent_v2");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        intentState = Object.assign(intentState, parsed);
        intentState.personas = Object.assign({ developer: 0, researcher: 0, enterprise: 0, speech_creator: 0 }, parsed.personas || {});
        intentState.models = Object.assign({}, parsed.models || {});
      }
    }
  } catch (e) {}

  function recordIntent(opts) {
    if (!opts) return;
    if (opts.persona && Object.prototype.hasOwnProperty.call(intentState.personas, opts.persona)) {
      intentState.personas[opts.persona] += (opts.weight || 1);
    }
    if (opts.model) {
      const canon = canonicalModelName(opts.model) || opts.model;
      intentState.models[canon] = (intentState.models[canon] || 0) + (opts.modelWeight || 1);
    }
    intentState.points += (opts.engagement || 1);

    // Recompute top persona
    let bestPersona = null;
    let bestPScore = 1; // threshold >= 2 to assign a specific persona
    Object.keys(intentState.personas).forEach((p) => {
      if (intentState.personas[p] > bestPScore) {
        bestPScore = intentState.personas[p];
        bestPersona = p;
      }
    });
    const nextPersona = bestPersona || "explorer";

    // Recompute top model
    let bestModel = null;
    let bestMScore = 0;
    Object.keys(intentState.models).forEach((m) => {
      if (intentState.models[m] > bestMScore) {
        bestMScore = intentState.models[m];
        bestModel = m;
      }
    });

    const nextTier = intentState.points >= 15 ? "power_user" : (intentState.points >= 5 ? "engaged" : "casual");

    const updates = {};
    if (nextPersona !== intentState.topPersona) {
      intentState.topPersona = nextPersona;
      updates.user_persona = nextPersona;
    }
    if (bestModel && bestModel !== intentState.topModel) {
      intentState.topModel = bestModel;
      updates.primary_model_interest = bestModel;
    }
    if (nextTier !== intentState.tier) {
      intentState.tier = nextTier;
      updates.engagement_tier = nextTier;
    }

    try {
      localStorage.setItem("openformosa_intent_v2", JSON.stringify(intentState));
    } catch (e) {}

    if (Object.keys(updates).length) {
      setUserProps(updates);
    }
  }

  // Passive page-level intent signals
  if (PAGE_KEY === "evaluation" || PAGE_KEY === "form_training_data") {
    recordIntent({ persona: "researcher", weight: 2, engagement: 1 });
  } else if (PAGE_KEY === "training") {
    recordIntent({ persona: "developer", weight: 2, engagement: 1 });
  } else if (PAGE_KEY === "barbet" || PAGE_KEY === "barbet_1m") {
    recordIntent({ persona: "researcher", weight: 1, model: "Barbet", modelWeight: 2, engagement: 1 });
  } else if (PAGE_KEY === "bluemagpie") {
    recordIntent({ persona: "speech_creator", weight: 1, model: "BlueMagpie-TTS", modelWeight: 2, engagement: 1 });
  } else if (PAGE_KEY === "pangolin") {
    recordIntent({ persona: "developer", weight: 1, model: "PangolinTokenizer", modelWeight: 2, engagement: 1 });
  }

  // Time to First Meaningful Action
  let firstActionSent = false;
  function recordFirstAction(actionName) {
    interactionCount += 1;
    if (firstActionSent) return;
    firstActionSent = true;
    const ttfa = Math.max(0, Math.round((Date.now() - pageLoadTime) / 1000));
    track("first_meaningful_action", {
      action_name: actionName,
      ttfa_seconds: ttfa
    });
  }

  // ==========================================
  // 3. Language & Theme Switching
  // ==========================================
  document.querySelectorAll("[data-lang-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const to = btn.dataset.langOption;
      const from = language();
      if (!to || to === from) return;
      emitGtag("set", { language: to, content_language: to });
      setUserProps({ ui_language: to });
      recordFirstAction("language_switch");
      track("language_switch", {
        from_language: from,
        to_language: to,
        language_direction: `${from}->${to}`,
        seconds_since_load: Math.max(0, Math.round((Date.now() - pageLoadTime) / 1000))
      });
    });
  });

  let currentTheme = document.documentElement.dataset.theme || "light";
  window.addEventListener("openformosa:theme", (event) => {
    const nextTheme = event && event.detail && event.detail.theme;
    if (!nextTheme || nextTheme === currentTheme) return;
    const prevTheme = currentTheme;
    currentTheme = nextTheme;
    setUserProps({ preferred_theme: nextTheme });
    recordFirstAction("theme_switch");
    track("theme_switch", {
      theme: nextTheme,
      from_theme: prevTheme,
      to_theme: nextTheme
    });
  });

  // ==========================================
  // 4. Precision Active Time, Audio-Aware Idle & Read Quality
  // ==========================================
  let activeSeconds = 0;
  let lastFlushedActiveSeconds = 0;
  let hasFlushedDwellOnce = false;
  let isTabActive = document.visibilityState === "visible";
  let userLastInteracted = Date.now();
  let maxScroll = 0;
  let lastSectionName = PAGE_TYPE === "post" ? "post_intro" : "hero";

  function onUserActivity() {
    userLastInteracted = Date.now();
  }
  ["mousemove", "keydown", "scroll", "touchstart", "click", "wheel"].forEach((evt) => {
    window.addEventListener(evt, onUserActivity, { passive: true });
  });

  function isAnyAudioPlaying() {
    const audios = document.querySelectorAll("audio, video");
    for (let i = 0; i < audios.length; i += 1) {
      if (!audios[i].paused && !audios[i].ended) return true;
    }
    return false;
  }

  function estimateReadSeconds() {
    if (PAGE_TYPE !== "post") return null;
    const activeSelector = language() === "en" ? ".post-lang-en" : ".post-lang-zh";
    const container = document.querySelector(activeSelector) || document.querySelector(".post-body");
    if (!container) return null;
    const text = (container.textContent || "").trim();
    if (!text) return null;
    const cjkMatches = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
    const cjkCount = cjkMatches ? cjkMatches.length : 0;
    const nonCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ");
    const wordMatches = nonCjk.match(/[A-Za-z0-9_]+/g);
    const wordCount = wordMatches ? wordMatches.length : 0;
    return Math.max(30, Math.round((cjkCount / 350 + wordCount / 220) * 60));
  }

  function classifyReadQuality(totalSec, scrollPct, estSec) {
    if (totalSec < 10 && scrollPct < 25) return "bounce";
    if (estSec) {
      const ratio = totalSec / estSec;
      if (scrollPct >= 50 && ratio < 0.2) return "skim";
      if (ratio >= 0.8 && scrollPct >= 85) return "complete_read";
      if (ratio >= 0.5 && scrollPct >= 60) return "deep_read";
      return totalSec >= 15 ? "partial_read" : "skim";
    }
    if (totalSec >= 120 && scrollPct >= 75) return "deep_read";
    if (totalSec >= 30) return "engaged_visit";
    return scrollPct >= 50 ? "skim" : "brief_visit";
  }

  // Active-only section dwell registry
  const sectionStates = new Map();

  function flushSectionDwell(el, useBeacon) {
    const state = sectionStates.get(el);
    if (!state) return;
    if (state.activeDwell >= 3) {
      track("section_dwell", {
        section_name: state.name,
        dwell_seconds: state.activeDwell
      }, { beacon: Boolean(useBeacon) });
      if (state.onDwell) state.onDwell(state.activeDwell);
    }
    state.activeDwell = 0;
  }

  function flushAllVisibleSections(useBeacon) {
    sectionStates.forEach((state, el) => {
      if (state.activeDwell >= 3) {
        flushSectionDwell(el, useBeacon);
      }
    });
  }

  // Active reading-section tracker for long bilingual blog posts (measures actual section reading & drop-off!)
  let activePostSection = PAGE_TYPE === "post" ? "post_intro" : null;
  let activePostSectionDwell = 0;
  let cachedPostHeadings = [];

  function refreshPostHeadings() {
    if (PAGE_TYPE !== "post") return;
    const selector = language() === "en" ? ".post-lang-en h2" : ".post-lang-zh h2";
    const found = [...document.querySelectorAll(selector)];
    cachedPostHeadings = found.length ? found : [...document.querySelectorAll(".post-body h2")];
  }

  function computeCurrentPostSection() {
    if (PAGE_TYPE !== "post") return null;
    if (!cachedPostHeadings.length) refreshPostHeadings();
    const threshold = Math.max(120, Math.round((window.innerHeight || 720) * 0.35));
    let current = "post_intro";
    for (let i = 0; i < cachedPostHeadings.length; i += 1) {
      const h2 = cachedPostHeadings[i];
      const rect = h2.getBoundingClientRect();
      if (rect.height === 0 && rect.width === 0) continue; // hidden language container
      if (rect.top <= threshold) {
        const headingText = sanitizeText(h2.textContent || "", 36);
        current = `post_h2_${i + 1}_${headingText}`.slice(0, 60);
      } else {
        break;
      }
    }
    return current;
  }

  function flushActivePostSection(useBeacon) {
    if (PAGE_TYPE !== "post" || !activePostSection) return;
    if (activePostSectionDwell >= 3) {
      track("section_dwell", {
        section_name: activePostSection,
        dwell_seconds: activePostSectionDwell
      }, { beacon: Boolean(useBeacon) });
    }
    activePostSectionDwell = 0;
  }

  function syncActivePostSection() {
    if (PAGE_TYPE !== "post") return;
    const next = computeCurrentPostSection();
    if (!next) return;
    lastSectionName = next;
    if (next !== activePostSection) {
      flushActivePostSection(false);
      activePostSection = next;
    }
  }

  if (PAGE_TYPE === "post") {
    refreshPostHeadings();
    window.addEventListener("openformosa:language", () => {
      flushActivePostSection(false);
      refreshPostHeadings();
      activePostSection = computeCurrentPostSection() || "post_intro";
      lastSectionName = activePostSection;
    });
  }

  function flushDwellSummary(useBeacon) {
    const delta = activeSeconds - lastFlushedActiveSeconds;
    const wallSeconds = Math.round((Date.now() - pageLoadTime) / 1000);
    // On first flush, capture even fast bounces (>= 1s active or >= 2s wall) so bounce pain points aren't blind!
    if (!hasFlushedDwellOnce) {
      if (delta < 1 && wallSeconds < 2) return;
    } else if (delta < 3) {
      return;
    }

    hasFlushedDwellOnce = true;
    lastFlushedActiveSeconds = activeSeconds;
    const estSec = estimateReadSeconds();
    const readRatioPct = estSec ? Math.min(200, Math.round((activeSeconds / estSec) * 100)) : undefined;
    const readQuality = classifyReadQuality(activeSeconds, maxScroll, estSec);

    // Emit additive delta in `active_seconds` so GA4 sums accurately with zero double counting!
    track("page_dwell_summary", {
      active_seconds: delta,
      cumulative_active_seconds: activeSeconds,
      total_wall_seconds: wallSeconds,
      max_scroll_depth: maxScroll,
      read_quality: readQuality,
      estimated_read_seconds: estSec || undefined,
      read_ratio_percent: readRatioPct,
      interactions_count: interactionCount,
      last_section: lastSectionName || undefined
    }, { beacon: Boolean(useBeacon) });
  }

  // Core Web Vitals accumulator (flushed alongside exit/hidden)
  const vitals = { lcp: null, cls: 0, inp: null, flushed: false };

  function initWebVitals() {
    if (typeof PerformanceObserver !== "function") return;
    try {
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) vitals.lcp = Math.round(entries[entries.length - 1].startTime);
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    } catch (e) {}

    try {
      const clsObs = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) vitals.cls += entry.value;
        });
      });
      clsObs.observe({ type: "layout-shift", buffered: true });
    } catch (e) {}

    try {
      const inpObs = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          const dur = Math.round(entry.duration || 0);
          if (dur > 0 && (vitals.inp === null || dur > vitals.inp)) vitals.inp = dur;
        });
      });
      inpObs.observe({ type: "event", buffered: true, durationThreshold: 40 });
    } catch (e) {}
  }
  initWebVitals();

  function classifyVitalsRating(lcp, cls, inp) {
    if ((lcp != null && lcp > 4000) || (inp != null && inp > 500) || cls > 0.25) return "poor";
    if ((lcp != null && lcp > 2500) || (inp != null && inp > 200) || cls > 0.1) return "needs_improvement";
    return "good";
  }

  function flushWebVitals(useBeacon) {
    if (vitals.flushed) return;
    vitals.flushed = true;
    let ttfb = undefined;
    let domLoaded = undefined;
    try {
      const navEntries = performance.getEntriesByType && performance.getEntriesByType("navigation");
      if (navEntries && navEntries[0]) {
        const nav = navEntries[0];
        if (nav.responseStart > 0) ttfb = Math.round(nav.responseStart);
        if (nav.domContentLoadedEventEnd > 0) domLoaded = Math.round(nav.domContentLoadedEventEnd);
      }
    } catch (e) {}

    if (vitals.lcp == null && ttfb == null && domLoaded == null) return;
    track("web_vitals_summary", {
      lcp_ms: vitals.lcp != null ? vitals.lcp : undefined,
      cls_x1000: Math.round(vitals.cls * 1000),
      inp_ms: vitals.inp != null ? vitals.inp : undefined,
      ttfb_ms: ttfb,
      dom_loaded_ms: domLoaded,
      vitals_rating: classifyVitalsRating(vitals.lcp, vitals.cls, vitals.inp)
    }, { beacon: Boolean(useBeacon) });
  }

  // Forward declaration for demand poll abandonment flush on exit
  let flushDemandAbandon = null;

  function flushAllOnExit() {
    flushActivePostSection(true);
    flushAllVisibleSections(true);
    flushDwellSummary(true);
    flushWebVitals(true);
    if (typeof flushDemandAbandon === "function") flushDemandAbandon();
  }

  document.addEventListener("visibilitychange", () => {
    isTabActive = document.visibilityState === "visible";
    if (!isTabActive) {
      flushAllOnExit();
    } else {
      userLastInteracted = Date.now();
    }
  });

  window.addEventListener("pagehide", () => {
    flushAllOnExit();
  });

  // Reading Milestones (uses `milestone_seconds` instead of `active_seconds` to prevent GA4 metric double-summing)
  const timeMilestones = [
    { sec: 15, label: "15s_skimmer" },
    { sec: 30, label: "30s_viewer" },
    { sec: 60, label: "60s_engaged_reader" },
    { sec: 120, label: "2min_deep_reader" },
    { sec: 300, label: "5min_thorough_reader" },
    { sec: 600, label: "10min_super_user" }
  ];
  const passedMilestones = new Set();

  setInterval(() => {
    const now = Date.now();
    const activelyReading = isTabActive && (now - userLastInteracted < 45000 || isAnyAudioPlaying());
    if (!activelyReading) return;

    activeSeconds += 1;

    // Increment active dwell for currently visible sections
    sectionStates.forEach((state) => {
      if (state.visible) state.activeDwell += 1;
    });

    if (PAGE_TYPE === "post") {
      syncActivePostSection();
      activePostSectionDwell += 1;
    }

    timeMilestones.forEach(({ sec, label }) => {
      if (activeSeconds >= sec && !passedMilestones.has(sec)) {
        passedMilestones.add(sec);
        if (sec === 60) recordIntent({ engagement: 2 });
        if (sec === 120 && PAGE_TYPE === "post") recordIntent({ persona: "researcher", weight: 2, engagement: 3 });

        track("engagement_time_milestone", {
          milestone_seconds: sec,
          milestone_label: label,
          max_scroll_depth: maxScroll
        });
      }
    });
  }, 1000);

  // ==========================================
  // 5. Granular Scroll Depth (rAF-throttled)
  // ==========================================
  const scrollMilestones = [25, 50, 75, 90, 100];
  const triggeredScrolls = new Set();
  let scrollTicking = false;

  function checkScroll() {
    scrollTicking = false;
    const h = document.documentElement;
    const b = document.body;
    const st = window.pageYOffset || h.scrollTop || (b ? b.scrollTop : 0) || 0;
    const sh = Math.max(h.scrollHeight, b ? b.scrollHeight : 0);
    const ch = h.clientHeight || window.innerHeight || 1;
    const scrollable = Math.max(1, sh - ch);
    const scrollPercent = Math.min(100, Math.round((st / scrollable) * 100));

    if (scrollPercent > maxScroll) maxScroll = scrollPercent;

    if (PAGE_TYPE === "post") {
      syncActivePostSection();
    }

    scrollMilestones.forEach((m) => {
      if (scrollPercent >= m && !triggeredScrolls.has(m)) {
        triggeredScrolls.add(m);
        const timeToScroll = Math.round((Date.now() - pageLoadTime) / 1000);
        track("scroll_milestone", {
          scroll_depth_threshold: m,
          time_to_scroll_seconds: timeToScroll,
          active_seconds_at_scroll: activeSeconds
        });
      }
    });
  }

  window.addEventListener("scroll", () => {
    if (!scrollTicking) {
      scrollTicking = true;
      (window.requestAnimationFrame || setTimeout)(checkScroll, 16);
    }
  }, { passive: true });

  // ==========================================
  // 6. Multi-Element Section Dwell & Demand Poll View
  // ==========================================
  let demandPollViewed = false;

  if ("IntersectionObserver" in window) {
    const sectionRules = [
      { selector: ".hero, .page-hero", name: "hero" },
      { selector: ".status-board", name: "status_board" },
      { selector: ".promise-grid", name: "promise_grid" },
      { selector: ".mission", name: "mission_statement" },
      { selector: ".problem-grid", name: "problem_gaps" },
      { selector: ".family-grid", name: "model_family" },
      { selector: ".scenario-grid", name: "target_scenarios" },
      { selector: ".open-trust", name: "open_source_trust" },
      { selector: ".timeline", name: PAGE_KEY === "evaluation" ? "evaluation_workflow" : "roadmap_timeline" },
      { selector: ".spec-list", name: "tech_specifications" },
      { selector: ".directory-grid", name: "beliefs_or_tracks" },
      { selector: ".symbol-grid", name: "about_symbols" },
      { selector: ".callout", name: "core_callout" },
      { selector: ".soft-panel", name: "detail_panel" },
      { selector: ".release-panel", name: "release_gates" },
      { selector: ".blog-tools", name: "blog_search_tools" },
      { selector: ".article-strip", name: "blog_article_list" },
      { selector: "[data-tts-demo]", name: "tts_listening_demo" },
      { selector: ".prose .highlighter-rouge", name: "code_implementation" },
      { selector: "#faq", name: "home_faq" },
      { selector: ".manifesto", name: "manifesto_vision" },
      { selector: "[data-post-feedback]", name: "post_feedback_widget" },
      { selector: "[data-demand-poll]", name: "demand_poll_widget" }
    ];

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        const state = sectionStates.get(el);
        if (!state) return;

        if (entry.isIntersecting) {
          state.visible = true;
          if (PAGE_TYPE !== "post") {
            lastSectionName = state.name;
          }
          if (state.name === "demand_poll_widget" && !demandPollViewed) {
            demandPollViewed = true;
            track("demand_poll_view", { active_seconds_at_view: activeSeconds });
          }
        } else {
          state.visible = false;
          flushSectionDwell(el, false);
        }
      });
    }, { threshold: 0.2 });

    sectionRules.forEach(({ selector, name }) => {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((el, idx) => {
        if (sectionStates.has(el)) return;
        const label = nodes.length > 1 ? `${name}_${idx + 1}` : name;
        sectionStates.set(el, { name: label, visible: false, activeDwell: 0 });
        sectionObserver.observe(el);
      });
    });

    // Observe Phase 5 Enterprise Private Deployment card specifically on Roadmap
    if (PAGE_KEY === "roadmap") {
      const phase5 = document.querySelector(".timeline-card:nth-child(6)");
      if (phase5) {
        sectionStates.set(phase5, {
          name: "roadmap_phase5_enterprise",
          visible: false,
          activeDwell: 0,
          onDwell: (sec) => {
            if (sec >= 4) {
              recordIntent({ persona: "enterprise", weight: 3, engagement: 2 });
              track("enterprise_intent", {
                action: "dwell_phase5_private_deployment",
                section_name: "roadmap_phase5_enterprise",
                dwell_seconds: sec
              });
            }
          }
        });
        sectionObserver.observe(phase5);
      }
    }
  }

  // ==========================================
  // 7. Categorized Outbound Traffic & Core Funnels
  // ==========================================
  function categorizeOutbound(urlStr) {
    try {
      const url = new URL(urlStr, window.location.href);
      const host = url.hostname.toLowerCase();
      const path = url.pathname;

      if (host.includes("huggingface.co") || host === "hf.co") {
        if (path.includes("/spaces/")) {
          const segs = path.split("/spaces/")[1]?.split("/").filter(Boolean) || [];
          const spaceName = segs[1] || segs[0] || "space";
          return { category: "huggingface_demo", asset: spaceName };
        }
        if (path.includes("/datasets/")) {
          const segs = path.split("/datasets/")[1]?.split("/").filter(Boolean) || [];
          return { category: "huggingface_dataset", asset: segs[1] || segs[0] || "dataset" };
        }
        if (/\/OpenFormosa\//i.test(path)) {
          const modelName = path.split(/\/OpenFormosa\//i)[1]?.split("/")[0] || "model";
          return { category: "huggingface_model", asset: modelName };
        }
        return { category: "huggingface_org", asset: "OpenFormosa" };
      }
      if (host.includes("github.com")) {
        if (/\/OpenFormosa\//i.test(path)) {
          const repoName = path.split(/\/OpenFormosa\//i)[1]?.split("/")[0] || "repo";
          return { category: "github_repo", asset: repoName };
        }
        const segs = path.split("/").filter(Boolean);
        if (segs.length >= 2) {
          return { category: "github_external", asset: `${segs[0]}/${segs[1]}` };
        }
        return { category: "github_org", asset: "OpenFormosa" };
      }
      if (host.includes("discord.gg") || host.includes("discord.com")) {
        return { category: "discord_community", asset: "Discord-Server" };
      }
      if (/arxiv\.org|openreview\.net|aclanthology\.org|paperswithcode\.com/i.test(host)) {
        return { category: "research_paper", asset: path.split("/").filter(Boolean).pop() || host };
      }
      return { category: "external_link", asset: host };
    } catch (e) {
      return { category: "external_link", asset: "unknown" };
    }
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link || !link.href) return;

    const href = link.href;
    let parsedUrl = null;
    try {
      parsedUrl = new URL(href, window.location.href);
    } catch (e) {
      return;
    }

    const isHttp = parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
    const isOutbound = isHttp && parsedUrl.hostname.toLowerCase() !== window.location.hostname.toLowerCase();

    if (isOutbound) {
      const parsed = categorizeOutbound(href);
      const sectionName = resolveSectionName(link);
      const canonModel = canonicalModelName(parsed.asset) || canonicalModelName(href) || canonicalModelName(link.textContent);

      recordFirstAction(`outbound_${parsed.category}`);
      track("outbound_click", {
        link_url: href,
        link_domain: parsedUrl.hostname,
        link_text: sanitizeText(link.textContent || link.getAttribute("aria-label") || "", 100),
        outbound_category: parsed.category,
        target_asset: parsed.asset,
        model_name: canonModel || undefined,
        source_section: sectionName
      }, { beacon: true });

      // High-intent conversion event triggers + persona scoring
      if (parsed.category === "huggingface_model" || parsed.category === "huggingface_demo" || parsed.category === "huggingface_dataset") {
        recordIntent({
          persona: parsed.category === "huggingface_demo" ? "speech_creator" : "developer",
          weight: 3,
          model: canonModel || parsed.asset,
          modelWeight: 4,
          engagement: 4
        });
        track("model_interest", {
          model_name: canonModel || parsed.asset,
          target_asset: parsed.asset,
          model_status: CANONICAL_MODEL_STATUS[canonModel] || "shipped",
          interest_type: parsed.category === "huggingface_demo" ? "demo_try" : "weights_view",
          source_section: sectionName,
          outbound_url: href
        }, { beacon: true });
      } else if (parsed.category === "github_repo") {
        recordIntent({
          persona: "developer",
          weight: 3,
          model: canonModel || undefined,
          modelWeight: 3,
          engagement: 4
        });
        track("developer_intent", {
          target_asset: parsed.asset,
          model_name: canonModel || undefined,
          source_section: sectionName,
          action: "view_repo"
        }, { beacon: true });
      } else if (parsed.category === "discord_community") {
        recordIntent({ engagement: 4 });
        track("community_intent", {
          channel: "discord",
          source_section: sectionName,
          action: "join_community"
        }, { beacon: true });
      } else if (parsed.category === "research_paper") {
        recordIntent({ persona: "researcher", weight: 3, engagement: 3 });
      }
    }
  });

  // ==========================================
  // 8. Internal CTAs, Navigation, Pain-Point Cards & Content Cards
  // ==========================================
  function resolveCtaKey(el) {
    if (!el) return "unknown";
    if (el.dataset && el.dataset.gaCta) return el.dataset.gaCta;
    if (el.dataset && el.dataset.i18n) return el.dataset.i18n;
    const childI18n =
      (el.querySelector && (el.querySelector("em[data-i18n]") || el.querySelector("strong[data-i18n]") || el.querySelector("[data-i18n]"))) ||
      null;
    if (childI18n && childI18n.dataset && childI18n.dataset.i18n) return childI18n.dataset.i18n;
    return sanitizeText(el.textContent || el.getAttribute("aria-label") || el.getAttribute("href") || "", 60);
  }

  document.querySelectorAll("a.btn, a.hero-choice").forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href");
      if (href && !/^https?:/i.test(href)) {
        recordFirstAction("cta_click");
        recordIntent({ engagement: 2 });
        track("cta_click", {
          cta: resolveCtaKey(link),
          destination_url: href,
          source_section: resolveSectionName(link)
        }, { beacon: true });
      }
    });
  });

  // Header nav, brand logo, and footer internal navigation
  document.querySelectorAll(".site-nav a, .brand, .footer-nav-col a, .footer-brand").forEach((navLink) => {
    navLink.addEventListener("click", () => {
      const href = navLink.getAttribute("href");
      if (!href || /^https?:/i.test(href)) return;
      const inFooter = Boolean(navLink.closest(".site-footer"));
      const navLocation = inFooter ? "footer" : "header";
      recordFirstAction("nav_click");
      track("nav_click", {
        nav_location: navLocation,
        cta: resolveCtaKey(navLink),
        link_text: sanitizeText(navLink.textContent || navLink.getAttribute("aria-label") || "", 60),
        destination_url: href
      }, { beacon: true });
    });
  });

  // Mobile navigation menu toggle
  const navToggleBtn = document.querySelector(".nav-toggle");
  if (navToggleBtn) {
    navToggleBtn.addEventListener("click", () => {
      const expanded = navToggleBtn.getAttribute("aria-expanded") === "true";
      recordFirstAction("mobile_nav_toggle");
      track("nav_click", {
        nav_location: "mobile_toggle",
        cta: expanded ? "mobile_menu_open" : "mobile_menu_close"
      });
    });
  }

  // Blog post card clicks
  document.querySelectorAll("[data-post-card]").forEach((card) => {
    card.addEventListener("click", () => {
      const title = card.dataset.title || card.textContent || "";
      const canonModel = canonicalModelName(title);
      const searchEl = document.querySelector("[data-blog-search]");
      const tagEl = document.querySelector("[data-blog-tag]");
      const itemHref = sanitizeText(card.getAttribute("href") || title, 100);
      recordFirstAction("post_click");
      recordIntent({ model: canonModel || undefined, modelWeight: 2, engagement: 2 });
      track("select_content", {
        content_type: "blog_post",
        item_id: itemHref,
        selection_type: "blog_post",
        target_asset: itemHref,
        model_name: canonModel || undefined,
        active_search: searchEl && searchEl.value.trim() ? sanitizeText(searchEl.value, 60) : undefined,
        active_tag: tagEl && tagEl.value !== "all" ? tagEl.value : undefined
      }, { beacon: true });
    });
  });

  // Model family, status board, promise cards & tech specs (with accurate planned / in_progress / shipped status!)
  document.querySelectorAll(".family-card, .status-item, .promise, .spec-row").forEach((card) => {
    card.addEventListener("click", (event) => {
      const anchor = event.target.closest("a");
      if (anchor && /^https?:/i.test(anchor.href)) {
        try {
          if (new URL(anchor.href).hostname !== window.location.hostname) return;
        } catch (e) {}
      }
      const rawText = (card.querySelector(".status-name, .latin, .role, .spec-name, h3")?.textContent || card.textContent || "").trim();
      const canonModel = canonicalModelName(rawText) || canonicalModelName(card.textContent) || sanitizeText(rawText, 60);
      const roleEl = card.querySelector(".role, .status-role, .spec-tag");
      const modelStatus = resolveModelStatus(card, canonModel);
      const interestType = anchor ? "internal_link_click" : "card_click";

      recordFirstAction("model_interest");
      recordIntent({ model: canonModel, modelWeight: 2, engagement: 2 });
      track("model_interest", {
        model_name: canonModel,
        target_asset: canonModel,
        model_task: roleEl ? sanitizeText(roleEl.textContent, 40) : undefined,
        model_status: modelStatus,
        interest_type: interestType,
        source_section: resolveSectionName(card)
      }, { beacon: Boolean(anchor) });
    });
  });

  // Home pain-point cards (reveals WHICH of the 4 Taiwan AI failure scenarios resonates most!)
  document.querySelectorAll(".problem-card").forEach((card, idx) => {
    card.addEventListener("click", () => {
      const heading = card.querySelector("h3");
      const key = (heading && heading.dataset.i18n) || `problem_card_${idx + 1}`;
      recordFirstAction("pain_point_card_click");
      recordIntent({ engagement: 1 });
      track("select_content", {
        content_type: "pain_point_card",
        item_id: key,
        selection_type: "pain_point_card",
        target_asset: key
      });
    });
  });

  // Home FAQ cards (reveals WHICH adoption questions or blockers visitors inspect!)
  document.querySelectorAll(".faq-card").forEach((card, idx) => {
    card.addEventListener("click", () => {
      const dt = card.querySelector("dt");
      const key = (dt && dt.dataset.i18n) || `faq_${idx + 1}`;
      if (key === "faq_q6") recordIntent({ persona: "enterprise", weight: 2, engagement: 1 });
      else recordIntent({ engagement: 1 });
      recordFirstAction("faq_click");
      track("select_content", {
        content_type: "faq_item",
        item_id: key,
        selection_type: "faq_item",
        target_asset: key
      });
    });
  });

  // Scenario cards on Home page (reveals industry/user role interest!)
  document.querySelectorAll(".scenario-card").forEach((card) => {
    card.addEventListener("click", () => {
      const heading = card.querySelector("h3");
      const key = (heading && heading.dataset.i18n) || sanitizeText(heading?.textContent || "", 60);
      if (/biz|gov|culture/.test(key)) recordIntent({ persona: "enterprise", weight: 2, engagement: 1 });
      else if (/edu/.test(key)) recordIntent({ persona: "researcher", weight: 2, engagement: 1 });
      else if (/media/.test(key)) recordIntent({ persona: "developer", weight: 2, engagement: 1 });

      recordFirstAction("scenario_click");
      track("select_content", {
        content_type: "use_case_scenario",
        item_id: key,
        selection_type: "use_case_scenario",
        target_asset: key
      });
    });
  });

  // Release gates & Enterprise intent on Roadmap Phase 5
  const phase5 = document.querySelector(".timeline-card:nth-child(6)");
  if (phase5 && PAGE_KEY === "roadmap") {
    phase5.addEventListener("click", () => {
      recordFirstAction("enterprise_intent");
      recordIntent({ persona: "enterprise", weight: 4, engagement: 3 });
      track("enterprise_intent", {
        action: "click_phase5_private_deployment",
        section_name: "roadmap_phase5_enterprise"
      });
    });
  }

  document.querySelectorAll(".release-list a").forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href") || "release_artifact";
      recordIntent({ persona: "researcher", weight: 2, engagement: 2 });
      track("select_content", {
        content_type: "release_artifact",
        item_id: href,
        selection_type: "release_artifact",
        target_asset: href
      }, { beacon: true });
    });
  });

  // ==========================================
  // 9. Blog Search, URL ?q= Tracking & Zero-Result Unmet Demand
  // ==========================================
  const searchInput = document.querySelector("[data-blog-search]");
  function reportBlogSearch(term, origin) {
    const cleanTerm = sanitizeText(term, 100);
    if (!cleanTerm) return;
    const results = document.querySelectorAll("[data-post-card]:not([hidden])").length;
    recordFirstAction("blog_search");
    recordIntent({ model: canonicalModelName(cleanTerm) || undefined, engagement: 2 });
    if (results === 0) {
      track("search_no_results", {
        search_term: cleanTerm,
        search_origin: origin,
        results_count: 0
      });
    } else {
      track("search", {
        search_term: cleanTerm,
        search_origin: origin,
        results_count: results
      });
    }
  }

  if (searchInput) {
    let timer = null;
    searchInput.addEventListener("input", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const term = searchInput.value.trim();
        if (!term) return;
        reportBlogSearch(term, "input");
      }, 600);
    });

    // Track initial /blog/?q=... search query (e.g. from Google SearchAction or shared URL)
    const initialQ = (urlParams.get("q") || "").trim();
    if (initialQ) {
      setTimeout(() => reportBlogSearch(initialQ, "url_query"), 0);
    }
  }

  const tagSelect = document.querySelector("[data-blog-tag]");
  if (tagSelect) {
    tagSelect.addEventListener("change", () => {
      const val = tagSelect.value;
      const results = document.querySelectorAll("[data-post-card]:not([hidden])").length;
      recordFirstAction("blog_tag_filter");
      recordIntent({ model: canonicalModelName(val) || undefined, engagement: 1 });
      track("select_content", {
        content_type: "blog_tag",
        item_id: val,
        selection_type: "blog_tag",
        target_asset: val,
        results_count: results
      });
      // Surface zero-result tag selections (e.g. user filtering for ASR / OCR articles) as unmet demand!
      if (val !== "all" && results === 0) {
        track("search_no_results", {
          search_term: `tag:${val}`,
          search_origin: "tag_filter",
          results_count: 0
        });
      }
    });
  }

  // ==========================================
  // 10. Code Copy & Prose Text Copy Intelligence
  // ==========================================
  let lastCodeCopyTs = 0;

  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      lastCodeCopyTs = Date.now();
      const targetEl = document.querySelector(btn.dataset.copy);
      let snippetPreview = "";
      if (targetEl) {
        const firstLine = (targetEl.textContent || "").trim().split("\n")[0] || "";
        snippetPreview = sanitizeText(firstLine, 80);
      }
      const canonModel = canonicalModelName(PAGE_KEY) || canonicalModelName(snippetPreview);
      recordFirstAction("code_copy");
      recordIntent({ persona: "developer", weight: 3, model: canonModel || undefined, modelWeight: 3, engagement: 4 });
      track("code_copy", {
        target_element: btn.dataset.copy,
        model_name: canonModel || undefined,
        snippet_preview: snippetPreview,
        source_section: resolveSectionName(btn)
      });
    });
  });

  window.addEventListener("openformosa:copy_failed", (event) => {
    track("ux_friction", {
      friction_type: "copy_failed",
      target_element: sanitizeText((event && event.detail && event.detail.target) || "code_block", 60),
      section_name: lastSectionName || "code_implementation"
    });
  });

  // Prose text copy (researchers copying benchmarks, formulas, citations, model IDs)
  document.addEventListener("copy", () => {
    if (Date.now() - lastCodeCopyTs < 500) return; // ignore button-triggered code copies
    const sel = window.getSelection ? window.getSelection() : null;
    const raw = sel ? sel.toString().trim() : "";
    if (raw.length < 6) return;
    const anchorNode = sel && sel.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement) : null;
    if (!anchorNode || !anchorNode.closest(".prose, main")) return;

    const inCode = Boolean(anchorNode.closest("pre, code"));
    const canonModel = canonicalModelName(raw) || canonicalModelName(PAGE_KEY);
    recordFirstAction(inCode ? "code_copy" : "text_copy");
    recordIntent({
      persona: inCode ? "developer" : "researcher",
      weight: 2,
      model: canonModel || undefined,
      modelWeight: 2,
      engagement: 2
    });
    track(inCode ? "code_copy" : "text_copy", {
      target_element: inCode ? "inline_code_selection" : "prose_selection",
      snippet_preview: sanitizeText(raw, 80),
      model_name: canonModel || undefined,
      source_section: resolveSectionName(anchorNode),
      char_count: raw.length
    });
  });

  // ==========================================
  // 11. TTS Audio Demos, Replay & Media Error Telemetry
  // ==========================================
  function clipId(audio) {
    let src = (audio && (audio.currentSrc || audio.src)) || "";
    try { src = decodeURIComponent(src); } catch (error) {}
    const file = src.split("/").pop() || "";
    return file.replace(/\.[a-z0-9]+$/i, "") || "unknown";
  }

  // The audio demo cards are shared by every model post (TTS, ASR, ...).
  // Attribute events to the page's model, not always BlueMagpie-TTS.
  const DEMO_MODEL = (body && body.dataset && body.dataset.modelName) || canonicalModelName(PAGE_KEY) || "BlueMagpie-TTS";

  if (document.querySelector("[data-tts-card]")) {
    const isTtsAudio = (el) => el && el.matches && el.matches("[data-tts-audio]");
    const clipPlayCounts = {};

    function demoTitle(audio) {
      const demo = audio.closest("[data-tts-demo]");
      const heading = demo && demo.querySelector(".tts-demo__title");
      return heading ? sanitizeText(heading.textContent || "", 100) : undefined;
    }

    document.addEventListener("play", (event) => {
      const audio = event.target;
      if (!isTtsAudio(audio)) return;
      const cid = clipId(audio);
      clipPlayCounts[cid] = (clipPlayCounts[cid] || 0) + 1;
      audio.dataset.gaProgress = "";
      recordFirstAction("audio_play");
      recordIntent({ persona: "speech_creator", weight: 2, model: DEMO_MODEL, modelWeight: 2, engagement: 2 });
      track("audio_start", {
        item_id: cid,
        target_asset: cid,
        post_slug: PAGE_KEY,
        model_name: DEMO_MODEL,
        demo_title: demoTitle(audio),
        play_count: clipPlayCounts[cid]
      });
    }, true);

    document.addEventListener("timeupdate", (event) => {
      const audio = event.target;
      if (!isTtsAudio(audio) || !audio.duration) return;
      const percent = (audio.currentTime / audio.duration) * 100;
      const sent = audio.dataset.gaProgress ? audio.dataset.gaProgress.split(",") : [];
      const cid = clipId(audio);
      [25, 50, 75].forEach((mark) => {
        if (percent >= mark && sent.indexOf(String(mark)) === -1) {
          sent.push(String(mark));
          track("audio_progress", {
            item_id: cid,
            target_asset: cid,
            post_slug: PAGE_KEY,
            model_name: DEMO_MODEL,
            percent_played: mark
          });
        }
      });
      audio.dataset.gaProgress = sent.join(",");
    }, true);

    document.addEventListener("pause", (event) => {
      const audio = event.target;
      if (!isTtsAudio(audio) || !audio.duration || audio.ended) return;
      const listened = Math.round(audio.currentTime);
      if (listened < 1) return;
      const cid = clipId(audio);
      track("audio_pause", {
        item_id: cid,
        target_asset: cid,
        post_slug: PAGE_KEY,
        model_name: DEMO_MODEL,
        listen_seconds: listened
      });
    }, true);

    document.addEventListener("ended", (event) => {
      const audio = event.target;
      if (!isTtsAudio(audio)) return;
      const cid = clipId(audio);
      const dur = audio.duration ? Math.round(audio.duration) : undefined;
      recordIntent({ persona: "speech_creator", weight: 2, model: DEMO_MODEL, modelWeight: 2, engagement: 2 });
      track("audio_complete", {
        item_id: cid,
        target_asset: cid,
        post_slug: PAGE_KEY,
        model_name: DEMO_MODEL,
        listen_seconds: dur
      });
    }, true);

    document.addEventListener("error", (event) => {
      const audio = event.target;
      if (!isTtsAudio(audio)) return;
      track("ux_friction", {
        friction_type: "audio_error",
        target_element: `audio:${clipId(audio)}`,
        section_name: "tts_listening_demo",
        model_name: DEMO_MODEL
      });
    }, true);

    document.querySelectorAll("[data-tts-reveal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.getAttribute("aria-expanded") !== "true") return;
        const card = btn.closest("[data-tts-card]");
        const audio = card && card.querySelector("[data-tts-audio]");
        const badge = card && card.querySelector(".tts-card__badge");
        const cid = audio ? clipId(audio) : undefined;
        recordFirstAction("reveal_transcript");
        recordIntent({ persona: "researcher", weight: 2, model: DEMO_MODEL, modelWeight: 1, engagement: 2 });
        track("reveal_transcript", {
          item_id: cid,
          target_asset: cid,
          post_slug: PAGE_KEY,
          model_name: DEMO_MODEL,
          asr_status: badge ? (badge.classList.contains("is-warn") ? "mismatch" : "match") : undefined
        });
      });
    });
  }

  // ==========================================
  // ==========================================
  // 11b. HTML5 Video Telemetry (GA4 enhanced measurement only covers YouTube embeds)
  // Uses GA4's recommended video_start / video_progress / video_complete names so
  // the events land in the built-in video reports.
  // ==========================================
  if (document.querySelector("video")) {
    const videoTitle = (video) => {
      const fig = video.closest("figure");
      const cap = fig && fig.querySelector("figcaption");
      const label = video.getAttribute("aria-label") || video.getAttribute("title") || (cap && cap.textContent) || "";
      return sanitizeText(label, 100) || clipId(video);
    };
    const videoParams = (video, extra) => Object.assign({
      video_provider: "self_hosted",
      video_title: videoTitle(video),
      video_url: (video.currentSrc || video.src || "").split("?")[0],
      video_duration: video.duration ? Math.round(video.duration) : undefined,
      video_current_time: Math.round(video.currentTime || 0),
      item_id: clipId(video),
      post_slug: PAGE_KEY,
      model_name: DEMO_MODEL
    }, extra || {});

    document.addEventListener("play", (event) => {
      const video = event.target;
      if (!video || video.tagName !== "VIDEO") return;
      if (video.dataset.gaStarted === "1") return;
      video.dataset.gaStarted = "1";
      video.dataset.gaProgress = "";
      recordFirstAction("video_play");
      recordIntent({ persona: "speech_creator", weight: 2, model: DEMO_MODEL, modelWeight: 2, engagement: 3 });
      track("video_start", videoParams(video, { video_percent: 0 }));
    }, true);

    document.addEventListener("timeupdate", (event) => {
      const video = event.target;
      if (!video || video.tagName !== "VIDEO" || !video.duration) return;
      const percent = (video.currentTime / video.duration) * 100;
      const sent = video.dataset.gaProgress ? video.dataset.gaProgress.split(",") : [];
      [10, 25, 50, 75, 90].forEach((mark) => {
        if (percent >= mark && sent.indexOf(String(mark)) === -1) {
          sent.push(String(mark));
          track("video_progress", videoParams(video, { video_percent: mark }));
        }
      });
      video.dataset.gaProgress = sent.join(",");
    }, true);

    document.addEventListener("ended", (event) => {
      const video = event.target;
      if (!video || video.tagName !== "VIDEO") return;
      recordIntent({ persona: "speech_creator", weight: 2, model: DEMO_MODEL, modelWeight: 2, engagement: 3 });
      track("video_complete", videoParams(video, { video_percent: 100 }));
      video.dataset.gaStarted = "";
    }, true);

    document.addEventListener("error", (event) => {
      const video = event.target;
      if (!video || video.tagName !== "VIDEO") return;
      track("ux_friction", {
        friction_type: "video_error",
        target_element: `video:${clipId(video)}`,
        model_name: DEMO_MODEL
      });
    }, true);
  }

  // 12. Blog Post 1-Click Micro-Feedback (Always works even without gtag)
  // ==========================================
  const postFeedbackBox = document.querySelector("[data-post-feedback]");
  if (postFeedbackBox) {
    const fbStorageKey = `openformosa_post_fb_${PAGE_KEY}`;
    const fbButtons = [...postFeedbackBox.querySelectorAll("[data-feedback-type]")];
    const fbStatus = postFeedbackBox.querySelector("[data-feedback-status]");

    function renderPostFbState(selectedType, justSubmitted) {
      fbButtons.forEach((btn) => {
        const active = btn.dataset.feedbackType === selectedType;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
      if (fbStatus && selectedType) {
        const isBlocker = selectedType === "need_quickstart" || selectedType === "hard_to_follow";
        const key = justSubmitted
          ? (isBlocker ? "post_fb_thanks_blocker" : "post_fb_thanks")
          : "post_fb_recorded";
        const fallback = justSubmitted
          ? (isBlocker
            ? "Thanks for flagging this blocker! Feel free to add a short note in the wishlist below so we can improve our docs."
            : "Thanks for your feedback! It helps prioritize OpenFormosa's next work.")
          : "Feedback recorded — click another option anytime to update.";
        fbStatus.dataset.i18n = key;
        fbStatus.dataset.i18nDefault = fallback;
        fbStatus.textContent = i18nText(key, fallback);
        fbStatus.className = "post-feedback__status is-success";
      }
    }

    try {
      const savedFb = localStorage.getItem(fbStorageKey);
      if (savedFb) renderPostFbState(savedFb, false);
    } catch (e) {}

    fbButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const fbType = btn.dataset.feedbackType;
        if (!fbType) return;
        try { localStorage.setItem(fbStorageKey, fbType); } catch (e) {}
        renderPostFbState(fbType, true);

        const canonModel = canonicalModelName(PAGE_KEY);
        const estSec = estimateReadSeconds();
        const readRatioPct = estSec ? Math.min(200, Math.round((activeSeconds / estSec) * 100)) : undefined;

        recordFirstAction("post_feedback");
        if (fbType === "want_to_run" || fbType === "need_quickstart") {
          recordIntent({ persona: "developer", weight: 3, model: canonModel || undefined, modelWeight: 3, engagement: 3 });
        } else if (fbType === "want_more_detail") {
          recordIntent({ persona: "researcher", weight: 3, model: canonModel || undefined, modelWeight: 2, engagement: 3 });
        } else {
          recordIntent({ model: canonModel || undefined, modelWeight: 2, engagement: 2 });
        }

        track("content_feedback", {
          post_slug: PAGE_KEY,
          model_name: canonModel || undefined,
          feedback_type: fbType,
          read_ratio_percent: readRatioPct,
          max_scroll_depth: maxScroll,
          last_section: lastSectionName || undefined
        });

        // If user signals they have a specific use case, guide them straight to the Demand Poll!
        if (fbType === "have_use_case") {
          const poll = document.querySelector("[data-demand-poll]");
          if (poll && typeof poll.scrollIntoView === "function") {
            poll.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      });
    });
  }

  // ==========================================
  // 13. Interactive Demand & Pain-Point Poll v2.1 (Always works even without gtag!)
  // ==========================================
  const demandForm = document.querySelector("[data-demand-form]");
  if (demandForm) {
    const capSelect = demandForm.querySelector("#demand-capability");
    const roleSelect = demandForm.querySelector("#demand-role");
    const depSelect = demandForm.querySelector("#demand-deployment");
    const painSelect = demandForm.querySelector("#demand-pain-point");
    const noteInput = demandForm.querySelector("#demand-note");
    const tagButtons = [...demandForm.querySelectorAll("[data-demand-tag]")];
    const statusMsg = demandForm.querySelector("[data-demand-status]") || document.querySelector("[data-demand-status]");
    const selectedTags = new Set();
    let pollStarted = false;
    let pollSubmitted = false;
    let pollAbandonSent = false;
    let lastTouchedField = null;

    function markPollStart(triggerField) {
      lastTouchedField = triggerField;
      if (pollStarted) return;
      pollStarted = true;
      recordFirstAction("demand_poll_start");
      track("demand_poll_start", {
        field_name: triggerField,
        trigger_field: triggerField
      });
    }

    function setDemandStatus(i18nKey, fallbackEn) {
      if (!statusMsg) return;
      statusMsg.dataset.i18n = i18nKey;
      statusMsg.dataset.i18nDefault = fallbackEn;
      statusMsg.textContent = i18nText(i18nKey, fallbackEn);
      statusMsg.className = "demand-status-msg is-success";
    }

    function syncTagButtons() {
      tagButtons.forEach((btn) => {
        const tag = btn.dataset.demandTag;
        const active = selectedTags.has(tag);
        btn.classList.toggle("is-selected", active);
        btn.setAttribute("aria-pressed", String(active));
      });
    }

    // Restore saved demand state
    try {
      const savedDemand = localStorage.getItem("openformosa_user_demand");
      if (savedDemand) {
        const parsed = JSON.parse(savedDemand);
        if (parsed.capability && capSelect) capSelect.value = parsed.capability;
        if (parsed.role && roleSelect) roleSelect.value = parsed.role;
        if (parsed.deployment && depSelect) depSelect.value = parsed.deployment;
        if (parsed.pain_point && painSelect) painSelect.value = parsed.pain_point;
        if (parsed.note && noteInput) noteInput.value = parsed.note;
        if (Array.isArray(parsed.tags)) {
          parsed.tags.forEach((t) => selectedTags.add(t));
          syncTagButtons();
        }
        setDemandStatus("demand_status_saved", "✓ Previously recorded. You may update anytime.");
      }
    } catch (e) {}

    // Quick demand tag toggle chips
    tagButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tag = btn.dataset.demandTag;
        if (!tag) return;
        markPollStart("demand_tags");
        if (selectedTags.has(tag)) selectedTags.delete(tag);
        else selectedTags.add(tag);
        syncTagButtons();
        track("demand_field_select", {
          field_name: "demand_tags",
          field_value: tag,
          selected_state: selectedTags.has(tag) ? "added" : "removed"
        });
      });
    });

    // Partial selection funnel tracking (captures intent & pain points even before final Submit!)
    [
      { el: capSelect, name: "demand_capability" },
      { el: roleSelect, name: "demand_role" },
      { el: depSelect, name: "demand_deployment" },
      { el: painSelect, name: "demand_pain_point" }
    ].forEach(({ el, name }) => {
      if (!el) return;
      el.addEventListener("change", () => {
        markPollStart(name);
        if (el.value) {
          track("demand_field_select", {
            field_name: name,
            field_value: el.value
          });
        }
      });
    });

    if (noteInput) {
      noteInput.addEventListener("focus", () => markPollStart("demand_note"), { once: true });
    }

    // Track partial form abandonment so you see BOTH form friction and unmet demand from non-submitters
    flushDemandAbandon = function () {
      if (!pollStarted || pollSubmitted || pollAbandonSent) return;
      pollAbandonSent = true;
      const cap = (capSelect?.value || "").trim();
      const role = (roleSelect?.value || "").trim();
      const dep = (depSelect?.value || "").trim();
      const pain = (painSelect?.value || "").trim();
      const noteLen = (noteInput?.value || "").trim().length;
      const filledCount =
        (cap ? 1 : 0) +
        (role ? 1 : 0) +
        (dep ? 1 : 0) +
        (pain ? 1 : 0) +
        (selectedTags.size > 0 ? 1 : 0) +
        (noteLen > 0 ? 1 : 0);

      track("demand_poll_abandon", {
        field_name: lastTouchedField || "unknown",
        demand_capability: cap || undefined,
        demand_role: role || undefined,
        demand_deployment: dep || undefined,
        demand_pain_point: pain || undefined,
        filled_fields_count: filledCount
      }, { beacon: true });
    };

    demandForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const cap = (capSelect?.value || "").trim();
      const role = (roleSelect?.value || "").trim();
      const dep = (depSelect?.value || "").trim();
      const pain = (painSelect?.value || "").trim();
      const note = sanitizeText(noteInput?.value || "", 100);
      const tagsArray = [...selectedTags].sort();
      const tagsStr = trimTagList(tagsArray, 100);
      const tagsUserProp = trimTagList(tagsArray, 36);

      if (!cap || !role || !dep) return;

      pollSubmitted = true;

      let isUpdate = false;
      try {
        isUpdate = Boolean(localStorage.getItem("openformosa_user_demand"));
      } catch (err) {}

      const demandData = {
        capability: cap,
        role: role,
        deployment: dep,
        pain_point: pain,
        tags: tagsArray,
        note: note,
        submitted_at: Date.now()
      };

      try {
        localStorage.setItem("openformosa_user_demand", JSON.stringify(demandData));
      } catch (err) {}

      const canonModel = canonicalModelName(cap);
      const rolePersonaMap = {
        developer: "developer",
        researcher: "researcher",
        enterprise: "enterprise",
        creator: "speech_creator"
      };
      recordFirstAction("demand_submit");
      recordIntent({
        persona: rolePersonaMap[role] || undefined,
        weight: 5,
        model: canonModel || undefined,
        modelWeight: 5,
        engagement: 6
      });

      track("user_demand_submit", {
        demand_capability: cap,
        demand_role: role,
        demand_deployment: dep,
        demand_pain_point: pain || undefined,
        demand_tags: tagsStr || undefined,
        demand_note: note || undefined,
        model_name: canonModel || undefined,
        demand_action: isUpdate ? "update" : "new"
      });

      // Emit clean 1-to-1 per-tag votes so GA4 can graph exact tag rankings without parsing CSV strings!
      tagsArray.forEach((tag) => {
        track("demand_tag_vote", {
          demand_tag: tag,
          demand_capability: cap,
          demand_role: role,
          demand_pain_point: pain || undefined
        });
      });

      setUserProps({
        user_demand_capability: cap,
        user_demand_role: role,
        user_demand_deployment: dep,
        user_demand_pain_point: pain || undefined,
        user_demand_tags: tagsUserProp || undefined
      });

      setDemandStatus(
        isUpdate ? "demand_status_updated" : "demand_status_success",
        isUpdate
          ? "✓ Demand updated! Thank you for your feedback."
          : "✓ Thank you! Your demand has been recorded into OpenFormosa's roadmap."
      );
    });
  }

  // ==========================================
  // 14. UX Friction Detection (Rage Clicks, Dead Clicks & Broken Media)
  // ==========================================
  function describeElement(el) {
    if (!el || el.nodeType !== 1) return "unknown";
    const card = el.closest(".family-card, .status-item, .promise, .spec-row, .problem-card, .faq-card, .scenario-card, .directory-card, .timeline-card, .symbol-card");
    if (card) {
      const cardType = (card.className && String(card.className).split(" ")[0]) || "card";
      const labelEl = card.querySelector(".status-name, .latin, .spec-name, dt, h3, strong, .key");
      const i18nKey = labelEl && labelEl.dataset && labelEl.dataset.i18n;
      const canon = canonicalModelName(labelEl?.textContent || card.textContent);
      const id = canon || i18nKey || sanitizeText(labelEl?.textContent || "", 32);
      return sanitizeText(`${cardType}:${id}`, 60);
    }
    const i18nEl = el.closest("[data-i18n]");
    if (i18nEl && i18nEl.dataset.i18n) return sanitizeText(`${el.tagName.toLowerCase()}:${i18nEl.dataset.i18n}`, 60);
    const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    return sanitizeText(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : cls}`, 60);
  }

  const recentClicks = [];
  const reportedRageTargets = new Set();
  const reportedDeadTargets = new Set();
  let frictionEventCount = 0;

  document.addEventListener("click", (event) => {
    if (frictionEventCount >= 12) return;
    const target = event.target && event.target.nodeType === 1 ? event.target : null;
    if (!target) return;

    const now = Date.now();
    const x = event.clientX || 0;
    const y = event.clientY || 0;
    const desc = describeElement(target);

    // 14a. Rage Click Detection (>= 3 rapid clicks within 1200ms in a 40px radius on the same target)
    recentClicks.push({ ts: now, x, y, desc });
    while (recentClicks.length && now - recentClicks[0].ts > 1200) {
      recentClicks.shift();
    }
    const nearby = recentClicks.filter((c) => Math.abs(c.x - x) <= 40 && Math.abs(c.y - y) <= 40 && c.desc === desc);
    if (nearby.length >= 3 && !reportedRageTargets.has(desc)) {
      reportedRageTargets.add(desc);
      frictionEventCount += 1;
      const canonModel = canonicalModelName(desc);
      track("ux_friction", {
        friction_type: "rage_click",
        target_element: desc,
        section_name: resolveSectionName(target),
        model_name: canonModel || undefined,
        model_status: canonModel ? resolveModelStatus(target.closest(".family-card, .status-item, .promise, .spec-row"), canonModel) : undefined
      });
      return;
    }

    // 14b. Dead Click Detection (clicking a visually card-like / badge-like non-interactive element expecting navigation)
    const interactive = target.closest("a, button, input, select, textarea, summary, label, audio, video, [role='button']");
    if (interactive) return;
    const sel = window.getSelection ? window.getSelection().toString().trim() : "";
    if (sel.length > 0) return;

    const deadCandidate = target.closest(".family-card, .promise, .spec-row, .problem-card, .faq-card, .scenario-card, .directory-card, .timeline-card, .symbol-card, .status-badge");
    if (!deadCandidate || reportedDeadTargets.has(desc)) return;
    reportedDeadTargets.add(desc);
    frictionEventCount += 1;

    const canonModel = canonicalModelName(deadCandidate.textContent || "");
    track("ux_friction", {
      friction_type: "dead_click",
      target_element: desc,
      section_name: resolveSectionName(deadCandidate),
      model_name: canonModel || undefined,
      model_status: canonModel ? resolveModelStatus(deadCandidate, canonModel) : undefined
    });
  });

  // Broken image load errors (rate-limited)
  let imageErrorCount = 0;
  document.addEventListener("error", (event) => {
    const target = event.target;
    if (!target || target.tagName !== "IMG" || imageErrorCount >= 3) return;
    imageErrorCount += 1;
    const src = (target.currentSrc || target.getAttribute("src") || "").split("/").pop() || "img";
    track("ux_friction", {
      friction_type: "image_error",
      target_element: sanitizeText(`img:${src}`, 60),
      section_name: resolveSectionName(target)
    });
  }, true);

  // ==========================================
  // 15. 404 & Rate-Limited JS Error Diagnostics
  // ==========================================
  if (PAGE_KEY === "not_found" || PAGE_TYPE === "not_found" || document.title.includes("404") || document.title.includes("Not found")) {
    track("page_not_found", {
      broken_url: window.location.pathname + window.location.search,
      referrer: document.referrer || "(direct)"
    });
  }

  let jsErrorCount = 0;
  window.addEventListener("error", (event) => {
    if (jsErrorCount >= 3) return;
    jsErrorCount += 1;
    track("js_error", {
      error_message: sanitizeText(event.message || "script_error", 100),
      error_source: sanitizeText((event.filename || "").split("/").pop() || "inline", 60),
      error_line: event.lineno || 0
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (jsErrorCount >= 3) return;
    jsErrorCount += 1;
    const reason = event.reason && event.reason.message ? event.reason.message : String(event.reason || "promise_rejection");
    track("js_error", {
      error_message: sanitizeText(reason, 100),
      error_source: "unhandledrejection"
    });
  });
})();
