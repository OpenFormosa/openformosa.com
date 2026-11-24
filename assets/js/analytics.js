// OpenFormosa — GA4 v2 Precision Analytics, Performance & Demand Intelligence
// Covers:
// 1. Multi-Touch Session Attribution (UTM, Taiwan/AI-search referrers, landing page, session depth)
// 2. Precision Time & Engagement (active-only reading timer, audio-aware idle detection,
//    additive active_seconds beacon flush, read quality classification, active-only section dwell)
// 3. Full Conversion & Content Funnel (canonicalized model interest, outbound asset classification,
//    prose text copy, code copy, blog search & zero-result unmet demands, post micro-feedback)
// 4. Demand Intelligence & Dynamic User Persona (quick demand tags, partial poll funnel,
//    cross-session persona & primary model scoring, privacy-safe PII scrubbing)
// 5. Core Web Vitals (LCP, CLS, INP, TTFB) & Rate-Limited JS Error / 404 Diagnostics
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

  function emitGtag(command, action, params) {
    if (isDebug) {
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

  // Canonicalize model names across zh-Hant / en / URLs so GA4 reports never fragment
  function canonicalModelName(raw) {
    if (!raw) return null;
    const s = String(raw).toLowerCase();
    if (/barbet|五色鳥|記得住|base_1b|1b\s*base|openformosa-base/.test(s)) return "Barbet";
    if (/bluemagpie|藍鵲|說得出|tts/.test(s)) return "BlueMagpie-TTS";
    if (/pangolin|穿山甲|ubitok|tokenizer/.test(s)) return "PangolinTokenizer";
    if (/blackbear|黑熊|聽得懂|asr/.test(s)) return "BlackBear-ASR";
    if (/sikadeer|梅花鹿|讀得懂|ocr/.test(s)) return "SikaDeer-OCR";
    return null;
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
      // Update session entry attribution if none stored yet, or if new explicit campaign arrived
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
        entry_referrer_category: current.referrer_category,
        entry_referrer_domain: current.referrer_domain,
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
      screen_resolution: window.screen ? `${window.screen.width}x${window.screen.height}` : "unknown",
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
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
      track("language_switch", { from_language: from, to_language: to });
    });
  });

  document.querySelectorAll("[data-theme-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.themeOption;
      setUserProps({ preferred_theme: theme });
      recordFirstAction("theme_switch");
      track("theme_switch", { theme: theme });
    });
  });

  // ==========================================
  // 4. Precision Active Time, Audio-Aware Idle & Read Quality
  // ==========================================
  let activeSeconds = 0;
  let lastFlushedActiveSeconds = 0;
  let isTabActive = document.visibilityState === "visible";
  let userLastInteracted = Date.now();
  let maxScroll = 0;

  function onUserActivity() {
    userLastInteracted = Date.now();
  }
  ["mousemove", "keydown", "scroll", "touchstart", "click", "wheel"].forEach((evt) => {
    window.addEventListener(evt, onUserActivity, { passive: true });
  });

  function isAnyAudioPlaying() {
    const audios = document.querySelectorAll("audio");
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

  function flushDwellSummary(useBeacon) {
    const delta = activeSeconds - lastFlushedActiveSeconds;
    // Require >= 5s on first flush, or >= 3s on subsequent tab-return flushes
    const minDelta = lastFlushedActiveSeconds === 0 ? 5 : 3;
    if (delta < minDelta) return;

    lastFlushedActiveSeconds = activeSeconds;
    const estSec = estimateReadSeconds();
    const readRatioPct = estSec ? Math.min(200, Math.round((activeSeconds / estSec) * 100)) : undefined;
    const readQuality = classifyReadQuality(activeSeconds, maxScroll, estSec);

    // Emit additive delta in `active_seconds` so GA4 sums accurately with zero double counting!
    track("page_dwell_summary", {
      active_seconds: delta,
      cumulative_active_seconds: activeSeconds,
      total_wall_seconds: Math.round((Date.now() - pageLoadTime) / 1000),
      max_scroll_depth: maxScroll,
      read_quality: readQuality,
      estimated_read_seconds: estSec || undefined,
      read_ratio_percent: readRatioPct,
      interactions_count: interactionCount
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
      dom_loaded_ms: domLoaded
    }, { beacon: Boolean(useBeacon) });
  }

  document.addEventListener("visibilitychange", () => {
    isTabActive = document.visibilityState === "visible";
    if (!isTabActive) {
      flushAllVisibleSections(true);
      flushDwellSummary(true);
      flushWebVitals(true);
    } else {
      userLastInteracted = Date.now();
    }
  });

  window.addEventListener("pagehide", () => {
    flushAllVisibleSections(true);
    flushDwellSummary(true);
    flushWebVitals(true);
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
      { selector: ".hero", name: "hero" },
      { selector: ".status-board", name: "status_board" },
      { selector: ".promise-grid", name: "promise_grid" },
      { selector: ".problem-grid", name: "problem_gaps" },
      { selector: ".family-grid", name: "model_family" },
      { selector: ".scenario-grid", name: "target_scenarios" },
      { selector: ".timeline", name: PAGE_KEY === "evaluation" ? "evaluation_workflow" : "roadmap_timeline" },
      { selector: ".spec-list", name: "tech_specifications" },
      { selector: ".directory-grid", name: "beliefs_or_tracks" },
      { selector: ".release-panel", name: "release_gates" },
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
              track("enterprise_intent", { action: "dwell_phase5_private_deployment", dwell_seconds: sec });
            }
          }
        });
        sectionObserver.observe(phase5);
      }
    }

    // Observe blog post H2 headings (only visible language headings count!)
    if (PAGE_TYPE === "post") {
      document.querySelectorAll(".post-body h2").forEach((h2, idx) => {
        const headingText = sanitizeText(h2.textContent || "", 40);
        sectionStates.set(h2, {
          name: `post_h2_${idx + 1}_${headingText}`.slice(0, 60),
          visible: false,
          activeDwell: 0
        });
        sectionObserver.observe(h2);
      });
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
      const section = link.closest("section, article, header, footer");
      const sectionName = section ? (section.id || (section.className && String(section.className).split(" ")[0]) || section.tagName.toLowerCase()) : "body";
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
          interest_type: parsed.category === "huggingface_demo" ? "demo_try" : "weights_view",
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
          action: "view_repo"
        }, { beacon: true });
      } else if (parsed.category === "discord_community") {
        recordIntent({ engagement: 4 });
        track("community_intent", {
          channel: "discord",
          action: "join_community"
        }, { beacon: true });
      } else if (parsed.category === "research_paper") {
        recordIntent({ persona: "researcher", weight: 3, engagement: 3 });
      }
    }
  });

  // ==========================================
  // 8. Internal CTAs, Navigation & Content Cards
  // ==========================================
  document.querySelectorAll("a.btn, a.hero-choice").forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href");
      if (href && !/^https?:/i.test(href)) {
        recordFirstAction("cta_click");
        recordIntent({ engagement: 2 });
        track("cta_click", {
          cta: link.dataset.i18n || sanitizeText(link.textContent || "", 100),
          destination_url: href
        }, { beacon: true });
      }
    });
  });

  document.querySelectorAll(".site-nav a").forEach((navLink) => {
    navLink.addEventListener("click", () => {
      const href = navLink.getAttribute("href");
      if (href && !/^https?:/i.test(href)) {
        recordFirstAction("nav_click");
        track("nav_click", {
          link_text: sanitizeText(navLink.textContent || "", 60),
          destination_url: href
        }, { beacon: true });
      }
    });
  });

  // Blog post card clicks
  document.querySelectorAll("[data-post-card]").forEach((card) => {
    card.addEventListener("click", () => {
      const title = card.dataset.title || card.textContent || "";
      const canonModel = canonicalModelName(title);
      const searchEl = document.querySelector("[data-blog-search]");
      const tagEl = document.querySelector("[data-blog-tag]");
      recordFirstAction("post_click");
      recordIntent({ model: canonModel || undefined, modelWeight: 2, engagement: 2 });
      track("select_content", {
        content_type: "blog_post",
        item_id: sanitizeText(card.getAttribute("href") || title, 100),
        model_name: canonModel || undefined,
        active_search: searchEl && searchEl.value.trim() ? sanitizeText(searchEl.value, 60) : undefined,
        active_tag: tagEl && tagEl.value !== "all" ? tagEl.value : undefined
      }, { beacon: true });
    });
  });

  // Fixed selectors: .status-item (was .status-card), .family-card, .promise, .spec-row
  document.querySelectorAll(".family-card, .status-item, .promise, .spec-row").forEach((card) => {
    card.addEventListener("click", (event) => {
      // Avoid duplicate firing when clicking an outbound link inside the card (already tracked above)
      const anchor = event.target.closest("a");
      if (anchor && /^https?:/i.test(anchor.href) && new URL(anchor.href).hostname !== window.location.hostname) {
        return;
      }
      const rawText = (card.querySelector(".status-name, .latin, .role, .spec-name, h3")?.textContent || card.textContent || "").trim();
      const canonModel = canonicalModelName(rawText) || canonicalModelName(card.textContent) || sanitizeText(rawText, 60);
      const roleEl = card.querySelector(".role, .status-role, .spec-tag");
      const statusBadge = card.querySelector(".status-badge");
      const isPlanned = statusBadge && statusBadge.classList.contains("is-planned");

      recordFirstAction("model_interest");
      recordIntent({ model: canonModel, modelWeight: 2, engagement: 2 });
      track("model_interest", {
        model_name: canonModel,
        model_task: roleEl ? sanitizeText(roleEl.textContent, 40) : undefined,
        model_status: isPlanned ? "planned" : "shipped",
        action: anchor ? "internal_link_click" : "card_click"
      }, { beacon: Boolean(anchor) });
    });
  });

  // Scenario cards on Home page (reveals industry/user role interest!)
  document.querySelectorAll(".scenario-card").forEach((card) => {
    card.addEventListener("click", () => {
      const heading = card.querySelector("h3");
      const key = (heading && heading.dataset.i18n) || sanitizeText(heading?.textContent || "", 60);
      if (/biz|gov/.test(key)) recordIntent({ persona: "enterprise", weight: 2, engagement: 1 });
      else if (/edu/.test(key)) recordIntent({ persona: "researcher", weight: 2, engagement: 1 });
      else if (/media|culture/.test(key)) recordIntent({ persona: "speech_creator", weight: 2, engagement: 1 });

      recordFirstAction("scenario_click");
      track("select_content", {
        content_type: "use_case_scenario",
        item_id: key
      });
    });
  });

  // Release gates & Enterprise intent on Roadmap Phase 5
  const phase5 = document.querySelector(".timeline-card:nth-child(6)");
  if (phase5 && PAGE_KEY === "roadmap") {
    phase5.addEventListener("click", () => {
      recordFirstAction("enterprise_intent");
      recordIntent({ persona: "enterprise", weight: 4, engagement: 3 });
      track("enterprise_intent", { action: "click_phase5_private_deployment" });
    });
  }

  document.querySelectorAll(".release-list a").forEach((link) => {
    link.addEventListener("click", () => {
      recordIntent({ persona: "researcher", weight: 2, engagement: 2 });
      track("select_content", {
        content_type: "release_artifact",
        item_id: link.getAttribute("href")
      }, { beacon: true });
    });
  });

  // ==========================================
  // 9. Blog Search & Zero-Result Unmet Demand
  // ==========================================
  const searchInput = document.querySelector("[data-blog-search]");
  if (searchInput) {
    let timer = null;
    searchInput.addEventListener("input", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const term = searchInput.value.trim();
        if (!term) return;
        const results = document.querySelectorAll("[data-post-card]:not([hidden])").length;
        recordFirstAction("blog_search");
        recordIntent({ engagement: 2 });
        if (results === 0) {
          track("search_no_results", { search_term: sanitizeText(term, 100) });
        } else {
          track("search", { search_term: sanitizeText(term, 100), results_count: results });
        }
      }, 600);
    });
  }

  const tagSelect = document.querySelector("[data-blog-tag]");
  if (tagSelect) {
    tagSelect.addEventListener("change", () => {
      const results = document.querySelectorAll("[data-post-card]:not([hidden])").length;
      recordFirstAction("blog_tag_filter");
      recordIntent({ model: canonicalModelName(tagSelect.value) || undefined, engagement: 1 });
      track("select_content", {
        content_type: "blog_tag",
        item_id: tagSelect.value,
        results_count: results
      });
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
        target: btn.dataset.copy,
        model_name: canonModel || undefined,
        snippet_preview: snippetPreview
      });
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
      snippet_preview: sanitizeText(raw, 80),
      model_name: canonModel || undefined,
      char_count: raw.length
    });
  });

  // ==========================================
  // 11. TTS Audio Demos & Media Timings
  // ==========================================
  function clipId(audio) {
    let src = (audio && (audio.currentSrc || audio.src)) || "";
    try { src = decodeURIComponent(src); } catch (error) {}
    const file = src.split("/").pop() || "";
    return file.replace(/\.[a-z0-9]+$/i, "") || "unknown";
  }

  if (document.querySelector("[data-tts-card]")) {
    const isTtsAudio = (el) => el && el.matches && el.matches("[data-tts-audio]");

    function demoTitle(audio) {
      const demo = audio.closest("[data-tts-demo]");
      const heading = demo && demo.querySelector(".tts-demo__title");
      return heading ? sanitizeText(heading.textContent || "", 100) : undefined;
    }

    document.addEventListener("play", (event) => {
      const audio = event.target;
      if (!isTtsAudio(audio)) return;
      audio.dataset.gaProgress = "";
      recordFirstAction("audio_play");
      recordIntent({ persona: "speech_creator", weight: 2, model: "BlueMagpie-TTS", modelWeight: 2, engagement: 2 });
      track("audio_start", {
        item_id: clipId(audio),
        post_slug: PAGE_KEY,
        model_name: "BlueMagpie-TTS",
        demo_title: demoTitle(audio)
      });
    }, true);

    document.addEventListener("timeupdate", (event) => {
      const audio = event.target;
      if (!isTtsAudio(audio) || !audio.duration) return;
      const percent = (audio.currentTime / audio.duration) * 100;
      const sent = audio.dataset.gaProgress ? audio.dataset.gaProgress.split(",") : [];
      [25, 50, 75].forEach((mark) => {
        if (percent >= mark && sent.indexOf(String(mark)) === -1) {
          sent.push(String(mark));
          track("audio_progress", {
            item_id: clipId(audio),
            post_slug: PAGE_KEY,
            model_name: "BlueMagpie-TTS",
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
      track("audio_pause", {
        item_id: clipId(audio),
        post_slug: PAGE_KEY,
        model_name: "BlueMagpie-TTS",
        listen_seconds: listened
      });
    }, true);

    document.addEventListener("ended", (event) => {
      const audio = event.target;
      if (!isTtsAudio(audio)) return;
      const dur = audio.duration ? Math.round(audio.duration) : undefined;
      recordIntent({ persona: "speech_creator", weight: 2, model: "BlueMagpie-TTS", modelWeight: 2, engagement: 2 });
      track("audio_complete", {
        item_id: clipId(audio),
        post_slug: PAGE_KEY,
        model_name: "BlueMagpie-TTS",
        listen_seconds: dur
      });
    }, true);

    document.querySelectorAll("[data-tts-reveal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.getAttribute("aria-expanded") !== "true") return;
        const card = btn.closest("[data-tts-card]");
        const audio = card && card.querySelector("[data-tts-audio]");
        const badge = card && card.querySelector(".tts-card__badge");
        recordFirstAction("reveal_transcript");
        recordIntent({ persona: "researcher", weight: 2, model: "BlueMagpie-TTS", modelWeight: 1, engagement: 2 });
        track("reveal_transcript", {
          item_id: audio ? clipId(audio) : undefined,
          post_slug: PAGE_KEY,
          model_name: "BlueMagpie-TTS",
          asr_status: badge ? (badge.classList.contains("is-warn") ? "mismatch" : "match") : undefined
        });
      });
    });
  }

  // ==========================================
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
        const key = justSubmitted ? "post_fb_thanks" : "post_fb_recorded";
        const fallback = justSubmitted
          ? "Thanks for your feedback! It helps prioritize OpenFormosa's next work."
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
        if (fbType === "want_to_run") recordIntent({ persona: "developer", weight: 3, model: canonModel || undefined, modelWeight: 3, engagement: 3 });
        else if (fbType === "want_more_detail") recordIntent({ persona: "researcher", weight: 3, model: canonModel || undefined, modelWeight: 2, engagement: 3 });
        else recordIntent({ model: canonModel || undefined, modelWeight: 2, engagement: 2 });

        track("content_feedback", {
          post_slug: PAGE_KEY,
          model_name: canonModel || undefined,
          feedback_type: fbType,
          read_ratio_percent: readRatioPct,
          max_scroll_depth: maxScroll
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
  // 13. Interactive Demand Poll v2 (Always works even without gtag!)
  // ==========================================
  const demandForm = document.querySelector("[data-demand-form]");
  if (demandForm) {
    const capSelect = demandForm.querySelector("#demand-capability");
    const roleSelect = demandForm.querySelector("#demand-role");
    const depSelect = demandForm.querySelector("#demand-deployment");
    const noteInput = demandForm.querySelector("#demand-note");
    const tagButtons = [...demandForm.querySelectorAll("[data-demand-tag]")];
    const statusMsg = demandForm.querySelector("[data-demand-status]") || document.querySelector("[data-demand-status]");
    const selectedTags = new Set();
    let pollStarted = false;

    function markPollStart(triggerField) {
      if (pollStarted) return;
      pollStarted = true;
      recordFirstAction("demand_poll_start");
      track("demand_poll_start", { trigger_field: triggerField });
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

    // Partial selection funnel tracking (captures intent even before final Submit!)
    [
      { el: capSelect, name: "demand_capability" },
      { el: roleSelect, name: "demand_role" },
      { el: depSelect, name: "demand_deployment" }
    ].forEach(({ el, name }) => {
      if (!el) return;
      el.addEventListener("change", () => {
        markPollStart(name);
        track("demand_field_select", {
          field_name: name,
          field_value: el.value
        });
      });
    });

    if (noteInput) {
      noteInput.addEventListener("focus", () => markPollStart("demand_note"), { once: true });
    }

    demandForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const cap = (capSelect?.value || "").trim();
      const role = (roleSelect?.value || "").trim();
      const dep = (depSelect?.value || "").trim();
      const note = sanitizeText(noteInput?.value || "", 100);
      const tagsArray = [...selectedTags].sort();
      const tagsStr = tagsArray.join(",");

      if (!cap || !role || !dep) return;

      let isUpdate = false;
      try {
        isUpdate = Boolean(localStorage.getItem("openformosa_user_demand"));
      } catch (err) {}

      const demandData = {
        capability: cap,
        role: role,
        deployment: dep,
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
        demand_tags: tagsStr || undefined,
        demand_note: note || undefined,
        model_name: canonModel || undefined,
        demand_action: isUpdate ? "update" : "new"
      });

      setUserProps({
        user_demand_capability: cap,
        user_demand_role: role,
        user_demand_deployment: dep,
        user_demand_tags: tagsStr || undefined
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
  // 14. 404 & Rate-Limited JS Error Diagnostics
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
