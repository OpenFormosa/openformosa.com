#!/usr/bin/env python3
"""
OpenFormosa — GA4 v2 Custom Definitions, Key Events & Data Retention Auto Setup Script

Automatically configures Google Analytics 4 (GA4) via the Google Analytics Admin API (v1beta):
  1. Event-scoped Custom Dimensions (20 items)
  2. User-scoped Custom Dimensions (12 items)
  3. Custom Metrics (9 items)
  4. Key Events / Conversions (6 items)
  5. Event Data Retention -> 14 months (maximum for standard GA4)

Prerequisites:
  1. Your GA4 Property ID (numeric ID, e.g. 542906708).
  2. An OAuth 2.0 Access Token or a Service Account with "Editor" permissions on the GA4 property.

Usage Examples:
  python3 scripts/setup_ga4_custom_definitions.py --property-id 542906708 --token YOUR_ACCESS_TOKEN
  python3 scripts/setup_ga4_custom_definitions.py --property-id 542906708 --service-account /path/to/sa.json
"""

import argparse
import os
import sys

try:
    import requests
except ImportError:
    print("Error: 'requests' library is required. Run 'pip install requests'.", file=sys.stderr)
    sys.exit(1)

# Event-scoped Custom Dimensions
EVENT_CUSTOM_DIMENSIONS = [
    {"parameterName": "page_key", "displayName": "頁面標識", "description": "首頁、模型頁、進度表、文章 slug 等", "scope": "EVENT"},
    {"parameterName": "page_type", "displayName": "頁面類型", "description": "home, post, models, roadmap, evaluation, training 等", "scope": "EVENT"},
    {"parameterName": "content_language", "displayName": "內容語系", "description": "zh-Hant 或 en", "scope": "EVENT"},
    {"parameterName": "outbound_category", "displayName": "出站類別", "description": "huggingface_model, huggingface_demo, github_repo, discord_community 等", "scope": "EVENT"},
    {"parameterName": "target_asset", "displayName": "目標資產", "description": "模型、Demo 或儲存庫名稱（如 Barbet, BlueMagpie-TTS-Demo）", "scope": "EVENT"},
    {"parameterName": "model_name", "displayName": "模型名稱", "description": "正規化之家族模型名（Barbet, BlueMagpie-TTS, PangolinTokenizer 等）", "scope": "EVENT"},
    {"parameterName": "milestone_label", "displayName": "閱讀里程碑", "description": "15s_skimmer, 60s_engaged_reader, 5min_thorough_reader 等", "scope": "EVENT"},
    {"parameterName": "read_quality", "displayName": "閱讀品質", "description": "bounce, skim, partial_read, deep_read, complete_read", "scope": "EVENT"},
    {"parameterName": "section_name", "displayName": "區塊名稱", "description": "status_board, model_family, roadmap_timeline, post_h2 等", "scope": "EVENT"},
    {"parameterName": "demand_capability", "displayName": "需求_模型能力", "description": "使用者許願最期待的模型（ASR、TTS、OCR 等）", "scope": "EVENT"},
    {"parameterName": "demand_role", "displayName": "需求_身份場景", "description": "使用者角色（Developer、Researcher、Enterprise 等）", "scope": "EVENT"},
    {"parameterName": "demand_deployment", "displayName": "需求_部署偏好", "description": "本機離線、私有 GPU 伺服器、雲端 API", "scope": "EVENT"},
    {"parameterName": "demand_tags", "displayName": "需求_標籤", "description": "使用者勾選之台灣語言與領域標籤（如 taigi,medical）", "scope": "EVENT"},
    {"parameterName": "demand_note", "displayName": "需求_備註許願", "description": "使用者自由填寫的具體需求詞彙（已去個資）", "scope": "EVENT"},
    {"parameterName": "feedback_type", "displayName": "文章回饋類型", "description": "helpful, want_to_run, want_more_detail, have_use_case", "scope": "EVENT"},
    {"parameterName": "search_term", "displayName": "搜尋字詞", "description": "站內搜尋關鍵字（含無結果搜尋需求）", "scope": "EVENT"},
    {"parameterName": "referrer_category", "displayName": "來源分類", "description": "ai_search, taiwan_community, github, huggingface, social, search 等", "scope": "EVENT"},
    {"parameterName": "entry_referrer_category", "displayName": "首次進站來源分類", "description": "工作階段首次進站之外部管道分類（跨頁保留歸因）", "scope": "EVENT"},
    {"parameterName": "entry_referrer_domain", "displayName": "首次進站來源網域", "description": "工作階段首次進站之外部網域（跨頁保留歸因）", "scope": "EVENT"},
    {"parameterName": "landing_page_key", "displayName": "著陸頁標識", "description": "工作階段第一頁的 page_key", "scope": "EVENT"},
]

# User-scoped Custom Dimensions (surfaces user_properties in standard GA4 reports!)
USER_CUSTOM_DIMENSIONS = [
    {"parameterName": "user_demand_capability", "displayName": "使用者需求_模型能力", "description": "使用者最新填寫之最迫切模型能力", "scope": "USER"},
    {"parameterName": "user_demand_role", "displayName": "使用者需求_身份場景", "description": "使用者最新填寫之身份與使用場景", "scope": "USER"},
    {"parameterName": "user_demand_deployment", "displayName": "使用者需求_部署偏好", "description": "使用者最新填寫之部署環境偏好", "scope": "USER"},
    {"parameterName": "user_demand_tags", "displayName": "使用者需求_標籤", "description": "使用者最新勾選之語言與領域需求標籤", "scope": "USER"},
    {"parameterName": "user_persona", "displayName": "推論使用者畫像", "description": "依行為自動推論之畫像（developer, researcher, enterprise, speech_creator）", "scope": "USER"},
    {"parameterName": "primary_model_interest", "displayName": "主要關注模型", "description": "使用者互動度最高的 OpenFormosa 模型", "scope": "USER"},
    {"parameterName": "engagement_tier", "displayName": "參與度分級", "description": "casual, engaged, power_user", "scope": "USER"},
    {"parameterName": "visitor_type", "displayName": "訪客類型", "description": "new_visitor 或 returning_visitor", "scope": "USER"},
    {"parameterName": "preferred_theme", "displayName": "偏好的介面主題", "description": "light 或 dark", "scope": "USER"},
    {"parameterName": "hardware_concurrency", "displayName": "裝置CPU核心數", "description": "瀏覽器回報之邏輯核心數（區分開發工作站或行動裝置）", "scope": "USER"},
    {"parameterName": "network_type", "displayName": "網路連線類型", "description": "4g, 3g 等有效網路等級", "scope": "USER"},
    {"parameterName": "ui_language", "displayName": "介面語系", "description": "使用者實際選取之網站語系（zh-Hant / en）", "scope": "USER"},
]

# Custom Metrics
CUSTOM_METRICS = [
    {"parameterName": "active_seconds", "displayName": "活躍閱讀秒數", "description": "訪客在頁面上的有效注意力秒數（增量不重複加總）", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "dwell_seconds", "displayName": "區塊停留秒數", "description": "觀看特定技術規格、文章章節或模型列表之有效停留秒數", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "time_to_scroll_seconds", "displayName": "到達滾動深度耗時", "description": "達到 25%~100% 深度所花費的時間", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "max_scroll_depth", "displayName": "最大滾動深度", "description": "離開頁面時達到的最大百分比", "measurementUnit": "STANDARD", "scope": "EVENT"},
    {"parameterName": "listen_seconds", "displayName": "音訊收聽秒數", "description": "播放語音 demo 的時長", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "ttfa_seconds", "displayName": "首次互動耗時", "description": "載入頁面到第一次有效互動的秒數", "measurementUnit": "SECONDS", "scope": "EVENT"},
    {"parameterName": "lcp_ms", "displayName": "LCP載入毫秒", "description": "Largest Contentful Paint 效能指標（毫秒）", "measurementUnit": "MILLISECONDS", "scope": "EVENT"},
    {"parameterName": "read_ratio_percent", "displayName": "閱讀完成率", "description": "實際活躍閱讀秒數佔文章預估閱讀秒數之百分比", "measurementUnit": "STANDARD", "scope": "EVENT"},
    {"parameterName": "session_page_depth", "displayName": "工作階段瀏覽頁數", "description": "單一工作階段內目前已瀏覽之頁面深度", "measurementUnit": "STANDARD", "scope": "EVENT"},
]

# Key Events (Conversions)
KEY_EVENTS = [
    "user_demand_submit",
    "model_interest",
    "code_copy",
    "community_intent",
    "content_feedback",
    "developer_intent",
]


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


def list_paginated(url, key, token):
    items = {}
    next_url = url
    while next_url:
        resp = requests.get(next_url, headers=api_headers(token))
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
    parser = argparse.ArgumentParser(description="Auto-configure GA4 v2 Custom Definitions, Key Events & Retention")
    parser.add_argument("--property-id", help="GA4 Property ID (numeric, e.g. 542906708)", default=os.getenv("GA_PROPERTY_ID"))
    parser.add_argument("--token", help="OAuth2 Access Token", default=os.getenv("GA_ACCESS_TOKEN"))
    parser.add_argument("--service-account", help="Path to Google Service Account JSON file", default=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
    args = parser.parse_args()

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
    existing_dims = list_paginated(f"{base}/customDimensions", "customDimensions", token)
    created_dims = 0
    for dim in EVENT_CUSTOM_DIMENSIONS + USER_CUSTOM_DIMENSIONS:
        k = (dim["parameterName"], dim["scope"])
        if k in existing_dims:
            print(f"  [EXISTS] {dim['scope']:5s} {dim['displayName']} ({dim['parameterName']})")
            continue
        resp = requests.post(f"{base}/customDimensions", headers=api_headers(token), json=dim)
        if resp.status_code == 200:
            created_dims += 1
            print(f"  [CREATED] {dim['scope']:5s} {dim['displayName']} ({dim['parameterName']})")
        else:
            print(f"  [FAILED]  {dim['scope']:5s} {dim['displayName']}: {resp.text}")

    # 2. Custom Metrics
    existing_metrics = list_paginated(f"{base}/customMetrics", "customMetrics", token)
    created_metrics = 0
    for metric in CUSTOM_METRICS:
        k = (metric["parameterName"], metric["scope"])
        if k in existing_metrics:
            print(f"  [EXISTS] METRIC {metric['displayName']} ({metric['parameterName']})")
            continue
        resp = requests.post(f"{base}/customMetrics", headers=api_headers(token), json=metric)
        if resp.status_code == 200:
            created_metrics += 1
            print(f"  [CREATED] METRIC {metric['displayName']} ({metric['parameterName']})")
        else:
            print(f"  [FAILED]  METRIC {metric['displayName']}: {resp.text}")

    # 3. Key Events
    existing_keys = list_paginated(f"{base}/keyEvents", "keyEvents", token)
    created_keys = 0
    for event_name in KEY_EVENTS:
        if (event_name, "") in existing_keys:
            print(f"  [EXISTS] KEY_EVENT {event_name}")
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
