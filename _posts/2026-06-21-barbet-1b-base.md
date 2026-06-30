---
layout: post
title: "Barbet 1B Base: a hybrid decoder-only language model for Traditional Chinese"
zh_title: "Barbet 1B Base：為繁體中文打造的混合式語言模型"
i18n_key: barbet
description: "A 1B-parameter hybrid decoder-only causal language model — global and sliding-window attention interleaved with Mamba, context up to 1M, embedding tying, built on PangolinTokenizer."
zh_description: "為繁體中文、多語與長上下文打造的十億級混合式因果語言模型——全域、滑動視窗注意力與 Mamba 交錯，最高支援 1M 上下文。"
date: 2026-06-21
category: research
tags: [pretrain, model, long-context, barbet]
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

**摘要**　Barbet 1B Base 是 Open Formosa 訓練堆疊產出的十億級純解碼器因果語言模型，最高支援 1M 上下文（262,144 tokens／256K 為原生訓練長度，並可透過 RoPE 外推至 1,048,576 tokens／1M）。它採用四層一循環的混合式設計——全域注意力、滑動視窗注意力與 Mamba 序列混合器交錯排列——在 256K 長序列下控制計算成本，同時保留週期性的全域資訊通道。透過將嵌入層與語言模型輸出頭綁定，模型把大型繁中／多語詞表的參數成本轉移到更深的模型主體。訓練分為一般預訓練、繁體中文中期訓練與漸進式長上下文延伸三階段，使用固定的 PangolinTokenizer 契約、嚴格資料治理與多層評估協議。

本文完整揭露架構取捨、tokenizer 契約、訓練配方、長上下文策略與評估結果，並嚴格區分 256K **原生上下文**與 1M **RoPE 外推**設定。Barbet 1B Base 是研究用基底模型，不是對話助理。

</div>

**本文重點**

- **混合式解碼器架構**——以「全域注意力 → 滑動視窗注意力 → 滑動視窗注意力 → Mamba 序列混合器」四層一循環，同時保留全域資訊通道、低成本局部視窗與另類序列混合。
- **256K 原生、1M 外推**——以漸進式延伸訓練到 262,144 tokens 原生上下文，並提供 RoPE 線性外推到 1M 的研究設定；兩者嚴格區分，不混為一談。
- **穩定的 tokenizer 契約**——全程使用固定的 PangolinTokenizer，確保繁體中文在訓練與推論時的高壓縮效率。
- **跨模型評估領先**——在 TAIDE-14 任務集上以 **0.7488 bits/byte** 取得同級十億參數公開模型第一，14 項任務中有 10 項排名第一。

## 為什麼需要一個繁中基底模型？

大型語言模型的品質不只取決於參數量和資料規模。tokenizer 設計、資料處理流程、訓練排程、長上下文擴展策略，乃至模型轉換的正確性與評估協議，每一環都影響最終表現。對繁體中文而言，挑戰更為具體：模型必須在多語一般能力、繁中語境理解、長文件處理、tokenizer 覆蓋率與部署成本之間取得平衡。

Barbet 1B Base 的目標很直接：建立一個可重現、可轉換、可延伸長上下文的十億級基底語言模型，作為繁體中文、多語與長上下文研究的起點。

本文將依序介紹模型的設計動機、架構選擇、tokenizer 契約、訓練流程、長上下文延伸策略，以及初步評估結果。

## 模型一覽

Barbet 1B Base 是一個純解碼器的因果語言模型，不是經過指令微調的對話助理。它的預期用途包括：繁體中文基底模型研究、多語預訓練與 tokenizer 行為研究、長上下文檢索與外推行為分析、混合式注意力架構研究，以及下游任務微調（語音辨識、語音合成、光學字元辨識等）。

核心規格如下：

| 項目 | 數值 |
|------|------|
| 模型家族 | Barbet |
| 邏輯解碼層數 | 28 |
| 隱藏維度 | 1536 |
| 前饋網路中間維度 | 5120 |
| 注意力頭數 | 16 |
| 鍵值頭數 | 2 |
| 詞表大小 | 114,944（含 Megatron 補齊）|
| tokenizer | PangolinTokenizer |
| 嵌入層／語言模型輸出頭 | 綁定共享 |
| 啟動函式 | SwiGLU |
| 正規化 | RMSNorm |
| 原生上下文長度 | 262,144 tokens（256K）|
| 滑動視窗大小 | 8192 |
| 訓練精度 | bf16 |
| 可載入參數量 | 1,088,124,920 |

模型不應直接用於需要安全對齊、事實保證或高風險決策的場景。

## 架構：混合式解碼器的設計取捨

### 為什麼不用純全域注意力？

對一個需要處理 256K tokens 的模型來說，讓每一層都執行全域注意力，計算成本會隨序列長度平方成長。但如果完全捨棄全域注意力，模型就失去了跨越整段文件交換資訊的能力。Barbet 的解法是混合：在大多數層使用低成本的區域機制，但每隔固定間距保留一層全域注意力，確保資訊仍能流通整段序列。

### 四層一循環的混合設計

Barbet 採用四層一循環的固定模式：

```
全域注意力 → 滑動視窗注意力 → 滑動視窗注意力 → Mamba 序列混合器
```

28 層的完整分配如下：

| 層類型 | 對應層號 |
|--------|---------|
| 全域注意力 | 0, 4, 8, 12, 16, 20, 24 |
| 滑動視窗注意力 | 1, 2, 5, 6, 9, 10, 13, 14, 17, 18, 21, 22, 25, 26 |
| Mamba 序列混合器 | 3, 7, 11, 15, 19, 23, 27 |

這個設計讓模型同時具備三種特性：全域注意力層提供跨越整段序列的資訊通道，滑動視窗層以固定 8192 tokens 的窗口高效處理局部上下文，Mamba 層則提供不同於注意力機制的序列混合方式，在逐步解碼時具有不同的狀態行為。

### 每個解碼區塊的內部結構

每個邏輯解碼區塊的計算流程為：

```
RMSNorm → 序列混合器 → 殘差連接 → RMSNorm → SwiGLU 前饋網路 → 殘差連接
```

序列混合器依層號不同，分別是全域注意力、滑動視窗注意力或 Mamba 混合器。

### 注意力層的設定

所有注意力層採用分組查詢注意力（GQA），16 個查詢頭共享 2 個鍵值頭。這使鍵值快取的記憶體需求降到八分之一。其他關鍵設定包括：每頭維度 128、啟用查詢與鍵的 RMSNorm、使用旋轉位置編碼（RoPE，基底頻率 10,000,000）、丟棄率為零。

全域注意力層執行標準因果注意力。滑動視窗層則限制每個查詢只關注最近 8192 個 tokens。兩者交替排列，使大部分層的計算壓力集中在局部視窗，而全域資訊每四層更新一次。

### Mamba 序列混合器層

Mamba 層的關鍵參數為：狀態維度 64、卷積核寬度 4、擴展係數 2、每頭維度 128、分組數 2。

在 HuggingFace 載入時，若環境安裝了 `mamba_ssm`，模型會使用融合的 Mamba2 掃描路徑。若無此套件，則退回到純 PyTorch 的通用實作。後者主要用於可攜性測試與除錯，不保證與 Megatron 訓練路徑完全一致。

### 多步預測輔助目標

訓練時除了標準的下一個 token 預測損失外，還加入多步預測輔助損失。模型額外預測 t+2（權重 0.2）與 t+3（權重 0.1）位置的 token。匯出至 HuggingFace 的模型僅包含主要因果語言模型路徑，多步預測頭為訓練專用元件，不用於生成。

### 參數再平衡：為什麼綁定嵌入層？

繁體中文與多語 tokenizer 的詞表通常較大。若輸出投射層不與嵌入層共享權重，十億級模型會將過高比例的參數分配在詞表上，壓縮了模型主體的容量。Barbet 透過綁定嵌入層與語言模型輸出頭，將節省的參數預算投入更深的模型主體，在相近參數量下取得更大的建模能力。這是 R2 參數再平衡策略的核心。

## tokenizer：PangolinTokenizer 的契約

模型使用固定的 PangolinTokenizer，訓練流程中不重新訓練 tokenizer。tokenizer 契約的核心數字為：

| 項目 | 數值 |
|------|------|
| 基礎 BPE 詞表 | 114,688 |
| 保留特殊 token | 169 |
| 有效詞表 | 114,822 |
| Megatron 補齊後詞表 | 114,944 |

特殊 token 的 ID 分配為：`<unk>` = 114688、`<s>` = 114689、`</s>` = 114690、`<pad>` = 114691。

訓練時不由 tokenizer 自動插入開頭或結尾標記。每篇文件由 Megatron 預處理附加一個 `</s>` 作為文件結束標記。條件標記（若存在於文字中）必須保持為單一 token ID，不得被拆分。訓練與驗證均使用相同的 tokenizer 契約，避免分詞漂移。

正式資料建置前必須驗證：開頭／結尾／填充／未知 token 的 ID 正確性、保留特殊 token 的單一 ID 性質、有效詞表覆蓋率、Megatron 補齊後的詞表大小與檢查點權重形狀一致、不隱式插入開頭或結尾標記、tokenizer 版本不可變性。

## 資料：治理原則與處理流程

### 訓練語料的抽象類別

由於訓練資料來源不公開，本文僅描述資料類型與治理原則。訓練語料經去識別化後可分為以下類別：

| 抽象類別 | 用途 |
|---------|------|
| 一般文本 | 建立一般語言模型能力 |
| 繁體中文文本 | 強化繁中與在地語境 |
| 多語文本 | 維持跨語言與混語能力 |
| 長篇文件 | 支援長上下文與長文件建模 |
| 重播資料 | 降低階段轉換時的災難性遺忘 |
| 無標記冷卻資料 | 降低模型對後設資料前綴的依賴 |

### 資料治理閘門

訓練資料在進入預訓練管線前，需透過以下閘門：使用授權閘門（排除不符合內部使用政策的資料）、許可證閘門（排除授權狀態不允許的資料）、汙染閘門（降低驗證資料與訓練資料重疊）、完全去重（移除完全重複文件）、近似去重（移除或降權近重複內容）、品質過濾（移除低資訊密度、亂碼、模板汙染內容）、樣板過濾（移除導覽列、頁首頁尾、重複聲明）、token 計量（使用實際 tokenizer 計算 token 預算），以及訓練／驗證分割分離。

### 後設資料條件標記

模型訓練使用後設資料條件標記，使模型可在訓練時觀察語言、文體、領域或資料屬性相關的抽象標記。格式可抽象表示為：

```
<條件標記>
<來源標記>
文件內文
</s>
```

條件標記的目的是提供可學習的條件訊號，幫助模型區分語言、文體與領域，並在推論時提供可選的導引介面。為避免推論時的不匹配，訓練配方中設計了無標記冷卻階段，使模型在沒有後設資料前綴的情況下仍可穩定生成。

## 訓練：三階段流程

### 整體排程

Barbet 1B Base 採三階段訓練流程，總 token 預算約 1500 億 tokens：

```
第一階段：一般預訓練（建立通用語言能力）
第二階段：繁體中文中期訓練（將模型分布移向繁中語境）
第三階段：漸進式長上下文延伸（從 8K 逐步擴展到 256K）
```

### 各階段規格

| 階段 | 目標 | 序列長度 | 全域批次大小 | Token 預算 | 學習率排程 |
|------|------|---------|------------|-----------|----------|
| P1a | 一般預訓練 | 8192 | 480 | 900 億 | 預熱 → 4e-4 定值 |
| P1b | 無標記冷卻 | 8192 | 480 | 100 億 | 4e-4 定值 |
| P2a | 繁中中期訓練 | 8192 | 480 | 270 億 | 4e-4 → 8e-5 餘弦衰減 |
| P2b | 中期訓練冷卻 | 8192 | 480 | 30 億 | 8e-5 → 4e-5 餘弦衰減 |
| P3-32K | 上下文延伸 | 32768 | 96 | 60 億 | 4e-5 定值 |
| P3-64K | 上下文延伸 | 65536 | 48 | 40 億 | 4e-5 定值 |
| P3-128K | 上下文延伸 | 131072 | 24 | 40 億 | 4e-5 定值 |
| P3-256K | 最終延伸 | 262144 | 12 | 60 億 | 4e-5 → 1e-5 餘弦衰減 |

### 共用超參數

最佳化器為 AdamW（β₁ = 0.9、β₂ = 0.95、ε = 1e-8）。權重衰減 0.1，梯度裁剪 1.0，精度 bf16。訓練啟用 Transformer Engine，未啟用 FP8 與量化感知訓練。

### 第一階段：一般預訓練

第一階段的核心目標是建立穩定的語言模型基礎。此階段使用大規模去識別化一般語料，並包含少量目標語言重播，降低後續中期訓練前部分 token 嵌入過冷的風險。

此階段的驗證重點在於：訓練損失是否平滑下降、是否出現數值異常、tokenizer 與文件結束標記的管線是否正確、吞吐量是否達預期、檢查點是否可正常恢復。第一階段並非主要繁中能力提升階段，因此繁中驗證指標僅作趨勢參考。

P1b 為無標記冷卻。經過冷卻後，模型在沒有後設資料前綴的自然提示下仍可維持穩定的生成行為。

### 第二階段：繁體中文中期訓練

第二階段將模型分布移向繁體中文與在地語境。此階段資料經過更嚴格的去重、品質過濾與重播混合。主要目標包括：降低繁中驗證損失、提升在地化機率探測分數、保持一般語言能力不大幅退化、為後續長上下文延伸提供穩定檢查點。

P2b 為中期訓練後的無標記冷卻。學習率由中期訓練末段繼續衰減，使模型在進入長上下文訓練前取得更穩定的語言分布。

### 第三階段：漸進式長上下文延伸

第三階段逐步將序列長度從 8K 延伸到 256K：

```
8K → 32K → 64K → 128K → 256K
```

此階段的核心原則有七項。RoPE 基底頻率維持 10,000,000 不變。滑動視窗層的窗口維持 8192。全域注意力層保留完整因果注意力。長文件資料比例隨階段提高。保留短上下文重播以避免短文退化。每一階段從上一階段檢查點接續。晉級閘門依長文件困惑度與短上下文退化幅度決定。

上下文平行度隨序列長度增加：32K 階段為 4、64K 為 4、128K 為 8、256K 為 16。長上下文訓練同時啟用完整均勻重新計算，降低啟動記憶體的壓力。

## 長上下文：從 256K 原生到 1M 外推

### 256K 原生訓練目標

Barbet 1B Base 的原生訓練目標上下文長度為 256K tokens。模型設定為：

```json
{
  "max_position_embeddings": 262144,
  "rope_theta": 10000000,
  "sliding_window_size": 8192
}
```

長上下文能力由多項設計共同支撐：漸進式上下文訓練、高基底頻率的旋轉位置編碼、每四層一次的全域注意力、局部滑動視窗、Mamba 序列混合器、長文件訓練資料混合，以及短上下文重播的退化控制。

### 1M 研究用外推設定

1M 設定是推論時的 RoPE 線性外推，不是原生訓練：

```json
{
  "max_position_embeddings": 1048576,
  "rope_scaling": {
    "type": "linear",
    "factor": 4.0,
    "original_context_length": 262144
  }
}
```

256K 是原生預訓練上下文。1M 是同一組權重的 RoPE 外推設定。RoPE 不引入可學習位置參數，因此權重形狀相容。但實際 1M 前綴填充需要最佳化的長上下文執行環境，全域注意力層在一般實作下仍為平方複雜度。

這個區分至關重要。即使大海撈針測試在 1M 外推設定下有部分成功，也不能宣稱模型能可靠理解全部 1M 上下文。

## 評估

### 評估設計原則

Barbet 1B Base 採用多層次驗證。各驗證層次的用途如下：

| 驗證類型 | 用途 |
|---------|------|
| 訓練健康指標 | 確認數值穩定與可訓練性 |
| 語言模型損失 | 追蹤語言建模品質 |
| 位元組正規化損失 | 支援跨 tokenizer 比較 |
| 機率探測 | 測量配對式在地化與價值行為 |
| 長上下文檢索 | 測量不同距離的精確檢索 |
| 短上下文退化 | 確保長上下文訓練不破壞短任務 |
| 轉換一致性 | 確保 Megatron → HF 權重轉換正確 |
| 生成冒煙測試 | 確認載入與生成路徑可用 |

### 跨 tokenizer 比較的正確做法

不同 tokenizer 的 token 困惑度不可直接比較。Barbet 使用位元組正規化損失（bits per byte，BPB）作為跨 tokenizer 可比較的指標。這確保不同詞表大小的模型在公平的基礎上比較。

### 機率探測

機率探測使用配對式延續評分。對每個探測題，模型計算正面延續與負面延續的平均對數機率，若正面高於負面則計為正確。此評估可輸出配對正確率、各類別正確率、正負差距，以及階段性退化檢查。

### 結果

| 指標 | Barbet 1B 快照值 | 說明 |
|------|-----------------|------|
| 正規化語言模型損失 | 1.066 bits/byte | 位元組正規化 |
| 機率探測 | 387 / 500 | 配對式延續探測 |
| 大海撈針 32K | 32 / 32 | 原生上下文 |
| 大海撈針 64K | 28 / 32 | 原生上下文 |
| 大海撈針 128K | 25 / 32 | 原生上下文 |
| 大海撈針 256K | 20–23 / 32 | 原生上下文，跨次變異 |
| 大海撈針 512K | 24 / 32 | 外推評估 |
| 大海撈針 1M | 20–21 / 32 | 外推評估 |

<figure class="post-figure">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="niah-zh" xmlns="http://www.w3.org/2000/svg">
<title id="niah-zh">大海撈針檢索命中數</title>
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">大海撈針檢索命中數（滿分 32）</text>
<text x="280" y="38" fill="var(--green)" font-size="12" font-weight="700" text-anchor="middle">原生上下文</text>
<text x="595" y="38" fill="var(--blue)" font-size="12" font-weight="700" text-anchor="middle">RoPE 外推</text>
<g stroke="var(--line)" stroke-width="1"><line x1="60" y1="40" x2="700" y2="40"/><line x1="60" y1="92.5" x2="700" y2="92.5"/><line x1="60" y1="145" x2="700" y2="145"/><line x1="60" y1="197.5" x2="700" y2="197.5"/><line x1="60" y1="250" x2="700" y2="250"/></g>
<g fill="var(--muted)" font-size="11" text-anchor="end"><text x="50" y="44">32</text><text x="50" y="96.5">24</text><text x="50" y="149">16</text><text x="50" y="201.5">8</text><text x="50" y="254">0</text></g>
<line x1="490" y1="40" x2="490" y2="250" stroke="var(--line-strong)" stroke-width="1" stroke-dasharray="4 4" opacity="0.45"/>
<rect x="93.5" y="40" width="58" height="210" rx="2" fill="var(--green)"/>
<rect x="198.5" y="66.25" width="58" height="183.75" rx="2" fill="var(--green)"/>
<rect x="303.5" y="85.94" width="58" height="164.06" rx="2" fill="var(--green)"/>
<rect x="408.5" y="118.75" width="58" height="131.25" rx="2" fill="var(--green)"/>
<rect x="408.5" y="99.06" width="58" height="19.69" rx="2" fill="var(--green)" opacity="0.4"/>
<rect x="513.5" y="92.5" width="58" height="157.5" rx="2" fill="var(--blue)"/>
<rect x="618.5" y="118.75" width="58" height="131.25" rx="2" fill="var(--blue)"/>
<rect x="618.5" y="112.19" width="58" height="6.56" rx="2" fill="var(--blue)" opacity="0.4"/>
<g font-size="12.5" font-weight="700" text-anchor="middle" fill="var(--paper-ink)"><text x="122.5" y="32">32</text><text x="227.5" y="58">28</text><text x="332.5" y="78">25</text><text x="437.5" y="91">20–23</text><text x="542.5" y="84">24</text><text x="647.5" y="104">20–21</text></g>
<g fill="var(--muted)" font-size="12" text-anchor="middle"><text x="122.5" y="268">32K</text><text x="227.5" y="268">64K</text><text x="332.5" y="268">128K</text><text x="437.5" y="268">256K</text><text x="542.5" y="268">512K</text><text x="647.5" y="268">1M</text></g>
</svg>
<figcaption><b>圖 1.</b> 大海撈針（needle-in-a-haystack）檢索在不同上下文長度的命中數，每個長度共 32 題。32K–256K 為原生上下文評估，512K、1M 為 RoPE 外推評估；淺色延伸段表示跨次重跑的變異範圍。檢索成功並不等同於模型能完整理解整段上下文。</figcaption>
</figure>

結果顯示幾項重點。模型在 HuggingFace 載入與轉換正確性上穩定。與 Megatron 檢查點的貪心解碼行為高度接近。在 256K 原生上下文下具備長上下文檢索能力。在 512K 與 1M 外推設定下仍保有部分檢索能力。在位元組正規化損失上可作為繁中／多語基底模型的後續研究檢查點。

### 長上下文評估的警語

大海撈針類測試主要衡量精確檢索。它不能證明模型可完整理解 1M tokens、具備穩健的多跳推理、能穩定處理所有長文任務，也不能將 1M 外推等同於原生 1M 訓練。因此本文在所有結果中嚴格區分「原生上下文評估」與「外推上下文評估」。

### TAIDE-14 跨模型比較

為了在同級模型間做公平比較，我們在 TAIDE-14 任務集（`taide/TAIDE-14-tasks`，14 項任務、共 140 筆樣本）上以位元組正規化損失（bits per byte，BPB）評估 Barbet 1B Base 與三個十億級公開模型：`openbmb/MiniCPM5-1B-Base`、`meta-llama/Llama-3.2-1B`、`LiquidAI/LFM2.5-1.2B-Instruct`。所有模型均無樣本被截斷。BPB 以目標 token 的負對數似然除以評估文字的 UTF-8 位元組數計算，消除了不同 tokenizer 詞表大小與切分粒度對困惑度的影響，使跨模型比較具有可比性。

<figure class="post-figure">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="bpb-zh" xmlns="http://www.w3.org/2000/svg">
<title id="bpb-zh">TAIDE-14 bits-per-byte 跨模型比較</title>
<text x="0" y="22" fill="var(--paper-ink)" font-size="15" font-weight="700">TAIDE-14 · response_only · bits/byte（越低越好）</text>
<g stroke="var(--line)" stroke-width="1"><line x1="230" y1="56" x2="230" y2="255"/><line x1="330" y1="56" x2="330" y2="255"/><line x1="430" y1="56" x2="430" y2="255"/><line x1="530" y1="56" x2="530" y2="255"/><line x1="630" y1="56" x2="630" y2="255"/></g>
<g fill="var(--muted)" font-size="11" text-anchor="middle"><text x="230" y="272">0</text><text x="330" y="272">0.5</text><text x="430" y="272">1.0</text><text x="530" y="272">1.5</text><text x="630" y="272">2.0</text></g>
<rect x="230" y="70" width="149.8" height="30" rx="2" fill="var(--green)"/>
<rect x="230" y="120" width="151.5" height="30" rx="2" fill="var(--blue)"/>
<rect x="230" y="170" width="183.8" height="30" rx="2" fill="var(--muted)"/>
<rect x="230" y="220" width="401.6" height="30" rx="2" fill="var(--muted)" opacity="0.5"/>
<g fill="var(--paper-ink)" font-size="12.5" text-anchor="end"><text x="218" y="89">voidful/barbet-1b-base</text><text x="218" y="139">openbmb/MiniCPM5-1B-Base</text><text x="218" y="189">meta-llama/Llama-3.2-1B</text><text x="218" y="239">LiquidAI/LFM2.5-1.2B-Instruct</text></g>
<g font-size="12.5" font-weight="700" fill="var(--paper-ink)"><text x="385.8" y="89" fill="var(--green)">0.7488</text><text x="387.5" y="139">0.7577</text><text x="419.8" y="189">0.9190</text><text x="637.6" y="239">2.0082</text></g>
</svg>
<figcaption><b>圖 2.</b> TAIDE-14（140 筆樣本）在 response_only 協議下的 bits per byte，數值越低代表建模與壓縮效率越好。Barbet 1B Base 以 <b>0.7488 bits/byte</b> 領先同級十億參數公開模型。BPB 衡量基底模型對目標文字的建模機率，並非指令遵循或對話品質。</figcaption>
</figure>

在 response_only 協議下（僅評估正面回應文字的損失，不含 prompt 前綴），整體排名如下：

| 排名 | 模型 | bits/byte | tokens/byte | 樣本數 |
|:----:|------|----------:|------------:|------:|
| 1 | `voidful/barbet-1b-base` | 0.7488 | 0.2164 | 140 |
| 2 | `openbmb/MiniCPM5-1B-Base` | 0.7577 | 0.2804 | 140 |
| 3 | `meta-llama/Llama-3.2-1B` | 0.9190 | 0.2960 | 140 |
| 4 | `LiquidAI/LFM2.5-1.2B-Instruct` | 2.0082 | 0.3408 | 140 |

Barbet 以 0.7488 bits/byte 領先 MiniCPM5 的 0.7577，差距 0.0089 bits/byte；與 Llama-3.2-1B 的差距為 0.1702。值得注意的是 tokens/byte 一欄：PangolinTokenizer 將每個位元組切為 0.2164 個 token，是四個模型中最低的——代表它對繁體中文有更高的壓縮效率，每個 token 平均承載更多資訊。

逐項任務上，Barbet 在 14 項中有 10 項排名第一：

| 任務 | Barbet 排名 | Barbet bits/byte | 最佳模型 | 最佳 bits/byte |
|------|:----------:|----------------:|---------|--------------:|
| 分類 | 1 | 0.7302 | Barbet | 0.7302 |
| 問答 | 1 | 0.7042 | Barbet | 0.7042 |
| 寫作 | 2 | 0.6975 | MiniCPM5 | 0.6968 |
| 寫信 | 2 | 0.7223 | MiniCPM5 | 0.7120 |
| 對話生成 | 1 | 0.6994 | Barbet | 0.6994 |
| 常識推理 | 1 | 0.7385 | Barbet | 0.7385 |
| 情緒分析 | 1 | 0.8376 | Barbet | 0.8376 |
| 抽取 | 1 | 0.8061 | Barbet | 0.8061 |
| 推薦 | 2 | 0.7842 | MiniCPM5 | 0.7677 |
| 提供建議 | 2 | 0.7110 | MiniCPM5 | 0.6930 |
| 摘要 | 1 | 0.8295 | Barbet | 0.8295 |
| 文本分析 | 1 | 0.7238 | Barbet | 0.7238 |
| 翻譯 | 1 | 0.8402 | Barbet | 0.8402 |
| 開放式生成 | 1 | 0.7825 | Barbet | 0.7825 |

Barbet 排名第二的四項任務（寫作、寫信、推薦、提供建議）皆由 MiniCPM5 取得最佳，但多數差距落在 0.02 bits/byte 以內。須強調的是，這裡比較的是基底模型的語言建模效率，而非經對齊後的助理表現。

## 設計取捨與反思

Barbet 1B Base 的設計反映了十億級模型在繁體中文、多語與長上下文場景中的幾個實務權衡。

第一，詞表參數的再分配。繁中與多語 tokenizer 的詞表通常較大。綁定嵌入層與輸出頭，將節省的參數投入更深的模型主體，是在固定參數預算下提升模型容量的直接手段。

第二，混合式注意力的成本控制。純全域注意力在 256K 序列下成本過高。以全域、滑動視窗與 Mamba 交錯排列，模型保留了週期性的全域資訊通道，同時將大部分層的計算壓力限制在局部視窗。Mamba 層在逐步解碼時具有不同於注意力鍵值快取的狀態行為，提供額外的序列混合多樣性。

第三，漸進式長上下文延伸的務實選擇。直接原生 1M 訓練的成本與穩定性風險過高。漸進延伸使每個階段都有明確的晉級閘門。1M 設定被清楚定位為外推附帶設定，不是原生訓練宣稱。這個區分對避免過度宣稱至關重要。

第四，工程透明度。技術報告完整揭露管線、資料治理、tokenizer 契約、訓練配方、評估協議與模型卡。這使後續研究者可重現流程、驗證轉換正確性，並在此基礎上進行下游微調。

## 安全、倫理與限制

Barbet 1B Base 是基底模型，未經指令微調或安全對齊。模型可能出現：幻覺、有害續寫、提示漂移、重複、不安全的生成、類記憶行為、偏誤或文化敏感續寫，以及無法拒絕有害指令。

因此，任何面向使用者的應用均需額外進行指令微調、安全調校、紅隊測試與政策執行。不建議直接部署為對話助理，也不建議用於醫療、法律、金融等需要專業保證的場景。

1M 外推設定也不應被誤稱為原生 1M 預訓練。即使大海撈針在 1M 設定下部分成功，也不代表模型能可靠理解全部 1M 上下文。

## 結語

Barbet 1B Base 是 Open Formosa 訓練堆疊產出的十億級混合式因果語言模型。模型最高支援 1M 上下文（256K 為原生訓練長度，並可 RoPE 外推至 1M），採用全域注意力、滑動視窗注意力與 Mamba 序列混合器的交錯設計，透過嵌入層綁定將大型詞表的參數成本轉移至更深的模型主體。訓練流程涵蓋一般預訓練、繁體中文中期訓練與漸進式長上下文延伸，並使用固定 tokenizer 契約、嚴格資料治理、穩定訓練閘門、多層評估與 Megatron 至 HuggingFace 的轉換驗證。

模型應被視為研究用基底模型。它不是對話助理，也不應被宣稱為原生 1M 預訓練模型。未來工作方向包括：指令微調、安全對齊、量化感知訓練實驗、更多留出集的位元組正規化評估、長上下文推理測試，以及更嚴格的轉換一致性與推論執行環境驗證。

```bibtex
@techreport{barbet1bbase2026,
  title     = {Barbet 1B Base: A Hybrid Decoder-Only Causal Language Model
               for Traditional Chinese, Multilingual Pretraining,
               and Long-Context Modeling},
  author    = {Open Formosa / Barbet Contributors},
  year      = {2026},
  institution = {Open Formosa},
  note      = {Training data sources are not disclosed.}
}
```

</div>

<div class="post-lang-en" markdown="1">

<div class="post-abstract" markdown="1">

**Abstract**　Barbet 1B Base is a billion-parameter decoder-only causal language model produced by the Open Formosa training stack, supporting context up to 1M tokens (262,144 / 256K is the native training length, RoPE-extrapolated to 1,048,576 / 1M). It uses a four-layer repeating hybrid design — global attention, sliding-window attention, and a Mamba sequence mixer interleaved — to keep compute under control at 256K sequence length while preserving a periodic global information channel. By tying the embedding layer to the language-model output head, the model shifts the parameter cost of a large Traditional-Chinese / multilingual vocabulary into a deeper model body. Training proceeds in three stages — general pretraining, Traditional-Chinese mid-training, and progressive long-context extension — under a fixed PangolinTokenizer contract, strict data governance, and a multi-layer evaluation protocol.

This report fully discloses the architectural trade-offs, the tokenizer contract, the training recipe, the long-context strategy, and the evaluation results, and strictly separates the 256K **native context** from the 1M **RoPE-extrapolation** configuration. Barbet 1B Base is a research base model, not a conversational assistant.

</div>

**Key points**

- **A hybrid decoder architecture** — a four-layer repeating motif (global attention → sliding-window attention → sliding-window attention → Mamba sequence mixer) that keeps a periodic global information channel, a low-cost local window, and an alternative sequence-mixing path all at once.
- **256K native, 1M extrapolation** — progressively trained to a 262,144-token native context, with a RoPE linear-extrapolation configuration to 1M offered for research; the two are kept strictly distinct.
- **A stable tokenizer contract** — a fixed PangolinTokenizer throughout, giving high compression efficiency for Traditional Chinese at both training and inference time.
- **Leading cross-model evaluation** — on the TAIDE-14 task set, Barbet reaches **0.7488 bits/byte**, first among comparable billion-parameter public models, and ranks first on 10 of 14 tasks.

## Why build a Traditional-Chinese base model?

The quality of a large language model is not determined by parameter count and data scale alone. Tokenizer design, the data-processing pipeline, the training schedule, the long-context extension strategy, and even the correctness of model conversion and the evaluation protocol — every link shapes the final result. For Traditional Chinese the challenges are more concrete: a model must balance general multilingual ability, Traditional-Chinese contextual understanding, long-document processing, tokenizer coverage, and deployment cost.

The goal of Barbet 1B Base is direct: to build a reproducible, convertible, long-context-extensible billion-parameter base language model as a starting point for Traditional-Chinese, multilingual, and long-context research.

This article introduces, in order, the model's design motivation, architectural choices, tokenizer contract, training pipeline, long-context extension strategy, and preliminary evaluation results.

## The model at a glance

Barbet 1B Base is a pure decoder-only causal language model — not an instruction-tuned conversational assistant. Its intended uses include: Traditional-Chinese base-model research; multilingual pretraining and tokenizer-behavior research; long-context retrieval and extrapolation-behavior analysis; hybrid-attention architecture research; and downstream task fine-tuning (speech recognition, speech synthesis, optical character recognition, and so on).

Core specifications:

| Item | Value |
|------|------|
| Model family | Barbet |
| Logical decoder layers | 28 |
| Hidden dimension | 1536 |
| Feed-forward intermediate dimension | 5120 |
| Attention heads | 16 |
| Key/value heads | 2 |
| Vocabulary size | 114,944 (with Megatron padding) |
| Tokenizer | PangolinTokenizer |
| Embedding / LM output head | Tied (shared) |
| Activation | SwiGLU |
| Normalization | RMSNorm |
| Native context length | 262,144 tokens (256K) |
| Sliding-window size | 8192 |
| Training precision | bf16 |
| Loadable parameters | 1,088,124,920 |

The model should not be used directly in scenarios requiring safety alignment, factual guarantees, or high-stakes decisions.

## Architecture: trade-offs in a hybrid decoder

### Why not pure global attention?

For a model that must process 256K tokens, running global attention at every layer makes compute grow quadratically with sequence length. But discarding global attention entirely would cost the model its ability to exchange information across an entire document. Barbet's answer is a hybrid: most layers use a low-cost local mechanism, while at fixed intervals one global-attention layer is kept, ensuring information can still flow across the whole sequence.

### A four-layer repeating hybrid pattern

Barbet uses a fixed four-layer repeating pattern:

```
Global attention → Sliding-window attention → Sliding-window attention → Mamba sequence mixer
```

The full allocation across the 28 layers:

| Layer type | Layer indices |
|--------|---------|
| Global attention | 0, 4, 8, 12, 16, 20, 24 |
| Sliding-window attention | 1, 2, 5, 6, 9, 10, 13, 14, 17, 18, 21, 22, 25, 26 |
| Mamba sequence mixer | 3, 7, 11, 15, 19, 23, 27 |

This design gives the model three properties at once: global-attention layers provide an information channel spanning the whole sequence; sliding-window layers handle local context efficiently with a fixed 8192-token window; and Mamba layers provide a sequence-mixing mechanism distinct from attention, with different state behavior during step-by-step decoding.

### Inside each decoder block

The compute flow of each logical decoder block is:

```
RMSNorm → sequence mixer → residual → RMSNorm → SwiGLU feed-forward → residual
```

The sequence mixer is, depending on the layer index, global attention, sliding-window attention, or a Mamba mixer.

### Attention-layer configuration

All attention layers use grouped-query attention (GQA): 16 query heads share 2 key/value heads, cutting the KV-cache memory requirement to one-eighth. Other key settings: head dimension 128; RMSNorm applied to queries and keys; rotary position embeddings (RoPE, base frequency 10,000,000); dropout zero.

Global-attention layers perform standard causal attention. Sliding-window layers restrict each query to attend to only the most recent 8192 tokens. The two alternate, concentrating most layers' compute pressure in a local window while global information is refreshed once every four layers.

### Mamba sequence-mixer layers

Key Mamba parameters: state dimension 64, convolution kernel width 4, expansion factor 2, head dimension 128, group count 2.

When loaded in HuggingFace, if `mamba_ssm` is installed the model uses the fused Mamba2 scan path. Without that package, it falls back to a pure-PyTorch reference implementation. The latter is mainly for portability testing and debugging, and is not guaranteed to be identical to the Megatron training path.

### Multi-step prediction auxiliary objective

During training, in addition to the standard next-token prediction loss, a multi-step prediction auxiliary loss is added. The model also predicts the tokens at positions t+2 (weight 0.2) and t+3 (weight 0.1). The model exported to HuggingFace contains only the main causal-LM path; the multi-step prediction heads are training-only components and are not used for generation.

### Parameter rebalancing: why tie the embeddings?

Traditional-Chinese and multilingual tokenizers usually have large vocabularies. If the output projection does not share weights with the embedding layer, a billion-parameter model allocates too large a fraction of its parameters to the vocabulary, squeezing the capacity of the model body. By tying the embedding layer to the LM output head, Barbet invests the saved parameter budget into a deeper model body, gaining more modeling capacity at a comparable parameter count. This is the core of the R2 parameter-rebalancing strategy.

## Tokenizer: the PangolinTokenizer contract

The model uses a fixed PangolinTokenizer; the tokenizer is not retrained during the training pipeline. The core numbers of the tokenizer contract:

| Item | Value |
|------|------|
| Base BPE vocabulary | 114,688 |
| Reserved special tokens | 169 |
| Effective vocabulary | 114,822 |
| Megatron-padded vocabulary | 114,944 |

Special-token ID assignments: `<unk>` = 114688, `<s>` = 114689, `</s>` = 114690, `<pad>` = 114691.

The tokenizer does not automatically insert beginning- or end-of-sequence markers during training. Each document is appended a single `</s>` as an end-of-document marker by Megatron preprocessing. Conditioning markers (when present in the text) must remain a single token ID and must not be split. Training and validation use the same tokenizer contract to avoid tokenization drift.

Before formal data construction, the following must be verified: the correctness of the BOS / EOS / PAD / UNK token IDs; the single-ID nature of reserved special tokens; effective-vocabulary coverage; that the Megatron-padded vocabulary size matches the checkpoint weight shapes; that no BOS or EOS marker is implicitly inserted; and tokenizer-version immutability.

## Data: governance principles and processing pipeline

### Abstract categories of the training corpus

Because the training-data sources are not public, this article describes only the data types and governance principles. After de-identification, the training corpus can be divided into the following categories:

| Abstract category | Purpose |
|---------|------|
| General text | Build general language-model ability |
| Traditional-Chinese text | Strengthen Traditional Chinese and local context |
| Multilingual text | Maintain cross-lingual and code-mixing ability |
| Long documents | Support long-context and long-document modeling |
| Replay data | Reduce catastrophic forgetting across stage transitions |
| Unmarked cooldown data | Reduce the model's dependence on metadata prefixes |

### Data-governance gates

Before entering the pretraining pipeline, training data must pass the following gates: a usage-license gate (excluding data that does not meet internal usage policy); a license gate (excluding data whose licensing status is not permitted); a contamination gate (reducing overlap between validation and training data); exact deduplication (removing exactly duplicate documents); near-deduplication (removing or down-weighting near-duplicate content); quality filtering (removing low-information-density, garbled, or template-polluted content); boilerplate filtering (removing navigation bars, headers and footers, and repeated disclaimers); token accounting (using the actual tokenizer to compute the token budget); and train/validation split separation.

### Metadata conditioning markers

The model is trained with metadata conditioning markers, letting it observe, during training, abstract markers related to language, register, domain, or data attributes. The format can be abstracted as:

```
<conditioning marker>
<source marker>
document body
</s>
```

The purpose of the conditioning markers is to provide a learnable conditioning signal that helps the model distinguish language, register, and domain, and to offer an optional steering interface at inference time. To avoid an inference-time mismatch, the training recipe includes an unmarked cooldown stage, so the model can still generate stably without a metadata prefix.

## Training: a three-stage pipeline

### Overall schedule

Barbet 1B Base uses a three-stage training pipeline, with a total token budget of about 150 billion tokens:

```
Stage 1: general pretraining (build general language ability)
Stage 2: Traditional-Chinese mid-training (shift the model distribution toward the Traditional-Chinese context)
Stage 3: progressive long-context extension (expand from 8K up to 256K)
```

### Per-stage specifications

| Stage | Goal | Sequence length | Global batch size | Token budget | LR schedule |
|------|------|---------|------------|-----------|----------|
| P1a | General pretraining | 8192 | 480 | 90 B | warmup → 4e-4 constant |
| P1b | Unmarked cooldown | 8192 | 480 | 10 B | 4e-4 constant |
| P2a | Traditional-Chinese mid-training | 8192 | 480 | 27 B | 4e-4 → 8e-5 cosine decay |
| P2b | Mid-training cooldown | 8192 | 480 | 3 B | 8e-5 → 4e-5 cosine decay |
| P3-32K | Context extension | 32768 | 96 | 6 B | 4e-5 constant |
| P3-64K | Context extension | 65536 | 48 | 4 B | 4e-5 constant |
| P3-128K | Context extension | 131072 | 24 | 4 B | 4e-5 constant |
| P3-256K | Final extension | 262144 | 12 | 6 B | 4e-5 → 1e-5 cosine decay |

### Shared hyperparameters

The optimizer is AdamW (β₁ = 0.9, β₂ = 0.95, ε = 1e-8). Weight decay 0.1, gradient clipping 1.0, precision bf16. Training uses Transformer Engine; FP8 and quantization-aware training are not enabled.

### Stage 1: general pretraining

The core goal of Stage 1 is to build a stable language-model foundation. This stage uses large-scale de-identified general corpora, with a small amount of target-language replay to reduce the risk that some token embeddings become too cold before the subsequent mid-training.

Validation in this stage focuses on: whether the training loss decreases smoothly; whether numerical anomalies appear; whether the tokenizer and end-of-document marker pipeline is correct; whether throughput meets expectations; and whether checkpoints can be resumed normally. Stage 1 is not the main Traditional-Chinese-improvement stage, so Traditional-Chinese validation metrics serve only as a trend reference.

P1b is an unmarked cooldown. After cooldown, the model maintains stable generation behavior under natural prompts with no metadata prefix.

### Stage 2: Traditional-Chinese mid-training

Stage 2 shifts the model distribution toward Traditional Chinese and the local context. This stage's data goes through stricter deduplication, quality filtering, and replay mixing. The main goals: lower Traditional-Chinese validation loss; raise localized probability-probe scores; keep general language ability from degrading substantially; and provide a stable checkpoint for the subsequent long-context extension.

P2b is an unmarked cooldown after mid-training. The learning rate continues to decay from the end of mid-training, giving the model a more stable language distribution before entering long-context training.

### Stage 3: progressive long-context extension

Stage 3 progressively extends the sequence length from 8K to 256K:

```
8K → 32K → 64K → 128K → 256K
```

This stage has seven core principles. The RoPE base frequency stays at 10,000,000. The sliding-window layers keep their 8192 window. Global-attention layers retain full causal attention. The proportion of long-document data rises with each stage. Short-context replay is kept to avoid short-text regression. Each stage continues from the previous stage's checkpoint. Promotion gates are decided by long-document perplexity and the magnitude of short-context regression.

Context parallelism increases with sequence length: 4 at the 32K stage, 4 at 64K, 8 at 128K, and 16 at 256K. Long-context training also enables full uniform recomputation to relieve activation-memory pressure.

## Long context: from native 256K to 1M extrapolation

### The native 256K training target

Barbet 1B Base's native training-target context length is 256K tokens. The model is configured as:

```json
{
  "max_position_embeddings": 262144,
  "rope_theta": 10000000,
  "sliding_window_size": 8192
}
```

Long-context ability is supported jointly by several design choices: progressive context training; high-base-frequency rotary position embeddings; one global-attention layer every four layers; local sliding windows; the Mamba sequence mixer; a long-document training-data mixture; and short-context replay for regression control.

### The 1M research extrapolation configuration

The 1M configuration is an inference-time linear RoPE extrapolation, not native training:

```json
{
  "max_position_embeddings": 1048576,
  "rope_scaling": {
    "type": "linear",
    "factor": 4.0,
    "original_context_length": 262144
  }
}
```

256K is the native pretraining context. 1M is a RoPE-extrapolation configuration of the same weights. RoPE introduces no learnable position parameters, so the weight shapes are compatible. But an actual 1M prefill requires an optimized long-context runtime; under a naive implementation, global-attention layers remain quadratic.

This distinction is critical. Even if needle-in-a-haystack tests partially succeed under the 1M extrapolation configuration, one cannot claim the model reliably understands the full 1M context.

## Evaluation

### Evaluation design principles

Barbet 1B Base uses multi-layer validation. The purpose of each validation layer:

| Validation type | Purpose |
|---------|------|
| Training-health metrics | Confirm numerical stability and trainability |
| Language-model loss | Track language-modeling quality |
| Byte-normalized loss | Support cross-tokenizer comparison |
| Probability probing | Measure paired localization and value behavior |
| Long-context retrieval | Measure exact retrieval at different distances |
| Short-context regression | Ensure long-context training does not break short tasks |
| Conversion consistency | Ensure correct Megatron → HF weight conversion |
| Generation smoke test | Confirm the load and generation paths work |

### How to compare across tokenizers correctly

Token perplexity across different tokenizers is not directly comparable. Barbet uses byte-normalized loss (bits per byte, BPB) as the cross-tokenizer-comparable metric. This ensures models with different vocabulary sizes are compared on a fair basis.

### Probability probing

Probability probing uses paired-continuation scoring. For each probe item, the model computes the average log-probability of a positive continuation and a negative continuation; if the positive is higher than the negative, it counts as correct. This evaluation can output paired accuracy, per-category accuracy, the positive–negative gap, and a stagewise regression check.

### Results

| Metric | Barbet 1B snapshot | Note |
|------|-----------------|------|
| Normalized LM loss | 1.066 bits/byte | Byte-normalized |
| Probability probing | 387 / 500 | Paired-continuation probe |
| Needle-in-a-haystack 32K | 32 / 32 | Native context |
| Needle-in-a-haystack 64K | 28 / 32 | Native context |
| Needle-in-a-haystack 128K | 25 / 32 | Native context |
| Needle-in-a-haystack 256K | 20–23 / 32 | Native context, cross-run variance |
| Needle-in-a-haystack 512K | 24 / 32 | Extrapolation evaluation |
| Needle-in-a-haystack 1M | 20–21 / 32 | Extrapolation evaluation |

<figure class="post-figure">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="niah-en" xmlns="http://www.w3.org/2000/svg">
<title id="niah-en">Needle-in-a-haystack retrieval hits</title>
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">Needle-in-a-haystack retrieval hits (out of 32)</text>
<text x="280" y="38" fill="var(--green)" font-size="12" font-weight="700" text-anchor="middle">Native context</text>
<text x="595" y="38" fill="var(--blue)" font-size="12" font-weight="700" text-anchor="middle">RoPE extrapolation</text>
<g stroke="var(--line)" stroke-width="1"><line x1="60" y1="40" x2="700" y2="40"/><line x1="60" y1="92.5" x2="700" y2="92.5"/><line x1="60" y1="145" x2="700" y2="145"/><line x1="60" y1="197.5" x2="700" y2="197.5"/><line x1="60" y1="250" x2="700" y2="250"/></g>
<g fill="var(--muted)" font-size="11" text-anchor="end"><text x="50" y="44">32</text><text x="50" y="96.5">24</text><text x="50" y="149">16</text><text x="50" y="201.5">8</text><text x="50" y="254">0</text></g>
<line x1="490" y1="40" x2="490" y2="250" stroke="var(--line-strong)" stroke-width="1" stroke-dasharray="4 4" opacity="0.45"/>
<rect x="93.5" y="40" width="58" height="210" rx="2" fill="var(--green)"/>
<rect x="198.5" y="66.25" width="58" height="183.75" rx="2" fill="var(--green)"/>
<rect x="303.5" y="85.94" width="58" height="164.06" rx="2" fill="var(--green)"/>
<rect x="408.5" y="118.75" width="58" height="131.25" rx="2" fill="var(--green)"/>
<rect x="408.5" y="99.06" width="58" height="19.69" rx="2" fill="var(--green)" opacity="0.4"/>
<rect x="513.5" y="92.5" width="58" height="157.5" rx="2" fill="var(--blue)"/>
<rect x="618.5" y="118.75" width="58" height="131.25" rx="2" fill="var(--blue)"/>
<rect x="618.5" y="112.19" width="58" height="6.56" rx="2" fill="var(--blue)" opacity="0.4"/>
<g font-size="12.5" font-weight="700" text-anchor="middle" fill="var(--paper-ink)"><text x="122.5" y="32">32</text><text x="227.5" y="58">28</text><text x="332.5" y="78">25</text><text x="437.5" y="91">20–23</text><text x="542.5" y="84">24</text><text x="647.5" y="104">20–21</text></g>
<g fill="var(--muted)" font-size="12" text-anchor="middle"><text x="122.5" y="268">32K</text><text x="227.5" y="268">64K</text><text x="332.5" y="268">128K</text><text x="437.5" y="268">256K</text><text x="542.5" y="268">512K</text><text x="647.5" y="268">1M</text></g>
</svg>
<figcaption><b>Figure 1.</b> Needle-in-a-haystack retrieval hits at different context lengths, 32 probes per length. 32K–256K are native-context evaluations; 512K and 1M are RoPE-extrapolation evaluations. The lighter extension marks the cross-run variance range. Successful retrieval does not imply full comprehension of the entire context.</figcaption>
</figure>

The results show several key points. The model is stable in HuggingFace loading and conversion correctness. Its greedy-decoding behavior is very close to the Megatron checkpoint. It has long-context retrieval ability at the 256K native context. It retains partial retrieval ability under the 512K and 1M extrapolation configurations. On byte-normalized loss, it can serve as a follow-up research checkpoint for a Traditional-Chinese / multilingual base model.

### A caveat on long-context evaluation

Needle-in-a-haystack-style tests mainly measure exact retrieval. They cannot prove that the model fully understands 1M tokens, has robust multi-hop reasoning, can stably handle all long-text tasks, nor can they equate 1M extrapolation with native 1M training. This article therefore strictly distinguishes "native-context evaluation" from "extrapolation-context evaluation" in all results.

### TAIDE-14 cross-model comparison

To compare fairly across models of the same scale, we evaluate Barbet 1B Base against three billion-parameter public models — `openbmb/MiniCPM5-1B-Base`, `meta-llama/Llama-3.2-1B`, and `LiquidAI/LFM2.5-1.2B-Instruct` — on the TAIDE-14 task set (`taide/TAIDE-14-tasks`; 14 tasks, 140 samples total) using byte-normalized loss (bits per byte, BPB). No samples were truncated for any model. BPB is the negative log-likelihood of the target tokens divided by the UTF-8 byte count of the evaluation text; it removes the effect of differing tokenizer vocabulary sizes and tokenization granularity on perplexity, making cross-model comparison meaningful.

<figure class="post-figure">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="bpb-en" xmlns="http://www.w3.org/2000/svg">
<title id="bpb-en">TAIDE-14 bits-per-byte cross-model comparison</title>
<text x="0" y="22" fill="var(--paper-ink)" font-size="15" font-weight="700">TAIDE-14 · response_only · bits/byte (lower is better)</text>
<g stroke="var(--line)" stroke-width="1"><line x1="230" y1="56" x2="230" y2="255"/><line x1="330" y1="56" x2="330" y2="255"/><line x1="430" y1="56" x2="430" y2="255"/><line x1="530" y1="56" x2="530" y2="255"/><line x1="630" y1="56" x2="630" y2="255"/></g>
<g fill="var(--muted)" font-size="11" text-anchor="middle"><text x="230" y="272">0</text><text x="330" y="272">0.5</text><text x="430" y="272">1.0</text><text x="530" y="272">1.5</text><text x="630" y="272">2.0</text></g>
<rect x="230" y="70" width="149.8" height="30" rx="2" fill="var(--green)"/>
<rect x="230" y="120" width="151.5" height="30" rx="2" fill="var(--blue)"/>
<rect x="230" y="170" width="183.8" height="30" rx="2" fill="var(--muted)"/>
<rect x="230" y="220" width="401.6" height="30" rx="2" fill="var(--muted)" opacity="0.5"/>
<g fill="var(--paper-ink)" font-size="12.5" text-anchor="end"><text x="218" y="89">voidful/barbet-1b-base</text><text x="218" y="139">openbmb/MiniCPM5-1B-Base</text><text x="218" y="189">meta-llama/Llama-3.2-1B</text><text x="218" y="239">LiquidAI/LFM2.5-1.2B-Instruct</text></g>
<g font-size="12.5" font-weight="700" fill="var(--paper-ink)"><text x="385.8" y="89" fill="var(--green)">0.7488</text><text x="387.5" y="139">0.7577</text><text x="419.8" y="189">0.9190</text><text x="637.6" y="239">2.0082</text></g>
</svg>
<figcaption><b>Figure 2.</b> Bits per byte on TAIDE-14 (140 samples) under the response_only protocol; lower is better. Barbet 1B Base leads comparable billion-parameter public models at <b>0.7488 bits/byte</b>. BPB measures a base model's modeling probability over the target text, not instruction following or conversational quality.</figcaption>
</figure>

Under the response_only protocol (scoring the loss of the positive response text only, excluding the prompt prefix), the overall ranking is:

| Rank | Model | bits/byte | tokens/byte | Samples |
|:----:|------|----------:|------------:|--------:|
| 1 | `voidful/barbet-1b-base` | 0.7488 | 0.2164 | 140 |
| 2 | `openbmb/MiniCPM5-1B-Base` | 0.7577 | 0.2804 | 140 |
| 3 | `meta-llama/Llama-3.2-1B` | 0.9190 | 0.2960 | 140 |
| 4 | `LiquidAI/LFM2.5-1.2B-Instruct` | 2.0082 | 0.3408 | 140 |

Barbet leads MiniCPM5 (0.7577) at 0.7488 bits/byte, a margin of 0.0089; the gap to Llama-3.2-1B is 0.1702. Note the tokens/byte column: PangolinTokenizer splits each byte into 0.2164 tokens — the lowest of the four models — meaning higher compression efficiency for Traditional Chinese, with each token carrying more information on average.

Per task, Barbet ranks first on 10 of the 14 tasks:

| Task | Barbet rank | Barbet bits/byte | Best model | Best bits/byte |
|------|:----------:|----------------:|---------|--------------:|
| Classification | 1 | 0.7302 | Barbet | 0.7302 |
| Question answering | 1 | 0.7042 | Barbet | 0.7042 |
| Writing | 2 | 0.6975 | MiniCPM5 | 0.6968 |
| Letter writing | 2 | 0.7223 | MiniCPM5 | 0.7120 |
| Dialogue generation | 1 | 0.6994 | Barbet | 0.6994 |
| Commonsense reasoning | 1 | 0.7385 | Barbet | 0.7385 |
| Sentiment analysis | 1 | 0.8376 | Barbet | 0.8376 |
| Extraction | 1 | 0.8061 | Barbet | 0.8061 |
| Recommendation | 2 | 0.7842 | MiniCPM5 | 0.7677 |
| Advice giving | 2 | 0.7110 | MiniCPM5 | 0.6930 |
| Summarization | 1 | 0.8295 | Barbet | 0.8295 |
| Text analysis | 1 | 0.7238 | Barbet | 0.7238 |
| Translation | 1 | 0.8402 | Barbet | 0.8402 |
| Open-ended generation | 1 | 0.7825 | Barbet | 0.7825 |

The four tasks where Barbet ranks second (writing, letter writing, recommendation, advice giving) are all won by MiniCPM5, but most gaps are within 0.02 bits/byte. To be clear, what is compared here is base-model language-modeling efficiency, not post-alignment assistant performance.

## Design trade-offs and reflections

The design of Barbet 1B Base reflects several practical trade-offs for billion-parameter models in Traditional-Chinese, multilingual, and long-context scenarios.

First, reallocating vocabulary parameters. Traditional-Chinese and multilingual tokenizers usually have large vocabularies. Tying the embedding layer to the output head and investing the saved parameters into a deeper model body is a direct way to raise model capacity under a fixed parameter budget.

Second, cost control through hybrid attention. Pure global attention is too costly at 256K sequence length. By interleaving global, sliding-window, and Mamba layers, the model retains a periodic global information channel while confining most layers' compute pressure to a local window. During step-by-step decoding, Mamba layers have state behavior distinct from an attention KV cache, providing additional sequence-mixing diversity.

Third, the pragmatic choice of progressive long-context extension. Direct native 1M training carries too much cost and stability risk. Progressive extension gives each stage a clear promotion gate. The 1M configuration is clearly positioned as an extrapolation add-on, not a native-training claim. This distinction is essential to avoid over-claiming.

Fourth, engineering transparency. The technical report fully discloses the pipeline, data governance, tokenizer contract, training recipe, evaluation protocol, and model card. This lets later researchers reproduce the process, verify conversion correctness, and build downstream fine-tuning on top of it.

## Safety, ethics, and limitations

Barbet 1B Base is a base model that has not been instruction-tuned or safety-aligned. The model may exhibit: hallucination; harmful continuations; prompt drift; repetition; unsafe generation; memorization-like behavior; biased or culturally insensitive continuations; and an inability to refuse harmful instructions.

Therefore, any user-facing application requires additional instruction tuning, safety tuning, red-teaming, and policy enforcement. Direct deployment as a conversational assistant is not recommended, nor is use in medical, legal, financial, or other domains requiring professional guarantees.

The 1M extrapolation configuration must also not be mislabeled as native 1M pretraining. Even if needle-in-a-haystack partially succeeds under the 1M configuration, it does not mean the model can reliably understand the full 1M context.

## Conclusion

Barbet 1B Base is a billion-parameter hybrid causal language model produced by the Open Formosa training stack. The model supports context up to 1M tokens (256K native training length, RoPE-extrapolated to 1M), uses an interleaved design of global attention, sliding-window attention, and a Mamba sequence mixer, and shifts the parameter cost of a large vocabulary into a deeper model body through embedding tying. The training pipeline spans general pretraining, Traditional-Chinese mid-training, and progressive long-context extension, with a fixed tokenizer contract, strict data governance, stable training gates, multi-layer evaluation, and Megatron-to-HuggingFace conversion verification.

The model should be regarded as a research base model. It is not a conversational assistant, and it should not be claimed to be a native 1M pretrained model. Future work includes: instruction tuning; safety alignment; quantization-aware-training experiments; byte-normalized evaluation on more held-out sets; long-context reasoning tests; and stricter conversion-consistency and inference-runtime verification.

```bibtex
@techreport{barbet1bbase2026,
  title     = {Barbet 1B Base: A Hybrid Decoder-Only Causal Language Model
               for Traditional Chinese, Multilingual Pretraining,
               and Long-Context Modeling},
  author    = {Open Formosa / Barbet Contributors},
  year      = {2026},
  institution = {Open Formosa},
  note      = {Training data sources are not disclosed.}
}
```

</div>
