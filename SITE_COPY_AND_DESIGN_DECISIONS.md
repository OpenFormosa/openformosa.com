# OpenFormosa Site Copy and Design Decisions

本文件記錄 OpenFormosa 網站目前已採用的文案、翻譯、視覺與 HTML 輸出決策。它取代原本的 `HOMEPAGE_COPY_DECISIONS.md`，用途不只限於首頁；之後修改 About、Models、Evaluation、Roadmap、Training、Blog 或其他頁面時，都應先參考這份文件。

目標讀者是人類維護者與 AI agent。請把本文件當成「目前網站風格與用語的來源」，不是靈感清單。若實際程式碼與本文件衝突，應先檢查是否最近修改後忘了更新文件。

## 核心定位

OpenFormosa 不是泛泛的 AI 願景頁。網站要讓第一次進站的人快速理解：

- OpenFormosa 在處理台灣語言情境與文件情境。
- 目前哪些模型、demo、技術報告或權重已經可以打開。
- 不同讀者下一步可以做什麼。
- 哪些項目已釋出，哪些仍在規劃。
- 開源與評測是信任機制，不只是發佈口號。

避免使用資訊量低或過度抽象的句子，例如：

- 以台灣為根
- 開啟新篇章
- 只停在願景頁
- 可部署的緊湊模型與評測系統
- 從台灣出發，面向世界

可以談「模型家族」「茄芷袋」「編織」「聲音、文字、影像與記憶」，但要連到可試用、可檢查、可部署或可貢獻的具體模型能力。

## 全站 Slogan

目前統一 slogan：

> 讓 AI 說出台灣，聽懂台灣，也讀懂台灣。

英文 fallback：

> Let AI speak Taiwan, hear Taiwan, and read Taiwan.

這組 slogan 已用在首頁 hero、About hero 與 footer 語氣。若需要拆行，拆成三段：

- 讓 AI 說出台灣，
- 聽懂台灣，
- 也讀懂台灣。

英文也對應拆成：

- Let AI speak Taiwan,
- hear Taiwan,
- and read Taiwan.

用語統一：

- 說出台灣
- 聽懂台灣
- 讀懂台灣
- 記住台灣

不要使用舊版：

- 說得出台灣
- 聽得懂台灣
- 讀得懂台灣
- 記得住台灣

## 首頁 Hero

Hero eyebrow：

> 台灣語言情境的開源基礎模型

英文 fallback：

> Open foundation models for Taiwan's language contexts

Hero 主標使用全站 slogan。主標本身用三個 `span` 斷行，讓中文與英文都能在同樣節奏下換行。

Hero 說明方向：

- 通用大模型不一定理解台灣用語、台灣口音、台語、專有名詞與中英混雜句子。
- OpenFormosa 針對這些場景建立可開源、可微調、可在較低成本環境部署的模型與工具。

Hero CTA 不是普通按鈕列，而是三個大型入口區塊：

- 試效果 / 試 TTS Demo
- 自己跑 / 看模型與技術路線
- 一起幫忙 / 參與 Discord 討論

第二個入口「自己跑 / 看模型與技術路線」連到首頁錨點 `#status`，點擊後直接捲到「模型與技術路線」區塊，不跳去模型頁。

Hero logo 獨立放在右側，不需要卡片外框，也不使用紅綠藍三色外框。`openformosa-logo-780.png` 與 `openformosa-logo-780.webp` 使用透明背景。

## 模型與技術路線

首頁的「模型與技術路線」區塊合併原本四能力摘要與模型狀態列表。這區的目的不是再寫一段抽象說明，而是讓使用者看到目前可開啟的模型、demo、報告與規劃中分支。

四能力卡順序依目前釋出與技術路線排序：

1. 記住台灣 / Base・五色鳥
2. 說出台灣 / TTS・藍鵲
3. 聽懂台灣 / ASR・黑熊
4. 讀懂台灣 / OCR・梅花鹿

模型狀態列表順序：

1. PangolinTokenizer
2. Barbet 1B Base
3. BlueMagpie-TTS
4. BlackBear-ASR
5. SikaDeer-OCR

斷詞器要放第一個，因為它是共同基礎；接著才是 Base、TTS、ASR、OCR。

狀態說明使用 legend 與卡片內容即可，不要再加一段解釋「已釋出代表現在就有權重、demo 或技術報告可以打開」。

狀態翻譯：

- Shipped = 已釋出
- In progress = 研發中
- Planned = 規劃中
- Live demo = 線上試聽
- Read the log = 看開發紀錄
- See the roadmap = 看開發進度

## 台灣場景問題區

標題：

> 通用模型常出錯的台灣場景。

英文 fallback：

> Taiwan scenarios where generic models often fail.

維持四張卡，不要五張：

1. 專有名詞
2. 中英台混雜
3. 口音、語氣與朗讀內容
4. 文件與版面

「成本與私有部署」已移除，因為它不是這一區要處理的語言場景問題。

「台灣口音與語氣」與「新聞與導覽內容」合併，避免兩張卡內容重複。新聞稿、展覽導覽、教育內容應放進「口音、語氣與朗讀內容」。

小卡片 heading 不加句點，例如「專有名詞」不要寫成「專有名詞。」。英文小卡片 heading 也不硬加句點。

## Mission 區

標題：

> 會寫繁體中文，不代表懂台灣用語、口音與文化。

英文 fallback：

> Writing Traditional Chinese does not mean understanding usage, accents, and culture in Taiwan.

這段要同時涵蓋語音、文字、文件與文化脈絡，不要只講文件，也不要只講語音。重要詞彙包含：

- 台灣國語
- 台語與客語腔
- 注音
- 台羅
- 台語詞彙
- 中英混雜句子
- 台灣地址
- 機構名稱
- 新聞配音
- 展覽導覽
- 課堂逐字稿

若只是調整斷行，優先改 CSS 寬度或 `max-width`，不要為了排版把已確認的文字內容改掉。

## 使用對象區

標題：

> 誰適合使用 OpenFormosa。

英文 fallback：

> Who OpenFormosa is for.

不要使用「從你的角色選下一步。」作為標題。

目前四種對象：

- 教育與研究機構
- 開發貢獻者
- 合作單位
- 軟體整合商

「合作單位」包含媒體創作者、地方場館、公部門，不再另外拆出媒體、場館、公部門三張卡。

合作單位卡片要保持短句，避免單一卡片文字量明顯多於其他卡。目前條列：

- 媒體：Podcast、影片與字幕
- 場館：展覽導覽與典藏 OCR
- 公部門：公文摘要與資安部署

## 開源信任區

這區從「怎麼判斷有沒有用」改回開源信任脈絡。

Eyebrow：

> 開源是一種信任機制

標題：

> 我們開放的除了模型權重，還有評測模式。

英文 fallback：

> We open more than model weights. We also open evaluation methods.

描述方向：

- 開源是建立信任的方式。
- 除了模型權重，也公開台灣在地評測、benchmark 系統、model card、訓練經驗與核心實作。
- Demo、數字、限制、測試集、baseline、任務與實際使用差異要放在同一個脈絡裡。

避免段落最後只剩一個字或短詞掉行，例如「具。」。

## Manifesto 與計畫理念入口

Manifesto 第一段要保留以下元素：

- 模型家族
- 茄芷袋
- 編織
- 聲音、文字、影像與記憶
- 能被試用、檢查與部署的模型能力

目前中文方向：

> OpenFormosa 是一套開源 AI 模型家族，以茄芷袋為象徵，把台灣的聲音、文字、影像與記憶，編織成能被試用、檢查與部署的模型能力。

英文 fallback：

> OpenFormosa is an open family of AI models. With the Gaji bag (Taiwan Striped Bag) as its symbol, it weaves Taiwan's voices, texts, images, and memories into model capabilities people can try, inspect, and deploy.

不要使用「以台灣為根」。不要使用「而不是只停在願景頁」。

第二段使用較寬的合作語氣，不要寫成資料徵集清單。方向是：如果正在處理台灣語言、語音、文件或在地應用場景，歡迎討論測試、文件、模型整合、資料授權與合作；如果只是想看效果，就從 demo 與已釋出模型開始。

首頁最下方 manifesto 區保留「讀計畫理念」按鈕，連到 About 頁。

## About 頁

About 頁沿用首頁的文案原則：刪掉重複、抽象、資訊量低的說明，把真正有內容的句子放到正文段落，而不是 heading 旁邊的小字。

About hero 主標沿用首頁 hero 的三行斷行：

- 讓 AI 說出台灣，
- 聽懂台灣，
- 也讀懂台灣。

About hero 內文使用茄芷袋與編織意象，說明模型家族把台灣的聲音、文字、影像與記憶編織成可以被試用、檢查與部署的模型能力。

名字區不要使用：

> 名字本身就說明了一切：一個開放、可檢驗的台灣 AI 基礎模型，從台灣出發，面向世界。

目前方向：

- `Open` 說明開源、協作、可檢查的技術路線，以及模型權重、評測模式、model card、訓練經驗和核心工具可被檢查。
- `Formosa` 說明台灣語境，包含繁體中文、台灣國語、台語與客語腔、注音、台羅、地方口語、文件格式與文化記憶。

茄芷袋段落有實質內容，應放在主文位置：它是台灣日常物件，便宜、耐用、一眼就認得，象徵把聲音、文字、影像與記憶裝在一起並編織成可使用的模型能力。

About 頁信念卡片標題要短，避免換行壓迫卡片，例如：

- 不只是中文
- 小，但能用
- 開源是在建立信任
- 共用基底

避免在面向一般讀者的卡片內使用「模型頭」這類術語。改用「資料、訓練方式和評測規則」。

About 頁英文 section 標題若單字掉行，優先改短文案或放寬寬度。目前已使用：

- Taiwan is not a translation patch.
- Taiwan context is model work.

## Footer

Footer 描述不使用「以台灣為根」，也不使用「可部署的緊湊模型與評測系統」。

目前中文 footer：

> OpenFormosa 是開源 AI 基礎模型家族，理解台灣的語言、聲音、文件與文化，讓 AI 說出台灣，聽懂台灣，也讀懂台灣。

英文 footer：

> OpenFormosa is an open family of AI foundation models for Taiwan's languages, voices, documents, and culture, helping AI speak Taiwan, hear Taiwan, and read Taiwan.

右下角獨立 tagline 已移除，slogan 合併進 footer 主描述。

Copyright：

> © 2026 OpenFormosa

## 翻譯與用語

中文統一用「開源」，不要在首頁、About 或 footer 用「開放原始碼」。英文可用 `open` 或 `open source`，依句子語氣選擇。

品牌與技術名：

- GitHub、Discord、Hugging Face、Colab 保留英文品牌名。
- benchmark 可保留英文，必要時搭配「評測」。
- model card 可保留英文。
- Demo 可保留英文。
- Tokenizer 可視上下文翻成「斷詞器」；模型名稱 `PangolinTokenizer` 保留英文。
- 茄芷袋英文使用 `Gaji bag (Taiwan Striped Bag)`，不要使用 `jia-zhi bag`。
- 台羅英文使用 `Tâi-lô`，不要使用 `Tailo`。
- 台語英文使用 `Taigi`。
- 台灣華語英文使用 `Taiwan Mandarin`。
- 台灣國語視語境可譯為 `Taiwan Mandarin`，不要生硬直譯。

模型角色：

- Base・五色鳥
- TTS・藍鵲
- ASR・黑熊
- OCR・梅花鹿
- Tokenizer / 斷詞器

可見文案避免使用 dash 作為標點。正式名稱與技術名稱可以保留 hyphen，例如：

- BlueMagpie-TTS
- BlackBear-ASR
- SikaDeer-OCR
- OpenFormosa-Base
- byte-level BPE

## 標點規則

首頁與 About 頁的標題標點規則：

- `h1` 與大型 section `h2` 要有結尾標點。
- 中文陳述標題用 `。`。
- 中文問句用 `？`。
- 英文陳述標題用 `.`。
- 英文問句用 `?`。
- 小卡片 heading 不加句點。
- 模型名稱、狀態 badge、短標籤與 key label 不硬加標點。
- About 頁的 key label 不做中英互譯；中文版只寫中文，例如「可承載」；英文版只寫英文，例如 `Carries`。

## Metadata 與 HTML 輸出

目前社群分享 metadata 保留英文：

- `og:title`
- `og:description`
- `twitter:title`
- `twitter:description`

不要把 OG/Twitter metadata 改成中文。這是刻意決定，不是漏翻。

語言切換 JS 目前會更新：

- `document.title`
- `<meta name="description">`

語言切換 JS 不更新 OG/Twitter metadata。

`_layouts/default.html` 最前面的 Liquid 指令使用 whitespace trimming，確保產出的 HTML 第一行就是：

```html
<!doctype html>
```

不要在 `<!doctype html>` 前輸出空行。

## 視覺與排版決定

字重：

- 中文不使用 `font-weight: 900`。
- 目前 CSS 內原本的 `font-weight: 900` 已改為 `700`。

字級：

- `font-size` 使用 px，不使用 rem。
- 最小 `font-size` 為 `16px`。
- `font-size` 使用整數 px，不使用 `15.2px` 這類小數。
- 小數轉整數時依設計判斷，不一定四捨五入；例如 `15.2px` 改成 `16px`，`14.72px` 改成 `14px` 的舊判斷已被後續「最小 16px」規則覆蓋。

寬度與斷行：

- 若文字內容正確但斷行難看，優先調整 CSS width、`max-width` 或 block behavior，不要先改文案。
- Hero 與 About hero 的主標使用 `span { display: block; max-width: 100%; }` 控制三行斷行。
- `section-head h2:only-child` 可以放寬到 `max-width: none`，避免單一標題在不必要的位置換行。
- About 頁主文說明使用較寬的 `.about-section-lede`，避免英文或中文在奇怪位置換行。
- Manifesto、mission、footer 等長段落需要有足夠寬度，不要讓一句話被壓成過窄欄位。

卡片與框線：

- 卡片使用明確邊框與品牌色條，但 hero logo 不放在三色外框內。
- 卡片 heading 要短，避免因長標題造成卡片高度與閱讀節奏失衡。
- 合作單位、問題卡、About 信念卡都應避免單一卡片文字量明顯多於其他卡。

## 修改其他頁面時的檢查清單

修改其他頁面前，先確認：

- 是否沿用「說出台灣、聽懂台灣、讀懂台灣、記住台灣」這組動詞。
- 是否使用「開源」而不是「開放原始碼」。
- 是否避免「以台灣為根」等抽象句。
- 是否把具體內容放進正文，而不是堆在 heading 旁邊的小字。
- 是否保留英文 OG/Twitter metadata。
- 是否避免可見文案中的 dash 標點。
- 是否讓大型標題有標點、小卡 heading 無標點。
- 是否使用整數 px 字級，且最小 `16px`。
- 是否在排版問題上優先調整寬度，而不是改掉已確認的文案。
