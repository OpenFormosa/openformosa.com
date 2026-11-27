#!/usr/bin/env python3
"""
OpenFormosa — GA4 v2.1 Custom Definitions, Key Events & Data Retention Auto Setup Script

Automatically configures Google Analytics 4 (GA4) via the Google Analytics Admin API (v1beta):
  1. Event-scoped Custom Dimensions (45 items / 50 standard GA4 limit)
  2. User-scoped Custom Dimensions (16 items / 25 standard GA4 limit)
  3. Custom Metrics (15 items / 50 standard GA4 limit)
  4. Key Events / Conversions (7 positive-intent items / 30 standard GA4 limit)
  5. Event Data Retention -> 14 months (maximum for standard GA4)

Prerequisites:
  1. Your GA4 Property ID (numeric ID, e.g. 542906708).
  2. An OAuth 2.0 Access Token or a Service Account with "Editor" permissions on the GA4 property.

Usage Examples:
  python3 scripts/setup_ga4_custom_definitions.py --dry-run
  python3 scripts/setup_ga4_custom_definitions.py --property-id 542906708 --token YOUR_ACCESS_TOKEN
  python3 scripts/setup_ga4_custom_definitions.py --property-id 542906708 --service-account /path/to/sa.json
"""

import argparse
import os
import re
import sys

# Event-scoped Custom Dimensions (45 / 50 GA4 standard quota)
EVENT_CUSTOM_DIMENSIONS = [
    # --- Core Page, Language & Outbound ---
    {"parameterName": "page_key", "displayName": "頁面標識", "description": "首頁、模型頁、進度表、文章 slug 等", "scope": "EVENT"},
    {"parameterName": "page_type", "displayName": "頁面類型", "description": "home, post, models, roadmap, evaluation, training 等", "scope": "EVENT"},
    {"parameterName": "content_language", "displayName": "內容語系", "description": "zh-Hant 或 en", "scope": "EVENT"},
    {"parameterName": "outbound_category", "displayName": "出站類別", "description": "huggingface_model, huggingface_demo, github_repo, discord_community 等", "scope": "EVENT"},
    {"parameterName": "target_asset", "displayName": "目標資產", "description": "模型、Demo、儲存庫、音檔或卡片識別（如 Barbet, BlueMagpie-TTS-Demo）", "scope": "EVENT"},
    {"parameterName": "model_name", "displayName": "模型名稱", "description": "正規化之家族模型名（Barbet, BlueMagpie-TTS, PangolinTokenizer 等）", "scope": "EVENT"},
    {"parameterName": "model_status", "displayName": "模型釋出狀態", "description": "shipped, in_progress, planned（統計規劃中模型的未滿足需求）", "scope": "EVENT"},
    {"parameterName": "interest_type", "displayName": "模型興趣類型", "description": "demo_try, weights_view, internal_link_click, card_click", "scope": "EVENT"},
    {"parameterName": "source_section", "displayName": "轉換來源區塊", "description": "觸發外部連結、CTA 或程式碼複製的頁面區塊", "scope": "EVENT"},
    # --- Reading Depth, Drop-Off & Content Interaction ---
    {"parameterName": "milestone_label", "displayName": "閱讀里程碑", "description": "15s_skimmer, 60s_engaged_reader, 5min_thorough_reader 等", "scope": "EVENT"},
    {"parameterName": "read_quality", "displayName": "閱讀品質", "description": "bounce, skim, partial_read, deep_read, complete_read", "scope": "EVENT"},
    {"parameterName": "section_name", "displayName": "區塊名稱", "description": "status_board, model_family, roadmap_timeline, post_h2 等", "scope": "EVENT"},
    {"parameterName": "last_section", "displayName": "離開前最後閱讀區塊", "description": "訪客離開頁面前停留的最後章節或區塊（定位流失斷點）", "scope": "EVENT"},
    {"parameterName": "selection_type", "displayName": "內容選取類型", "description": "blog_post, pain_point_card, faq_item, use_case_scenario, blog_tag 等", "scope": "EVENT"},
    {"parameterName": "snippet_preview", "displayName": "複製片段預覽", "description": "訪客複製的程式碼首行或文章段落預覽（已去個資）", "scope": "EVENT"},
    {"parameterName": "asr_status", "displayName": "TTS試聽辨識狀態", "description": "展開 Breeze-ASR 逐字稿時為 match 或 mismatch", "scope": "EVENT"},
    # --- Demand, Pain Points & Micro-Feedback ---
    {"parameterName": "demand_capability", "displayName": "需求_模型能力", "description": "使用者許願最期待的模型（ASR、TTS、OCR 等）", "scope": "EVENT"},
    {"parameterName": "demand_role", "displayName": "需求_身份場景", "description": "使用者角色（Developer、Researcher、Enterprise 等）", "scope": "EVENT"},
    {"parameterName": "demand_deployment", "displayName": "需求_部署偏好", "description": "本機離線、私有 GPU 伺服器、雲端 API", "scope": "EVENT"},
    {"parameterName": "demand_pain_point", "displayName": "需求_核心痛點", "description": "使用者選取的最大卡關點（tw_accuracy, privacy_onprem, missing_model 等）", "scope": "EVENT"},
    {"parameterName": "demand_tags", "displayName": "需求_標籤組合", "description": "使用者勾選之台灣語言與領域標籤組合（如 taigi,medical）", "scope": "EVENT"},
    {"parameterName": "demand_tag", "displayName": "需求_單一標籤票", "description": "由 demand_tag_vote 送出的單一語言／領域標籤（可直接畫精準排行）", "scope": "EVENT"},
    {"parameterName": "demand_note", "displayName": "需求_備註許願", "description": "使用者自由填寫的具體痛點與需求詞彙（已去個資）", "scope": "EVENT"},
    {"parameterName": "demand_action", "displayName": "需求_提交類型", "description": "new（首次填寫）或 update（更新需求）", "scope": "EVENT"},
    {"parameterName": "field_name", "displayName": "表單互動欄位", "description": "需求調查漏斗中被選取或最後停住（放棄）的欄位名稱", "scope": "EVENT"},
    {"parameterName": "field_value", "displayName": "表單選取值", "description": "需求調查局部漏斗中選擇的選項值", "scope": "EVENT"},
    {"parameterName": "selected_state", "displayName": "標籤選取狀態", "description": "demand_tags 標籤點擊為 added 或 removed", "scope": "EVENT"},
    {"parameterName": "feedback_type", "displayName": "文章回饋類型", "description": "helpful, want_to_run, want_more_detail, have_use_case, need_quickstart, hard_to_follow", "scope": "EVENT"},
    # --- Search & Unmet Demand ---
    {"parameterName": "search_term", "displayName": "搜尋字詞", "description": "站內搜尋關鍵字與無結果標籤（含無結果搜尋需求）", "scope": "EVENT"},
    {"parameterName": "search_origin", "displayName": "搜尋來源類型", "description": "input（輸入框）、url_query（?q= 著陸）、tag_filter（零結果標籤）", "scope": "EVENT"},
    # --- Navigation, CTA & i18n ---
    {"parameterName": "action_name", "displayName": "首次互動動作", "description": "first_meaningful_action 記錄的進站後第一個有效操作", "scope": "EVENT"},
    {"parameterName": "cta", "displayName": "行動呼籲識別", "description": "點擊的按鈕、Hero 入口或導覽項目識別鍵", "scope": "EVENT"},
    {"parameterName": "destination_url", "displayName": "站內導覽目標", "description": "CTA 或導覽列導向的站內路徑或錨點", "scope": "EVENT"},
    {"parameterName": "nav_location", "displayName": "導覽列位置", "description": "header, footer, mobile_toggle", "scope": "EVENT"},
    {"parameterName": "language_direction", "displayName": "語系切換方向", "description": "zh-Hant->en 或 en->zh-Hant（診斷預設語系摩擦）", "scope": "EVENT"},
    # --- UX Friction, Performance & Reliability Diagnostics ---
    {"parameterName": "friction_type", "displayName": "體驗痛點類型", "description": "rage_click, dead_click, audio_error, image_error, copy_failed", "scope": "EVENT"},
    {"parameterName": "target_element", "displayName": "互動或卡關元素", "description": "發生憤怒點擊、無反應卡片點擊或複製失敗的目標元素", "scope": "EVENT"},
    {"parameterName": "vitals_rating", "displayName": "網頁效能評級", "description": "Core Web Vitals 綜合評級（good, needs_improvement, poor）", "scope": "EVENT"},
    {"parameterName": "broken_url", "displayName": "404錯誤網址", "description": "觸發 404 頁面的實際無效路徑與參數", "scope": "EVENT"},
    {"parameterName": "error_message", "displayName": "JS錯誤訊息", "description": "前端執行期錯誤訊息摘要（已去個資）", "scope": "EVENT"},
    {"parameterName": "error_source", "displayName": "JS錯誤來源", "description": "發生 JS 錯誤的腳本檔名或 unhandledrejection", "scope": "EVENT"},
    # --- Attribution ---
    {"parameterName": "referrer_category", "displayName": "來源分類", "description": "ai_search, taiwan_community, github, huggingface, social, search 等", "scope": "EVENT"},
    {"parameterName": "entry_referrer_category", "displayName": "首次進站來源分類", "description": "工作階段首次進站之外部管道分類（跨頁保留歸因）", "scope": "EVENT"},
    {"parameterName": "entry_referrer_domain", "displayName": "首次進站來源網域", "description": "工作階段首次進站之外部網域（跨頁保留歸因）", "scope": "EVENT"},
    {"parameterName": "landing_page_key", "displayName": "著陸頁標識", "description": "工作階段第一頁的 page_key", "scope": "EVENT"},
]

# User-scoped Custom Dimensions (16 / 25 GA4 standard quota)
USER_CUSTOM_DIMENSIONS = [
    {"parameterName": "user_demand_capability", "displayName": "使用者需求_模型能力", "description": "使用者最新填寫之最迫切模型能力", "scope": "USER"},
    {"parameterName": "user_demand_role", "displayName": "使用者需求_身份場景", "description": "使用者最新填寫之身份與使用場景", "scope": "USER"},
    {"parameterName": "user_demand_deployment", "displayName": "使用者需求_部署偏好", "description": "使用者最新填寫之部署環境偏好", "scope": "USER"},
    {"parameterName": "user_demand_pain_point", "displayName": "使用者需求_核心痛點", "description": "使用者最新填寫之最大痛點或導入卡關點", "scope": "USER"},
    {"parameterName": "user_demand_tags", "displayName": "使用者需求_標籤", "description": "使用者最新勾選之語言與領域需求標籤", "scope": "USER"},
    {"parameterName": "user_persona", "displayName": "推論使用者畫像", "description": "依行為自動推論之畫像（developer, researcher, enterprise, speech_creator）", "scope": "USER"},
    {"parameterName": "primary_model_interest", "displayName": "主要關注模型", "description": "使用者互動度最高的 OpenFormosa 模型", "scope": "USER"},
    {"parameterName": "engagement_tier", "displayName": "參與度分級", "description": "casual, engaged, power_user", "scope": "USER"},
    {"parameterName": "visitor_type", "displayName": "訪客類型", "description": "new_visitor 或 returning_visitor", "scope": "USER"},
    {"parameterName": "visit_frequency", "displayName": "回訪頻率區間", "description": "1, 2-3, 4-10, 10+ 次來訪區間", "scope": "USER"},
    {"parameterName": "viewport_class", "displayName": "裝置視窗分類", "description": "mobile, tablet, desktop", "scope": "USER"},
    {"parameterName": "preferred_theme", "displayName": "偏好的介面主題", "description": "light 或 dark", "scope": "USER"},
    {"parameterName": "hardware_concurrency", "displayName": "裝置CPU核心數", "description": "瀏覽器回報之邏輯核心數（區分開發工作站或行動裝置）", "scope": "USER"},
    {"parameterName": "network_type", "displayName": "網路連線類型", "description": "4g, 3g 等有效網路等級", "scope": "USER"},
    {"parameterName": "ui_language", "displayName": "介面語系", "description": "使用者實際選取之網站語系（zh-Hant / en）", "scope": "USER"},
    {"parameterName": "browser_language", "displayName": "瀏覽器原生語系", "description": "瀏覽器預設語系（與 ui_language 交叉比對語系痛點）", "scope": "USER"},
]

# Custom Metrics (15 / 50 GA4 standard quota)
CUSTOM_METRICS = [
    {"parameterName": "active_seconds", "displayName": "活躍閱讀秒數", "description": "訪客在頁面上的有效注意力秒數（增量不重複加總）", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "dwell_seconds", "displayName": "區塊停留秒數", "description": "觀看特定技術規格、文章章節或模型列表之有效停留秒數", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "time_to_scroll_seconds", "displayName": "到達滾動深度耗時", "description": "達到 25%~100% 深度所花費的時間", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "scroll_depth_threshold", "displayName": "滾動深度里程碑", "description": "scroll_milestone 觸發之百分比門檻（25/50/75/90/100）", "measurementUnit": "STANDARD", "scope": "EVENT"},
    {"parameterName": "max_scroll_depth", "displayName": "最大滾動深度", "description": "離開頁面時達到的最大百分比", "measurementUnit": "STANDARD", "scope": "EVENT"},
    {"parameterName": "listen_seconds", "displayName": "音訊收聽秒數", "description": "播放語音 demo 的時長", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "ttfa_seconds", "displayName": "首次互動耗時", "description": "載入頁面到第一次有效互動的秒數", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "lcp_ms", "displayName": "LCP載入毫秒", "description": "Largest Contentful Paint 效能指標（毫秒）", "measurementUnit": "MILLISECONDS", "scope": "EVENT"},
    {"parameterName": "inp_ms", "displayName": "INP互動延遲毫秒", "description": "Interaction to Next Paint 互動回應延遲（毫秒）", "measurementUnit": "MILLISECONDS", "scope": "EVENT"},
    {"parameterName": "cls_x1000", "displayName": "CLS版面位移(x1000)", "description": "Cumulative Layout Shift 乘以 1000（>100 需改善、>250 不佳）", "measurementUnit": "STANDARD", "scope": "EVENT"},
    {"parameterName": "ttfb_ms", "displayName": "TTFB首位元組毫秒", "description": "Time to First Byte 伺服器回應耗時（毫秒）", "measurementUnit": "MILLISECONDS", "scope": "EVENT"},
    {"parameterName": "read_ratio_percent", "displayName": "閱讀完成率", "description": "實際活躍閱讀秒數佔文章預估閱讀秒數之百分比", "measurementUnit": "STANDARD", "scope": "EVENT"},
    {"parameterName": "session_page_depth", "displayName": "工作階段瀏覽頁數", "description": "單一工作階段內目前已瀏覽之頁面深度", "measurementUnit": "STANDARD", "scope": "EVENT"},
    {"parameterName": "results_count", "displayName": "搜尋結果筆數", "description": "站內搜尋或標籤篩選回傳的文章數（0 代表無內容痛點）", "measurementUnit": "STANDARD", "scope": "EVENT"},
    {"parameterName": "interactions_count", "displayName": "單頁有效互動次數", "description": "單次頁面瀏覽內累積的有意義互動總次數", "measurementUnit": "STANDARD", "scope": "EVENT"},
]

# Key Events (Conversions — positive intent signals only so conversion rates stay clean!)
# Diagnostic pain-point events (search_no_results, demand_poll_abandon, ux_friction,
# page_not_found, js_error) are intentionally regular events rather than conversions.
KEY_EVENTS = [
    "user_demand_submit",
    "model_interest",
    "code_copy",
    "community_intent",
    "content_feedback",
    "developer_intent",
    "enterprise_intent",
]

RESERVED_PREFIXES = ("_", "firebase_", "ga_", "google_", "gtag_")
RESERVED_EVENT_PARAMS = {"firebase_conversion"}
RESERVED_USER_PROPS = {
    "first_open_after_install",
    "first_open_time",
    "first_visit_time",
    "last_deep_link_referrer",
    "user_id",
}
PARAM_RE = re.compile(r"^[a-z][a-z0-9_]{0,39}$")


def validate_definitions():
    errors = []
    if len(EVENT_CUSTOM_DIMENSIONS) > 50:
        errors.append(f"Too many event custom dimensions: {len(EVENT_CUSTOM_DIMENSIONS)} > 50")
    if len(USER_CUSTOM_DIMENSIONS) > 25:
        errors.append(f"Too many user custom dimensions: {len(USER_CUSTOM_DIMENSIONS)} > 25")
    if len(CUSTOM_METRICS) > 50:
        errors.append(f"Too many custom metrics: {len(CUSTOM_METRICS)} > 50")
    if len(KEY_EVENTS) > 30:
        errors.append(f"Too many key events: {len(KEY_EVENTS)} > 30")

    seen_dims = set()
    for d in EVENT_CUSTOM_DIMENSIONS + USER_CUSTOM_DIMENSIONS:
        p = d["parameterName"]
        s = d["scope"]
        if (p, s) in seen_dims:
            errors.append(f"Duplicate custom dimension: {(p, s)}")
        seen_dims.add((p, s))
        if not PARAM_RE.match(p):
            errors.append(f"Invalid parameterName format: {p}")
        if p.startswith(RESERVED_PREFIXES):
            errors.append(f"Reserved prefix in parameterName: {p}")
        if s == "EVENT" and p in RESERVED_EVENT_PARAMS:
            errors.append(f"Reserved event parameterName: {p}")
        if s == "USER" and p in RESERVED_USER_PROPS:
            errors.append(f"Reserved user propertyName: {p}")
        if len(d["displayName"]) > 82:
            errors.append(f"displayName too long (>82): {d['displayName']}")
        if len(d["description"]) > 150:
            errors.append(f"description too long (>150): {d['description']}")

    seen_metrics = set()
    for m in CUSTOM_METRICS:
        p = m["parameterName"]
        if p in seen_metrics:
            errors.append(f"Duplicate custom metric: {p}")
        seen_metrics.add(p)
        if not PARAM_RE.match(p) or p.startswith(RESERVED_PREFIXES):
            errors.append(f"Invalid metric parameterName: {p}")
        if len(m["displayName"]) > 82:
            errors.append(f"Metric displayName too long (>82): {m['displayName']}")
        if len(m["description"]) > 150:
            errors.append(f"Metric description too long (>150): {m['description']}")

    # Cross-check against assets/js/analytics.js & _includes/google-analytics.html if present
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    js_path = os.path.join(repo_root, "assets", "js", "analytics.js")
    ga_html_path = os.path.join(repo_root, "_includes", "google-analytics.html")
    if os.path.exists(js_path) and os.path.exists(ga_html_path):
        corpus = open(js_path, encoding="utf-8").read() + "\n" + open(ga_html_path, encoding="utf-8").read()
        for d in EVENT_CUSTOM_DIMENSIONS + USER_CUSTOM_DIMENSIONS:
            if d["parameterName"] not in corpus:
                errors.append(f"Dimension parameter '{d['parameterName']}' not found in analytics.js or google-analytics.html")
        for m in CUSTOM_METRICS:
            if m["parameterName"] not in corpus:
                errors.append(f"Metric parameter '{m['parameterName']}' not found in analytics.js or google-analytics.html")
        for ke in KEY_EVENTS:
            if f'"{ke}"' not in corpus and f"'{ke}'" not in corpus:
                errors.append(f"Key event '{ke}' not found in analytics.js")

    return errors


def get_token_from_service_account(sa_file):
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        creds = service_account.Credentials.from_service_account_file(
            sa_file,
            scopes=["https://www.googleapis.com/auth/analytics.edit"]
        )
        creds.refresh(Request())
        return creds.token
    except ImportError:
        print("Error: 'google-auth' is required for service account files. Run 'pip install google-auth'.", file=sys.stderr)
        sys.exit(1)


def normalize_property_id(prop):
    prop = prop.strip()
    return prop if prop.startswith("properties/") else f"properties/{prop}"


def api_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def list_paginated(requests_mod, url, key, token):
    items = {}
    next_url = url
    while next_url:
        resp = requests_mod.get(next_url, headers=api_headers(token))
        if resp.status_code == 401:
            print("Error: 401 Unauthorized. Access token is expired or invalid.", file=sys.stderr)
            sys.exit(1)
        if resp.status_code == 403:
            print("Error: 403 Forbidden. Insufficient permissions on this property.", file=sys.stderr)
            sys.exit(1)
        if resp.status_code != 200:
            print(f"Warning: GET {next_url} returned {resp.status_code}: {resp.text}", file=sys.stderr)
            break
        data = resp.json()
        for item in data.get(key, []):
            param = item.get("parameterName") or item.get("eventName")
            scope = item.get("scope", "")
            items[(param, scope)] = item
        next_token = data.get("nextPageToken")
        next_url = f"{url}?pageToken={next_token}" if next_token else None
    return items


def main():
    parser = argparse.ArgumentParser(description="Auto-configure GA4 v2.1 Custom Definitions, Key Events & Retention")
    parser.add_argument("--property-id", help="GA4 Property ID (numeric, e.g. 542906708)", default=os.getenv("GA_PROPERTY_ID"))
    parser.add_argument("--token", help="OAuth2 Access Token", default=os.getenv("GA_ACCESS_TOKEN"))
    parser.add_argument("--service-account", help="Path to Google Service Account JSON file", default=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    parser.add_argument("--dry-run", action="store_true", help="Validate all quotas, names, and code references without calling Google API")
    args = parser.parse_args()

    validation_errors = validate_definitions()
    if validation_errors:
        print("Validation failed:", file=sys.stderr)
        for err in validation_errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        print("Dry-run validation passed!")
        print(f"  Event Custom Dimensions : {len(EVENT_CUSTOM_DIMENSIONS)} / 50")
        print(f"  User Custom Dimensions  : {len(USER_CUSTOM_DIMENSIONS)} / 25")
        print(f"  Custom Metrics          : {len(CUSTOM_METRICS)} / 50")
        print(f"  Key Events              : {len(KEY_EVENTS)} / 30")
        return

    try:
        import requests
    except ImportError:
        print("Error: 'requests' library is required. Run 'pip install requests'.", file=sys.stderr)
        sys.exit(1)

    if not args.property_id:
        print("Error: --property-id is required (or set GA_PROPERTY_ID).", file=sys.stderr)
        sys.exit(1)

    token = args.token or (get_token_from_service_account(args.service_account) if args.service_account else None)
    if not token:
        print("Error: Provide --token or --service-account.", file=sys.stderr)
        sys.exit(1)

    prop = normalize_property_id(args.property_id)
    base = f"https://analyticsadmin.googleapis.com/v1beta/{prop}"
    print(f"Configuring GA4 Property: {prop}\n")

    # 1. Custom Dimensions (Event + User scoped)
    existing_dims = list_paginated(requests, f"{base}/customDimensions", "customDimensions", token)
    created_dims = 0
    for dim in EVENT_CUSTOM_DIMENSIONS + USER_CUSTOM_DIMENSIONS:
        k = (dim["parameterName"], dim["scope"])
        if k in existing_dims:
            print(f"  [EXISTS]  {dim['scope']:5s} {dim['displayName']} ({dim['parameterName']})")
            continue
        resp = requests.post(f"{base}/customDimensions", headers=api_headers(token), json=dim)
        if resp.status_code == 200:
            created_dims += 1
            print(f"  [CREATED] {dim['scope']:5s} {dim['displayName']} ({dim['parameterName']})")
        else:
            print(f"  [FAILED]  {dim['scope']:5s} {dim['displayName']}: {resp.text}")

    # 2. Custom Metrics
    existing_metrics = list_paginated(requests, f"{base}/customMetrics", "customMetrics", token)
    created_metrics = 0
    for metric in CUSTOM_METRICS:
        k = (metric["parameterName"], metric["scope"])
        if k in existing_metrics:
            print(f"  [EXISTS]  METRIC {metric['displayName']} ({metric['parameterName']})")
            continue
        resp = requests.post(f"{base}/customMetrics", headers=api_headers(token), json=metric)
        if resp.status_code == 200:
            created_metrics += 1
            print(f"  [CREATED] METRIC {metric['displayName']} ({metric['parameterName']})")
        else:
            print(f"  [FAILED]  METRIC {metric['displayName']}: {resp.text}")

    # 3. Key Events
    existing_keys = list_paginated(requests, f"{base}/keyEvents", "keyEvents", token)
    created_keys = 0
    for event_name in KEY_EVENTS:
        if (event_name, "") in existing_keys:
            print(f"  [EXISTS]  KEY_EVENT {event_name}")
            continue
        resp = requests.post(
            f"{base}/keyEvents",
            headers=api_headers(token),
            json={"eventName": event_name, "countingMethod": "ONCE_PER_EVENT"},
        )
        if resp.status_code == 200:
            created_keys += 1
            print(f"  [CREATED] KEY_EVENT {event_name}")
        else:
            print(f"  [FAILED]  KEY_EVENT {event_name}: {resp.text}")

    # 4. Data Retention -> 14 months
    ret_resp = requests.patch(
        f"{base}/dataRetentionSettings?updateMask=eventDataRetention,resetUserDataOnNewActivity",
        headers=api_headers(token),
        json={"eventDataRetention": "FOURTEEN_MONTHS", "resetUserDataOnNewActivity": True},
    )
    if ret_resp.status_code == 200:
        print("\n  [UPDATED] Data retention set to 14 months (reset on new activity: enabled).")
    else:
        print(f"\n  [WARN] Data retention update returned {ret_resp.status_code}: {ret_resp.text}")

    print(f"\nDone: {created_dims} dimensions, {created_metrics} metrics, {created_keys} key events created.")


if __name__ == "__main__":
    main()
