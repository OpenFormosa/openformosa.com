---
layout: post
title: "PangolinTokenizer: a byte-level BPE tokenizer for Traditional Chinese and Taiwan"
zh_title: "PangolinTokenizer：面向繁體中文與台灣語境的 Byte-level BPE Tokenizer"
i18n_key: pangolin
description: "A byte-level BPE tokenizer built for Taiwan — 114,688 merges, the lowest tokens/character on PangolinBench with the smallest vocabulary."
zh_description: "面向繁體中文與台灣語境的 byte-level BPE tokenizer——以最小的詞彙表，在台灣語境達到最低 tokens/character。"
date: 2026-06-20
category: research
tags: [tokenizer, benchmark, pangolin]
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

**摘要**　PangolinTokenizer 是一個面向台灣語境設計的 byte-level BPE tokenizer。它的詞彙表規模為 114,688 個 BPE 合併項，約為主流多語言 tokenizer 的三分之一到一半。然而，在 PangolinBench（一組面向台灣語境的 tokenizer 評測集）上，我們比較了 9 個 tokenizer，PangolinTokenizer 在核心台灣華語文本、台灣專名，以及語音逐字稿格式上，均以最小的詞彙表達到最低的整體 tokens/character（0.485）。換言之，同樣的上下文視窗可以容納更多台灣語境的文字。

PangolinTokenizer 的設計重點是：在有限詞彙表規模下，針對台灣語境、台灣制度詞、台灣專名、多書寫系統混用，以及語音逐字稿格式，提供一個可重現、可評估、且適合後續模型訓練的 tokenizer。

PangolinTokenizer 的核心貢獻不是「能處理繁體中文」。任何 byte-level tokenizer 都能表示任意 UTF-8 文字。真正的問題是：tokenizer 能否在台灣語境中更省 token、更穩定，而且能被系統性地評估。

</div>

## 1. 引言

大型語言模型的 tokenizer 通常被視為前處理工具。然而，tokenizer 決定了模型能以多少 token 表示同一段文字。當模型的上下文視窗、訓練 token 預算與推論成本都以 token 為單位計算時，tokenizer 會直接影響模型訓練與部署的效率。

對英文而言，空白大致提供詞邊界。中文的書寫系統不以空白標記詞邊界。因此，中文 tokenizer 的合併規則是否能捕捉常見詞彙，會直接影響 token 數。對台灣語境而言，問題又更複雜。台灣文本常同時包含繁體中文、英文、數字、注音符號、台語羅馬字、客語拼音、URL、JSON、emoji，以及語音逐字稿結構。通用多語言 tokenizer 雖然通常可以無損表示這些文字，但不一定能以低 token 成本表示它們。

PangolinTokenizer 的設計目標是建立一個面向台灣語境的 byte-level BPE tokenizer。它不追求在所有語言上平均最佳，而是在台灣華語、台灣專名、台灣制度詞、多書寫系統混用，以及語音逐字稿格式上提供更好的詞彙表配置。

本文的主要貢獻如下。

1. 本文提出 PangolinTokenizer，一個面向台灣語境訓練的 byte-level BPE tokenizer。
2. PangolinTokenizer 的詞彙表規模約為主流多語言 tokenizer 的一半，但在台灣語境的 token 使用效率上達到相當甚至更優的表現。
3. PangolinTokenizer 原生支援語音逐字稿結構標記，且不浪費詞彙表空間在大量時間戳 token 上。
4. 本文提出 PangolinBench，一組聚焦台灣語境的 tokenizer 評測集。PangolinBench 涵蓋 10 個測試子集，搭配明確的通過門檻，用於檢驗 tokenizer 的正確性、壓縮率與格式穩定性。
5. PangolinBench 結果顯示，PangolinTokenizer 以最小詞彙表達到最低整體 tokens/character，並通過所有通過門檻。

## 2. 為什麼台灣需要自己的 tokenizer

### 2.1 中文沒有空白分詞

中文書寫系統不以空白作為穩定的詞邊界。若 tokenizer 對繁體中文的合併規則不足，常見詞彙會被切成過短的片段。這會增加 token 數，降低上下文視窗中可容納的有效文字量，也會提高訓練與推論成本。

例如，「戶政事務所」、「勞保年金」、「晶圓代工」這類詞彙若被切成過多 token，模型就需要用更多 token 表示同一個概念。這種切碎不只影響壓縮率，也會影響模型學習語意單位的方式。

### 2.2 台灣有大量在地制度詞與專名

台灣文本中有許多高度在地化的制度詞、地名、機關名稱與產業詞。例如：健保、勞保年金、戶政事務所、里長、捷運、科學園區、晶圓代工、半導體、台北、臺南。

這些詞彙在台灣語境中非常高頻。若 tokenizer 沒有在合併規則中學到這些片段，模型就會以更高 token 成本表示相同內容。這會造成台灣文本在訓練與推論時承擔較高成本。

### 2.3 台灣文本常見多書寫系統混用

台灣語境不是單一書寫系統的問題。實際文本常同時包含繁體中文、英文、數字、注音符號、台語漢字、台語羅馬字（例如 Tâi-gí、tshit-á）、客語拼音（例如 Hak-kâ）、emoji、URL、email、JSON、程式碼、API 文件，以及語音逐字稿格式。

台語羅馬字與客語拼音不是單純英文。它們常包含帶變音符號的拉丁字母、連字號分隔的音節結構，以及不同腔調或拼寫系統。若 tokenizer 只把這些內容視為一般英文，就容易產生不穩定的切分。

### 2.4 語音模型需要結構化逐字稿

語音辨識（ASR）與語音模型訓練不只需要文字。逐字稿通常也包含說話者身分、起始時間、結束時間、非語音事件、JSON 欄位、段落邊界與內容欄位。

有些 tokenizer 使用密集時間戳 token 區間（例如從 `<|ts_000000|>` 到 `<|ts_999999|>` 的連續 token）。這種設計會浪費大量詞彙表空間，同時把 tokenizer 綁定在固定時間解析度與固定音訊長度上。PangolinTokenizer 選擇用一般文字數字表示時間戳（例如 `0.00`、`3.42`、`3575.50`），不為時間戳保留專屬 token 區間。這讓 tokenizer 對任意長度的音訊逐字稿都保持相同設計。

## 3. 設計原則

PangolinTokenizer 依循四個設計原則。

### 3.1 Byte-level BPE 確保 UTF-8 無損往返

PangolinTokenizer 使用 256 個 byte values 作為基礎表示，再透過 BPE 合併規則學習高頻片段。這個設計使 tokenizer 不需要事先列舉所有 Unicode 字元，也能避免字元級 tokenizer 遇到未知字元時產生 `<unk>` 的問題。

「無損往返」的意思是：對任意 UTF-8 文字，先編碼（encode）再解碼（decode），結果必須與原文完全一致，不會遺失任何字元。在 PangolinBench 的 30 個測試樣例中，PangolinTokenizer 涵蓋繁體中文、注音符號、台語羅馬字、客語拼音、emoji、JSON、URL，以及語音逐字稿。所有樣例的 encode/decode 結果皆完全一致，無損往返正確率為 100%。

### 3.2 以台灣語境訓練合併規則

Tokenizer 的詞彙表會反映訓練語料的分佈。若 tokenizer 主要從通用多語言語料學習，它可能會犧牲低資源語境或特定在地語境的 token 使用效率。Rust et al. (2021) 指出，在公平控制的比較下，專門訓練的單語言 tokenizer 可以改善多數語言與任務的下游表現。

PangolinTokenizer 的目標不是成為「所有語言平均最佳」的 tokenizer。它的目標是在台灣語境下提供更好的 token 效率。訓練語料依照語言、書寫系統、領域與格式進行分層，涵蓋下列類型。

| 類別 | 涵蓋內容 | 設計目的 |
|:---|:---|:---|
| 繁體中文正式文本 | 政策、教育、醫療、金融、新聞、科技文本 | 學習正式台灣華語與制度詞 |
| 台灣華語口語 | 訪談、客服、社群、會議逐字稿 | 學習口語標記詞，例如「欸」、「啦」、「齁」、「蠻」、「超」 |
| 台灣專名詞 | 地名、機關、交通、產業詞 | 降低在地詞彙切碎程度 |
| 台語與台羅 | 台語漢字、漢羅混寫、Tâi-gí | 保留台語書寫與拼音形態 |
| 客語拼音 | 四縣、海陸、大埔、饒平、詔安等腔調 | 涵蓋多腔別拼音與符號 |
| 注音符號 | ㄅㄆㄇ、ㄓㄨˋㄧㄣ | 支援教育、輸入法與口語標註語境 |
| 中英混語 | API、GPU、latency、JSON schema | 支援台灣科技文本 |
| ASR 語音逐字稿 | speaker、timestamp、content、非語音事件 | 支援語音模型訓練格式 |

### 3.3 保留語音逐字稿結構標記

PangolinTokenizer 內建 10 個語音逐字稿結構標記。每個結構標記都會被編碼成單一 ID，而不是被拆成多個 token。

| Token | ID | 用途 |
|:---|---:|:---|
| <code>&lt;&#124;transcript_start&#124;&gt;</code> | 114670 | 逐字稿起始 |
| <code>&lt;&#124;transcript_end&#124;&gt;</code> | 114671 | 逐字稿結束 |
| <code>&lt;&#124;segment_start&#124;&gt;</code> | 114672 | 段落起始 |
| <code>&lt;&#124;segment_end&#124;&gt;</code> | 114673 | 段落結束 |
| <code>&lt;&#124;speaker&#124;&gt;</code> | 114674 | 說話者標記 |
| <code>&lt;&#124;start_time&#124;&gt;</code> | 114675 | 起始時間 |
| <code>&lt;&#124;end_time&#124;&gt;</code> | 114676 | 結束時間 |
| <code>&lt;&#124;duration&#124;&gt;</code> | 114677 | 持續時間 |
| <code>&lt;&#124;content&#124;&gt;</code> | 114678 | 內容標記 |
| <code>&lt;&#124;non_speech_event&#124;&gt;</code> | 114679 | 非語音事件 |

此外，PangolinTokenizer 也支援 OCR、視覺、檢索與音訊相關結構標記（例如 `<|ocr_start|>`、`<|image_start|>`、`<|audio_start|>` 等）。

這些特殊標記只服務於通用控制格式與結構化輸入輸出。PangolinTokenizer 明確排除兩類 token：密集時間戳 token 區間（如 `<|ts_0|>` 到 `<|ts_N|>`），以及離散音訊編碼 token 區間。

### 3.4 以基準測試評估，用數字說話

多數 tokenizer 介紹只靠主觀例句說明效果。PangolinTokenizer 改用 PangolinBench 進行系統性評估。PangolinBench 是面向台灣語境設計的 tokenizer 基準測試。它不評估一般自然語言處理任務，而是專注於 tokenizer 本身的幾個關鍵性質。

第一，正確性：任意文字經過 encode 再 decode 後，是否與原文完全一致。第二，壓縮率：相同文字需要多少 token 表示。第三，台灣詞彙的切碎程度：台灣常見詞彙是否被切成過多 token。第四，書寫系統涵蓋度：對繁體中文、注音、拉丁字母、emoji 等不同書寫系統的處理能力。第五，語音逐字稿穩定性：JSON 格式的逐字稿經過 encode/decode 後，是否仍能正確解析。

這些指標讓 tokenizer 的優勢與限制都能被具體量化。

## 4. 訓練方法

PangolinTokenizer 使用 [UbiTok](https://github.com/OpenFormosa/ubi_tokenizer) 訓練。UbiTok 是一套自研的串流式 byte-level BPE 訓練套件。整體流程從 256 個 byte values 開始，再根據語料中的配對頻率學習合併規則。

### 4.1 串流式架構

UbiTok 不需要將完整語料載入記憶體。大型檔案會被切分為對齊行邊界的區塊。多個 worker 會平行計算片段頻率。主程序再合併統計結果，並執行合併規則學習。

這個設計讓 tokenizer 訓練可以擴展到大型語料，同時維持可控的記憶體使用量。

### 4.2 確定性訓練

整個訓練流程是確定性的。相同語料、相同參數與相同設定會產生完全一致的 tokenizer。

UbiTok 透過下列設計確保確定性：

- 分片分配使用 blake2b 雜湊
- 合併排序使用固定的同分處理規則
- 同分處理規則為 `-frequency, len(merged_bytes), merged_bytes, pair_first_seen_order`
- 片段數量上限策略在相同輸入下固定輸出

這個性質對模型訓練很重要。它讓 tokenizer 可以被重現、被稽核，也能支援長期版本管理。

訓練完成後，UbiTok 會產出 Hugging Face 相容的 tokenizer 檔案。使用者可以透過 `AutoTokenizer.from_pretrained` 直接載入，不需要 `trust_remote_code=True`。

## 5. 評估方法：PangolinBench

PangolinBench 是專為台灣語境設計的 tokenizer 基準測試。它涵蓋 10 個測試子集。每個子集對應台灣文本中的不同面向。

### 5.1 測試子集

| 子集 | 說明 |
|:---|:---|
| `traditional_zh_formal` | 正式繁體中文，例如政策、教育、醫療、金融與科技文本 |
| `taiwan_mandarin_colloquial` | 台灣華語口語，例如語助詞與口語標記 |
| `taiwan_named_entities` | 台灣專名，例如地名、機關、交通與產業詞 |
| `taigi_han_roman_mixed` | 台語漢字與台羅混寫壓力測試 |
| `hakka_romanized` | 客語拼音與漢字混合 |
| `bopomofo` | 注音符號與繁體中文混合 |
| `taiwan_code_switching` | 中英混語科技文本 |
| `rich_transcription_json` | 語音辨識 JSON 逐字稿，含時間戳、說話者與內容 |
| `rich_transcription_structured_text` | 結構化逐字稿格式 |
| `unicode_edge_cases` | UTF-8 邊界情況，例如標點、URL、email、emoji 與變音符號 |

### 5.2 評估指標

| 指標 | 說明 |
|:---|:---|
| 無損往返正確性 | 任意文字經過編碼再解碼後，必須與原文完全一致，不得遺失或改變任何字元 |
| Token 壓縮率 | 相同文字需要多少 token 來表示，以 tokens/character、tokens/UTF-8 byte、characters/token 三種方式衡量 |
| 中文字元切碎度 | 每個中文字平均需要多少 token 來表示，數值越高代表切碎越嚴重 |
| 台灣詞彙指標 | 針對台灣常見詞彙統計 token 數量、加權 token 成本，以及過度切碎率（被切成超過 3 個 token 的詞彙比例） |
| 書寫系統涵蓋度 | 分別統計繁體漢字、注音符號、拉丁字母、帶變音符號的拉丁字母、數字、標點與 emoji 的處理情況 |
| 語音逐字稿指標 | 逐字稿 JSON 經 encode/decode 後是否仍可解析、時間戳精度是否保留、結構標記是否完整、非語音標籤是否保留 |

## 6. PangolinBench 實測結果

本節比較 PangolinTokenizer 與 8 個基準 tokenizer，共 9 組 tokenizer 參與比較。

### 6.1 基準 tokenizer

| Tokenizer | 代表模型 | 詞彙表大小 |
|:---|:---|---:|
| PangolinTokenizer | PangolinTokenizer | 114,822 |
| LLaMA 3.1 | Llama-3.1-8B | 128,256 |
| Qwen 3 | Qwen3-8B | 151,669 |
| Qwen 2.5 | Qwen2.5-7B | 151,665 |
| GPT-4o | gpt-4o, o200k_base | 200,019 |
| Qwen 3.6 | Qwen3.6-27B | 248,070 |
| Gemma 3 | gemma-3-4b-it | 262,145 |
| Gemma 4 | gemma-4-12b-it | 262,144 |
| TAIDE | TAIDE-12b-Chat | 318,080 |

PangolinTokenizer 的詞彙表是所有受測 tokenizer 中最小的。它約為 LLaMA 3.1 的 90%、Qwen 3 的 76%、GPT-4o 的 57%、Qwen 3.6 的 46%、Gemma 4 的 44%、TAIDE 的 36%。

Gemma 3 與 Gemma 4 在所有子集上的結果完全一致，因此表格中合併呈現。Qwen 2.5 與 Qwen 3 也呈現相同情形。Qwen 3.6 則使用不同且更大的 tokenizer。

### 6.2 Token 壓縮率結果

下表呈現各 tokenizer 在 PangolinBench 中的 token 壓縮率。除特別標註外，數值為 tokens/character。數值越低代表 tokenizer 越省 token。

| 測試子集 | Pangolin | TAIDE | Gemma 3/4 | Qwen 3.6 | LLaMA 3.1 | GPT-4o | Qwen 2.5/3 |
|:---|---:|---:|---:|---:|---:|---:|---:|
| 詞彙表大小 | 114,822 | 318,080 | 262,144 | 248,070 | 128,256 | 200,019 | 151,669 |
| 正式繁中 | 0.676 | **0.559** | 0.716 | 0.676 | 0.902 | 0.902 | 0.735 |
| 台灣華語口語 | 0.708 | **0.688** | 0.750 | 0.750 | 0.917 | 0.979 | 0.792 |
| 台灣專名 | 0.730 | **0.622** | 0.892 | 0.757 | 1.000 | 1.009 | 0.919 |
| 台語漢羅混寫 | 0.714 | **0.538** | 0.582 | 0.615 | 0.637 | 0.615 | 0.692 |
| 客語拼音（tokens/byte） | 0.372 | **0.293** | 0.314 | 0.340 | 0.335 | 0.319 | 0.346 |
| 注音 | 1.068 | **0.750** | 0.795 | 1.386 | 1.205 | 1.227 | 1.114 |
| 中英混語 | 0.478 | **0.380** | **0.380** | 0.413 | 0.424 | 0.457 | 0.457 |
| 語音逐字稿 JSON | **0.400** | 0.423 | 0.428 | 0.441 | 0.405 | 0.405 | 0.447 |
| 整體 tokens/character | **0.485** | 0.486 | 0.526 | 0.541 | 0.554 | 0.558 | 0.559 |

PangolinTokenizer 的整體 tokens/character 為 0.485，是所有受測 tokenizer 中最低的。TAIDE 的整體 tokens/character 為 0.486，兩者非常接近。然而，TAIDE 的詞彙表為 318,080，約為 PangolinTokenizer 的 2.77 倍。

這表示 PangolinTokenizer 在詞彙表使用效率上具有明顯優勢。它以較小詞彙表達到接近甚至略優於大型 tokenizer 的整體壓縮效果。

### 6.3 核心台灣華語文本

在正式繁體中文、台灣華語口語與台灣專名上，PangolinTokenizer 不是所有子集的絕對最佳。TAIDE 在這三個子集上仍然有最低 tokens/character。然而，PangolinTokenizer 的詞彙表只有 TAIDE 的 36%。在這個前提下，PangolinTokenizer 仍達到非常接近大型 tokenizer 的表現，並明顯優於多個主流多語言 tokenizer。

與基準 tokenizer 相比，PangolinTokenizer 的 token 節省率如下。負值代表 PangolinTokenizer 更省 token。

| 基準 | 正式繁中 | 口語 | 專名 | 整體 |
|:---|---:|---:|---:|---:|
| GPT-4o | −25.0% | −27.7% | −27.7% | −13.1% |
| LLaMA 3.1 | −25.0% | −22.7% | −27.0% | −12.4% |
| Qwen 2.5/3 | −8.0% | −10.5% | −20.6% | −13.2% |
| Qwen 3.6 | 0.0% | −5.6% | −3.6% | −10.3% |
| Gemma 3/4 | −5.5% | −5.6% | −18.2% | −7.7% |
| TAIDE | +21.1% | +3.0% | +17.4% | −0.1% |

這個結果顯示一個重要取捨。TAIDE 用更大的詞彙表換取更強的中文與台灣詞彙壓縮能力。PangolinTokenizer 則以更小詞彙表維持接近的整體表現，並在語音逐字稿 JSON 與詞彙表效率上取得優勢。

### 6.4 語音逐字稿 JSON

PangolinTokenizer 在語音逐字稿 JSON 子集上的 tokens/character 為 0.400，是所有受測 tokenizer 中最低的。這個結果符合設計目標。PangolinTokenizer 原生包含語音逐字稿結構標記，因此能更有效率地表示語音辨識訓練格式。

### 6.5 台語、客語、注音與中英混語的取捨

PangolinTokenizer 在台語漢羅混寫、客語拼音、注音符號與中英混語子集上的表現仍有提升空間。

在這些子集上，TAIDE 與 Gemma 3/4 通常具有較好的壓縮率。這反映了詞彙表規模與語料分佈的影響。115K 的詞彙表不可能同時為繁體中文、台語、客語、注音、英文技術詞、JSON、URL 與多模態結構標記配置足夠的合併規則。

然而，PangolinTokenizer 仍有幾個值得注意的結果。在注音子集上，PangolinTokenizer 的 1.068 優於 GPT-4o、LLaMA 3.1、Qwen 3.6 與 Qwen 2.5/3。在台語漢羅混寫子集上，PangolinTokenizer 的 0.714 與 Qwen 2.5/3 的 0.692 接近。所有子集的無損往返正確率皆為 100%。即使 token 數較多，PangolinTokenizer 也不會遺失任何字元。

## 7. 台灣詞彙指標

PangolinBench 建立了一組台灣專用詞彙表，並對每個詞計算 token 數量與過度切碎率。

### 7.1 單詞 token 數量

| 台灣詞彙 | 類別 | PangolinTokenizer |
|:---|:---|---:|
| 健保 | 健康政策 | 1 token |
| 捷運 | 交通 | 1 token |
| 台北 | 地名 | 1 token |
| 臺南 | 地名 | 1 token |
| 半導體 | 產業 | 1 token |
| 科學園區 | 產業 | 2 tokens |
| 里長 | 地方治理 | 2 tokens |
| 勞保 | 勞動政策 | 2 tokens |
| 勞保年金 | 勞動政策 | 3 tokens |
| 戶政事務所 | 機關 | 3 tokens |
| 晶圓代工 | 產業 | 4 tokens |

「健保」、「捷運」、「台北」、「臺南」、「半導體」等高頻台灣詞彙都能以單一 token 編碼。這表示 PangolinTokenizer 的合併規則確實學到了部分高頻台灣語境片段。

較長或較複合的詞彙仍會被切成多個 token。例如「晶圓代工」為 4 tokens。這代表後續版本仍可針對產業詞、制度詞與長複合名詞進行合併規則配置的調整。

### 7.2 加權詞彙 token 成本

| Tokenizer | 詞彙表 | 加權成本 | 過度切碎率（>3 tokens）|
|:---|---:|---:|---:|
| TAIDE | 318,080 | **1.70** | **20%** |
| PangolinTokenizer | 114,822 | 2.48 | 27% |
| Qwen 3.6 | 248,070 | 2.59 | 27% |
| Gemma 3/4 | 262,144 | 2.92 | 33% |
| Qwen 2.5/3 | 151,669 | 3.08 | 47% |
| GPT-4o | 200,019 | 3.45 | 40% |
| LLaMA 3.1 | 128,256 | 3.47 | 53% |

TAIDE 在台灣詞彙壓縮上最佳。這與其 318K 詞彙表規模一致。PangolinTokenizer 的加權成本為 2.48，在排除 TAIDE 後為最佳。與詞彙表規模接近的 LLaMA 3.1 相比，PangolinTokenizer 的台灣詞彙加權成本低約 29%。

這個結果支持 PangolinTokenizer 的核心設計假設：在有限詞彙表下，針對台灣語境訓練合併規則可以降低台灣詞彙的切碎程度。

## 8. 語音逐字稿穩定性

PangolinBench 使用下列 JSON 結構測試語音逐字稿的 encode/decode 穩定性。

```json
[
  {"Start":0.00,"End":3.42,"Speaker":0,"Content":"大家好，歡迎回來。"},
  {"Start":3.50,"End":7.10,"Speaker":1,"Content":"今天我們要討論台灣本土語音模型。"},
  {"Start":10.25,"End":12.00,"Speaker":0,"Content":"注音 ㄅㄆㄇ 與台語 tshit-á 混合測試。"},
  {"Start":12.10,"End":14.00,"Speaker":null,"Content":"[Silence]","Type":"non_speech"},
  {"Start":3575.50,"End":3578.25,"Speaker":2,"Content":"長會議時間戳測試。"}
]
```

所有受測 tokenizer 都通過無損往返、JSON 解析，以及時間戳精度檢查。然而，只有 PangolinTokenizer 原生包含完整語音逐字稿結構標記。

| 品質檢查 | Pangolin | TAIDE | Gemma 3/4 | Qwen 3.6 | LLaMA 3.1 | GPT-4o | Qwen 2.5/3 |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 無損往返 100% | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| JSON 解析正確 | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| 時間戳精度保留 | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| 無密集時間戳 token | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| 語音逐字稿結構標記 | **Pass** | Fail | Fail | Fail | Fail | Fail | Fail |

這個結果的意義不是「其他 tokenizer 無法處理 JSON」。所有 byte-level 或 Unicode 相容的 tokenizer 都可以無損往返 JSON。差異在於 PangolinTokenizer 把語音逐字稿的結構標記設計為原生單一 ID token。因此，它可以直接支援語音模型訓練格式，而不需要事後擴充詞彙表。

## 9. 詞彙表效率分析

PangolinTokenizer 的一個關鍵觀察是：它以最小詞彙表達到最低的整體 tokens/character。

詞彙表效率定義如下：

$$
\text{Vocabulary Efficiency}
= \frac{1 / \text{tokens per character}}{\text{vocabulary size} / 100000}.
$$

| Tokenizer | 詞彙表大小 | 整體 tokens/character | 詞彙表效率 |
|:---|---:|---:|---:|
| PangolinTokenizer | **114,822** | **0.485** | **1.795** |
| TAIDE | 318,080 | 0.486 | 0.647 |
| Gemma 3/4 | 262,144 | 0.526 | 0.725 |
| Qwen 3.6 | 248,070 | 0.541 | 0.745 |
| LLaMA 3.1 | 128,256 | 0.554 | 1.408 |
| GPT-4o | 200,019 | 0.558 | 0.896 |
| Qwen 2.5/3 | 151,669 | 0.559 | 1.179 |

PangolinTokenizer 的詞彙表效率為 1.795，是所有受測 tokenizer 中最高。這表示它每 100K 詞彙表空間換得的 characters/token 最多。

這個結果有幾個實務意義。第一，較小詞彙表會降低嵌入矩陣與輸出投影層的參數量。第二，較低 tokens/character 會讓同樣的上下文視窗容納更多台灣語境文字。第三，當訓練 token 預算固定時，較低 token 成本會讓模型看到更多原始文字內容。第四，在推論時，較短的 token 序列也能降低 KV 快取壓力。

需要注意的是，詞彙表大小本身不會直接降低 KV 快取。KV 快取主要受序列長度影響。PangolinTokenizer 的 KV 快取優勢來自較低 token 數，而不是詞彙表較小本身。

## 10. 使用方式

PangolinTokenizer 可透過 Hugging Face Transformers 直接載入。

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained(
    "OpenFormosa/PangolinTokenizer",
    trust_remote_code=False,
)

text = "<|system|>台灣健保與注音ㄅㄆㄇ，Tailo: Tâi-uân"
ids = tokenizer.encode(text)
decoded = tokenizer.decode(ids)

assert decoded == text
```

模型最大序列長度為 131,072 tokens。

## 11. 已知限制

### 11.1 台語、客語與注音的 token 效率尚有提升空間

在台語漢羅混寫、客語拼音與注音符號子集上，PangolinTokenizer 的表現不如詞彙表規模更大的 TAIDE、Gemma 3/4 與部分基準 tokenizer。這反映 115K 詞彙表的自然限制。若要同時提升台語、客語、注音與英文技術詞的壓縮率，可能需要更大的詞彙表，或更精細的合併規則配置策略。

### 11.2 中英混語與英文技術詞仍可加強

在中英混語子集上，PangolinTokenizer 的 tokens/character 為 0.478，略高於 TAIDE、Gemma 3/4 與 Qwen 3.6。這表示較小詞彙表對英文技術詞、API 名稱與程式碼片段的合併規則覆蓋仍有限。

後續版本可以針對台灣科技文本、開放原始碼、API 文件、硬體規格與人工智慧工程語料提高抽樣權重。

### 11.3 PangolinBench 目前仍是合成測試集

目前 PangolinBench 使用內建的測試集，共 30 個精選測試樣例。這些樣例覆蓋主要語言現象，但仍不足以代表完整台灣文本分佈。

因此，本報告的結果應解讀為 tokenizer 層級的針對性基準測試，而不是完整真實世界分佈評估。更強的結論需要加入大型未見語料，例如政府公開資料、台灣新聞語料、教育與醫療文本、語音辨識逐字稿、客服與會議資料、台語與客語語料，以及科技文件與程式碼資料。

PangolinBench 已支援透過外部設定檔掛載私有未見資料。後續評估應使用更大規模、去重、分層抽樣的未見語料。

### 11.4 Tokenizer 壓縮率不等於語言模型能力

本報告目前評估 tokenizer 層級的壓縮率、正確性與格式穩定性。這些指標很重要，但不能直接推出「使用 PangolinTokenizer 的語言模型一定比較好」。

若要支持模型層級主張，需要控制變因的語言模型消融實驗。例如：固定模型架構、固定訓練資料、固定訓練 token 預算或位元組預算、比較 bits-per-byte、比較 bits-per-character、比較下游台灣語境任務，以及比較語音辨識逐字稿格式的訓練穩定性。

在完成這類實驗前，PangolinTokenizer 的主張應限於 tokenizer 層級。

## 12. 結論

PangolinTokenizer 的核心貢獻不是「能 tokenize 繁體中文」。Byte-level tokenizer 本來就能表示任意 UTF-8。PangolinTokenizer 的重點是：以較小詞彙表，在台灣語境上提供更低 token 成本、更低過度切碎率，以及更穩定的語音逐字稿結構支援。

在 PangolinBench 上，我們將 PangolinTokenizer 與 8 個基準 tokenizer 進行比較，結果如下。

- 詞彙表大小為 114,822，是所有受測 tokenizer 中最小。
- 整體 tokens/character 為 0.485，是所有受測 tokenizer 中最低。
- 在正式繁體中文上，token 數較 GPT-4o 與 LLaMA 3.1 降低 25%，較 Qwen 2.5/3 降低 8%，並與 Qwen 3.6 持平。
- 在台灣專名上，token 數較 GPT-4o 降低約 28%，較 Qwen 2.5/3 降低約 21%，較 Gemma 3/4 降低約 18%。
- 在台灣華語口語上，tokens/character 為 0.708，優於 GPT-4o、LLaMA 3.1、Qwen 2.5/3 與 Gemma 3/4。
- 在語音逐字稿 JSON 上，tokens/character 為 0.400，是所有受測 tokenizer 中最低。
- 台灣詞彙加權成本為 2.48，在排除 318K 詞彙表的 TAIDE 後為最佳。
- 詞彙表效率為 1.795，是所有受測 tokenizer 中最高。
- 無損往返正確率為 100%。
- PangolinTokenizer 通過所有品質檢查門檻。
- PangolinTokenizer 是受測 tokenizer 中唯一原生支援完整語音逐字稿結構標記的 tokenizer。

一個適合台灣語境的 tokenizer 應同時滿足三個條件。第一，它必須能無損往返任意 UTF-8。第二，它必須在台灣華語、台灣專名、制度詞與多書寫系統混用文本上具有較低 token 成本。第三，它必須支援現代語音、多模態與結構化訓練格式。

PangolinTokenizer 透過 byte-level BPE、台灣語境合併規則、通用結構特殊標記，以及 PangolinBench 評估流程，提供了這三個條件的具體實作。

## 13. 開放資源

- **PangolinTokenizer 模型**：[huggingface.co/OpenFormosa/PangolinTokenizer](https://huggingface.co/OpenFormosa/PangolinTokenizer)
- **訓練套件 UbiTok**：[github.com/OpenFormosa/ubi_tokenizer](https://github.com/OpenFormosa/ubi_tokenizer)
- **PangolinBench 評測工具組**：[github.com/OpenFormosa/PangolinBench](https://github.com/OpenFormosa/PangolinBench)

## 參考文獻

- Sennrich, Rico, Barry Haddow, and Alexandra Birch. 2016. *Neural Machine Translation of Rare Words with Subword Units*. Proceedings of ACL.
- Rust, Phillip, Ivan Pfeiffer, Jonas Pfeiffer, Elad Ben-Zaken, Sebastian Ruder, and Iryna Gurevych. 2021. *How Good is Your Tokenizer? On the Monolingual Performance of Multilingual Language Models*. Proceedings of ACL-IJCNLP.
- Hugging Face. *Tokenizers Documentation*. See the byte-level BPE and pre-tokenizer documentation.

</div>

<div class="post-lang-en" markdown="1">

<div class="post-abstract" markdown="1">

**Abstract**　PangolinTokenizer is a byte-level BPE tokenizer designed for the Taiwan context. Its vocabulary holds 114,688 BPE merges — roughly one-third to one-half the size of mainstream multilingual tokenizers. Yet on PangolinBench, a tokenizer evaluation suite built for the Taiwan context, we compared nine tokenizers, and PangolinTokenizer reaches the lowest overall tokens/character (0.485) with the smallest vocabulary across core Taiwan Mandarin text, Taiwan named entities, and speech-transcript formats. In other words, the same context window can hold more Taiwan-context text.

The design goal of PangolinTokenizer is this: under a limited vocabulary budget, provide a reproducible, evaluable tokenizer that is well suited to downstream model training for the Taiwan context, Taiwan institutional terms, Taiwan named entities, mixed writing systems, and speech-transcript formats.

The core contribution of PangolinTokenizer is not "being able to handle Traditional Chinese." Any byte-level tokenizer can represent arbitrary UTF-8 text. The real question is whether a tokenizer can be more token-efficient and more stable in the Taiwan context — and whether it can be evaluated systematically.

</div>

## 1. Introduction

Tokenizers in large language models are often treated as a preprocessing tool. Yet the tokenizer determines how many tokens a model needs to represent the same span of text. When a model's context window, training token budget, and inference cost are all counted in tokens, the tokenizer directly shapes the efficiency of training and deployment.

For English, whitespace roughly supplies word boundaries. Chinese writing does not mark word boundaries with whitespace. Whether a Chinese tokenizer's merge rules capture common words therefore directly affects token counts. For the Taiwan context, the problem is harder still. Taiwan text often mixes Traditional Chinese, English, numerals, Bopomofo, Taigi romanization, Hakka romanization, URLs, JSON, emoji, and speech-transcript structure all at once. General multilingual tokenizers can usually represent such text losslessly, but not necessarily at low token cost.

PangolinTokenizer is designed as a byte-level BPE tokenizer for the Taiwan context. It does not aim to be best on average across all languages; it aims for a better vocabulary allocation on Taiwan Mandarin, Taiwan named entities, Taiwan institutional terms, mixed writing systems, and speech-transcript formats.

The main contributions of this report are as follows.

1. We present PangolinTokenizer, a byte-level BPE tokenizer trained for the Taiwan context.
2. PangolinTokenizer's vocabulary is roughly half the size of mainstream multilingual tokenizers, yet it matches or exceeds them in token efficiency on the Taiwan context.
3. PangolinTokenizer natively supports speech-transcript structural markers, without spending vocabulary space on large blocks of timestamp tokens.
4. We present PangolinBench, a tokenizer evaluation suite focused on the Taiwan context. PangolinBench covers 10 test subsets with explicit pass thresholds, used to check a tokenizer's correctness, compression, and format stability.
5. PangolinBench results show that PangolinTokenizer reaches the lowest overall tokens/character with the smallest vocabulary, and passes every threshold.

## 2. Why Taiwan needs its own tokenizer

### 2.1 Chinese has no whitespace segmentation

Chinese writing does not use whitespace as a stable word boundary. If a tokenizer's merge rules for Traditional Chinese are insufficient, common words are split into overly short fragments. This increases token counts, reduces the amount of usable text a context window can hold, and raises training and inference cost.

For example, if words such as "戶政事務所" (household registration office), "勞保年金" (labor-insurance pension), or "晶圓代工" (wafer foundry) are split into too many tokens, the model needs more tokens to express the same concept. Such fragmentation affects not only compression but also how the model learns semantic units.

### 2.2 Taiwan has many local institutional terms and named entities

Taiwan text contains many highly localized institutional terms, place names, agency names, and industry terms. For example: National Health Insurance, labor-insurance pension, household registration office, village chief, MRT, science park, wafer foundry, semiconductor, Taipei, Tainan.

These terms are very frequent in the Taiwan context. If the tokenizer has not learned these fragments in its merge rules, the model represents the same content at higher token cost. That makes Taiwan text carry a higher cost in both training and inference.

### 2.3 Taiwan text frequently mixes writing systems

The Taiwan context is not a single-writing-system problem. Real text often mixes Traditional Chinese, English, numerals, Bopomofo, Taigi Han characters, Taigi romanization (e.g. Tâi-gí, tshit-á), Hakka romanization (e.g. Hak-kâ), emoji, URLs, email, JSON, code, API documentation, and speech-transcript formats — all at once.

Taigi romanization and Hakka romanization are not simply English. They often contain Latin letters with diacritics, hyphen-separated syllable structures, and different accents or spelling systems. If a tokenizer treats this content as ordinary English, it easily produces unstable segmentation.

### 2.4 Speech models need structured transcripts

Speech recognition (ASR) and speech-model training need more than text. Transcripts usually also contain speaker identity, start time, end time, non-speech events, JSON fields, segment boundaries, and content fields.

Some tokenizers use a dense block of timestamp tokens (for example, a contiguous run from `<|ts_000000|>` to `<|ts_999999|>`). Such a design wastes a large amount of vocabulary space and ties the tokenizer to a fixed time resolution and a fixed audio length. PangolinTokenizer instead represents timestamps as ordinary text numbers (for example `0.00`, `3.42`, `3575.50`), reserving no dedicated token block for timestamps. This keeps the tokenizer's design the same for audio transcripts of any length.

## 3. Design principles

PangolinTokenizer follows four design principles.

### 3.1 Byte-level BPE for lossless UTF-8 round-trips

PangolinTokenizer uses the 256 byte values as its base representation, then learns high-frequency fragments through BPE merge rules. This design means the tokenizer does not need to enumerate every Unicode character in advance, and it avoids the `<unk>` problem that character-level tokenizers face on unknown characters.

A "lossless round-trip" means that for any UTF-8 text, encoding and then decoding must return exactly the original text, with no character lost. Across PangolinBench's 30 test samples — covering Traditional Chinese, Bopomofo, Taigi romanization, Hakka romanization, emoji, JSON, URLs, and speech transcripts — every encode/decode result is identical to its input, for a lossless round-trip rate of 100%.

### 3.2 Train merge rules on the Taiwan context

A tokenizer's vocabulary reflects the distribution of its training corpus. If a tokenizer is learned mainly from general multilingual corpora, it may sacrifice token efficiency on low-resource or specific local contexts. Rust et al. (2021) show that, under fair controlled comparison, a dedicated monolingual tokenizer can improve downstream performance across most languages and tasks.

PangolinTokenizer's goal is not to be the "best on average across all languages." Its goal is better token efficiency on the Taiwan context. The training corpus is stratified by language, writing system, domain, and format, covering the following categories.

| Category | Coverage | Design purpose |
|:---|:---|:---|
| Formal Traditional Chinese | Policy, education, healthcare, finance, news, technology text | Learn formal Taiwan Mandarin and institutional terms |
| Colloquial Taiwan Mandarin | Interviews, customer service, social posts, meeting transcripts | Learn colloquial markers such as "欸", "啦", "齁", "蠻", "超" |
| Taiwan named entities | Place names, agencies, transit, industry terms | Reduce fragmentation of local vocabulary |
| Taigi and Tailo | Taigi Han characters, Han-romanization mix, Tâi-gí | Preserve Taigi script and romanization forms |
| Hakka romanization | Sixian, Hailu, Dapu, Raoping, Zhao'an accents | Cover multi-accent romanization and symbols |
| Bopomofo | ㄅㄆㄇ, ㄓㄨˋㄧㄣ | Support education, IME, and pronunciation-annotation contexts |
| Code-switching | API, GPU, latency, JSON schema | Support Taiwan technology text |
| ASR speech transcripts | speaker, timestamp, content, non-speech events | Support speech-model training formats |

### 3.3 Preserve speech-transcript structural markers

PangolinTokenizer includes 10 built-in speech-transcript structural markers. Each marker is encoded as a single ID rather than split into multiple tokens.

| Token | ID | Purpose |
|:---|---:|:---|
| <code>&lt;&#124;transcript_start&#124;&gt;</code> | 114670 | Transcript start |
| <code>&lt;&#124;transcript_end&#124;&gt;</code> | 114671 | Transcript end |
| <code>&lt;&#124;segment_start&#124;&gt;</code> | 114672 | Segment start |
| <code>&lt;&#124;segment_end&#124;&gt;</code> | 114673 | Segment end |
| <code>&lt;&#124;speaker&#124;&gt;</code> | 114674 | Speaker marker |
| <code>&lt;&#124;start_time&#124;&gt;</code> | 114675 | Start time |
| <code>&lt;&#124;end_time&#124;&gt;</code> | 114676 | End time |
| <code>&lt;&#124;duration&#124;&gt;</code> | 114677 | Duration |
| <code>&lt;&#124;content&#124;&gt;</code> | 114678 | Content marker |
| <code>&lt;&#124;non_speech_event&#124;&gt;</code> | 114679 | Non-speech event |

In addition, PangolinTokenizer supports OCR, vision, retrieval, and audio-related structural markers (for example `<|ocr_start|>`, `<|image_start|>`, `<|audio_start|>`).

These special markers serve only general control formats and structured I/O. PangolinTokenizer explicitly excludes two kinds of tokens: dense timestamp token blocks (such as `<|ts_0|>` through `<|ts_N|>`), and discrete audio-codec token blocks.

### 3.4 Evaluate with a benchmark; let the numbers speak

Most tokenizer write-ups rely on subjective example sentences. PangolinTokenizer instead uses PangolinBench for systematic evaluation. PangolinBench is a tokenizer benchmark designed for the Taiwan context. It does not evaluate general NLP tasks; it focuses on a few key properties of the tokenizer itself.

First, correctness: whether any text is identical to the original after encode and decode. Second, compression: how many tokens are needed to represent the same text. Third, fragmentation of Taiwan vocabulary: whether common Taiwan words are split into too many tokens. Fourth, writing-system coverage: how well it handles Traditional Chinese, Bopomofo, Latin letters, emoji, and other scripts. Fifth, speech-transcript stability: whether a JSON-format transcript still parses correctly after encode/decode.

These metrics let a tokenizer's strengths and limitations be quantified concretely.

## 4. Training method

PangolinTokenizer is trained with [UbiTok](https://github.com/OpenFormosa/ubi_tokenizer). UbiTok is an in-house streaming byte-level BPE training toolkit. The overall pipeline starts from the 256 byte values, then learns merge rules from pair frequencies in the corpus.

### 4.1 Streaming architecture

UbiTok does not need to load the full corpus into memory. Large files are split into chunks aligned to line boundaries. Multiple workers compute fragment frequencies in parallel. The main process then merges the statistics and runs merge-rule learning.

This design lets tokenizer training scale to large corpora while keeping memory usage controllable.

### 4.2 Deterministic training

The entire training pipeline is deterministic. The same corpus, the same parameters, and the same settings produce an identical tokenizer.

UbiTok ensures determinism through the following design:

- shard assignment uses a blake2b hash;
- merge ordering uses a fixed tie-breaking rule;
- the tie-breaking rule is `-frequency, len(merged_bytes), merged_bytes, pair_first_seen_order`;
- the fragment-count cap policy produces fixed output under the same input.

This property matters for model training. It lets the tokenizer be reproduced and audited, and it supports long-term version management.

After training, UbiTok produces Hugging Face–compatible tokenizer files. Users can load them directly with `AutoTokenizer.from_pretrained`, with no need for `trust_remote_code=True`.

## 5. Evaluation method: PangolinBench

PangolinBench is a tokenizer benchmark designed specifically for the Taiwan context. It covers 10 test subsets, each corresponding to a different facet of Taiwan text.

### 5.1 Test subsets

| Subset | Description |
|:---|:---|
| `traditional_zh_formal` | Formal Traditional Chinese, e.g. policy, education, healthcare, finance, and technology text |
| `taiwan_mandarin_colloquial` | Colloquial Taiwan Mandarin, e.g. particles and spoken markers |
| `taiwan_named_entities` | Taiwan named entities, e.g. place names, agencies, transit, and industry terms |
| `taigi_han_roman_mixed` | Taigi Han-character and Tailo mixed-writing stress test |
| `hakka_romanized` | Hakka romanization mixed with Han characters |
| `bopomofo` | Bopomofo mixed with Traditional Chinese |
| `taiwan_code_switching` | Code-switched Chinese–English technology text |
| `rich_transcription_json` | ASR JSON transcripts, with timestamps, speakers, and content |
| `rich_transcription_structured_text` | Structured transcript format |
| `unicode_edge_cases` | UTF-8 edge cases, e.g. punctuation, URLs, email, emoji, and diacritics |

### 5.2 Evaluation metrics

| Metric | Description |
|:---|:---|
| Lossless round-trip correctness | After encode then decode, any text must be identical to the original, with no character lost or changed |
| Token compression | How many tokens are needed to represent the same text, measured as tokens/character, tokens/UTF-8 byte, and characters/token |
| Chinese-character fragmentation | How many tokens, on average, each Chinese character needs; higher means more fragmentation |
| Taiwan-vocabulary metrics | For common Taiwan words: token counts, weighted token cost, and over-fragmentation rate (the share of words split into more than 3 tokens) |
| Writing-system coverage | Handling of Traditional Han characters, Bopomofo, Latin letters, Latin letters with diacritics, numerals, punctuation, and emoji, counted separately |
| Speech-transcript metrics | Whether transcript JSON still parses after encode/decode, whether timestamp precision is preserved, whether structural markers stay intact, and whether non-speech labels are kept |

## 6. PangolinBench results

This section compares PangolinTokenizer with 8 baseline tokenizers, for 9 tokenizers in total.

### 6.1 Baseline tokenizers

| Tokenizer | Reference model | Vocabulary size |
|:---|:---|---:|
| PangolinTokenizer | PangolinTokenizer | 114,822 |
| LLaMA 3.1 | Llama-3.1-8B | 128,256 |
| Qwen 3 | Qwen3-8B | 151,669 |
| Qwen 2.5 | Qwen2.5-7B | 151,665 |
| GPT-4o | gpt-4o, o200k_base | 200,019 |
| Qwen 3.6 | Qwen3.6-27B | 248,070 |
| Gemma 3 | gemma-3-4b-it | 262,145 |
| Gemma 4 | gemma-4-12b-it | 262,144 |
| TAIDE | TAIDE-12b-Chat | 318,080 |

PangolinTokenizer has the smallest vocabulary of all tokenizers tested. It is about 90% of LLaMA 3.1, 76% of Qwen 3, 57% of GPT-4o, 46% of Qwen 3.6, 44% of Gemma 4, and 36% of TAIDE.

Gemma 3 and Gemma 4 produce identical results on every subset and are therefore shown merged in the tables. Qwen 2.5 and Qwen 3 behave the same way. Qwen 3.6 uses a different and larger tokenizer.

### 6.2 Token compression results

The table below shows each tokenizer's token compression on PangolinBench. Unless otherwise noted, values are tokens/character. Lower values mean a more token-efficient tokenizer.

| Test subset | Pangolin | TAIDE | Gemma 3/4 | Qwen 3.6 | LLaMA 3.1 | GPT-4o | Qwen 2.5/3 |
|:---|---:|---:|---:|---:|---:|---:|---:|
| Vocabulary size | 114,822 | 318,080 | 262,144 | 248,070 | 128,256 | 200,019 | 151,669 |
| Formal Traditional Chinese | 0.676 | **0.559** | 0.716 | 0.676 | 0.902 | 0.902 | 0.735 |
| Colloquial Taiwan Mandarin | 0.708 | **0.688** | 0.750 | 0.750 | 0.917 | 0.979 | 0.792 |
| Taiwan named entities | 0.730 | **0.622** | 0.892 | 0.757 | 1.000 | 1.009 | 0.919 |
| Taigi Han-roman mix | 0.714 | **0.538** | 0.582 | 0.615 | 0.637 | 0.615 | 0.692 |
| Hakka romanization (tokens/byte) | 0.372 | **0.293** | 0.314 | 0.340 | 0.335 | 0.319 | 0.346 |
| Bopomofo | 1.068 | **0.750** | 0.795 | 1.386 | 1.205 | 1.227 | 1.114 |
| Code-switching | 0.478 | **0.380** | **0.380** | 0.413 | 0.424 | 0.457 | 0.457 |
| Speech transcript JSON | **0.400** | 0.423 | 0.428 | 0.441 | 0.405 | 0.405 | 0.447 |
| Overall tokens/character | **0.485** | 0.486 | 0.526 | 0.541 | 0.554 | 0.558 | 0.559 |

PangolinTokenizer's overall tokens/character is 0.485, the lowest of all tokenizers tested. TAIDE's overall tokens/character is 0.486, very close. However, TAIDE's vocabulary is 318,080 — about 2.77× that of PangolinTokenizer.

This shows PangolinTokenizer's clear advantage in vocabulary efficiency. It reaches overall compression close to, or slightly better than, much larger tokenizers, with a much smaller vocabulary.

### 6.3 Core Taiwan Mandarin text

On formal Traditional Chinese, colloquial Taiwan Mandarin, and Taiwan named entities, PangolinTokenizer is not the absolute best on every subset. TAIDE still has the lowest tokens/character on these three. However, PangolinTokenizer's vocabulary is only 36% of TAIDE's. Given that, PangolinTokenizer still reaches performance very close to the large tokenizers and clearly beats several mainstream multilingual tokenizers.

The token savings of PangolinTokenizer relative to the baselines are below. Negative values mean PangolinTokenizer uses fewer tokens.

| Baseline | Formal zh | Colloquial | Named entities | Overall |
|:---|---:|---:|---:|---:|
| GPT-4o | −25.0% | −27.7% | −27.7% | −13.1% |
| LLaMA 3.1 | −25.0% | −22.7% | −27.0% | −12.4% |
| Qwen 2.5/3 | −8.0% | −10.5% | −20.6% | −13.2% |
| Qwen 3.6 | 0.0% | −5.6% | −3.6% | −10.3% |
| Gemma 3/4 | −5.5% | −5.6% | −18.2% | −7.7% |
| TAIDE | +21.1% | +3.0% | +17.4% | −0.1% |

This shows an important trade-off. TAIDE trades a much larger vocabulary for stronger Chinese and Taiwan-vocabulary compression. PangolinTokenizer keeps comparable overall performance with a much smaller vocabulary, and wins on speech-transcript JSON and vocabulary efficiency.

### 6.4 Speech transcript JSON

PangolinTokenizer's tokens/character on the speech-transcript JSON subset is 0.400, the lowest of all tokenizers tested. This matches the design goal. PangolinTokenizer natively includes speech-transcript structural markers, so it can represent ASR training formats more efficiently.

### 6.5 Trade-offs on Taigi, Hakka, Bopomofo, and code-switching

PangolinTokenizer still has room to improve on the Taigi Han-roman mix, Hakka romanization, Bopomofo, and code-switching subsets.

On these subsets, TAIDE and Gemma 3/4 usually have better compression. This reflects the influence of vocabulary size and corpus distribution. A 115K vocabulary cannot allocate enough merge rules to Traditional Chinese, Taigi, Hakka, Bopomofo, English technical terms, JSON, URLs, and multimodal structural markers all at the same time.

Even so, PangolinTokenizer has several noteworthy results. On the Bopomofo subset, PangolinTokenizer's 1.068 beats GPT-4o, LLaMA 3.1, Qwen 3.6, and Qwen 2.5/3. On the Taigi Han-roman mix subset, PangolinTokenizer's 0.714 is close to Qwen 2.5/3's 0.692. The lossless round-trip rate is 100% on every subset. Even when token counts are higher, PangolinTokenizer never loses a character.

## 7. Taiwan-vocabulary metrics

PangolinBench builds a Taiwan-specific vocabulary set and computes token counts and over-fragmentation rate for each word.

### 7.1 Per-word token counts

| Taiwan term | Category | PangolinTokenizer |
|:---|:---|---:|
| National Health Insurance (健保) | Health policy | 1 token |
| MRT (捷運) | Transit | 1 token |
| Taipei (台北) | Place name | 1 token |
| Tainan (臺南) | Place name | 1 token |
| Semiconductor (半導體) | Industry | 1 token |
| Science park (科學園區) | Industry | 2 tokens |
| Village chief (里長) | Local governance | 2 tokens |
| Labor insurance (勞保) | Labor policy | 2 tokens |
| Labor-insurance pension (勞保年金) | Labor policy | 3 tokens |
| Household registration office (戶政事務所) | Agency | 3 tokens |
| Wafer foundry (晶圓代工) | Industry | 4 tokens |

High-frequency Taiwan terms such as "健保", "捷運", "台北", "臺南", and "半導體" can each be encoded as a single token. This shows that PangolinTokenizer's merge rules did learn some high-frequency Taiwan-context fragments.

Longer or more compound words are still split into multiple tokens. For example, "晶圓代工" is 4 tokens. This means future versions can still tune merge-rule allocation for industry terms, institutional terms, and long compound nouns.

### 7.2 Weighted vocabulary token cost

| Tokenizer | Vocabulary | Weighted cost | Over-fragmentation (>3 tokens) |
|:---|---:|---:|---:|
| TAIDE | 318,080 | **1.70** | **20%** |
| PangolinTokenizer | 114,822 | 2.48 | 27% |
| Qwen 3.6 | 248,070 | 2.59 | 27% |
| Gemma 3/4 | 262,144 | 2.92 | 33% |
| Qwen 2.5/3 | 151,669 | 3.08 | 47% |
| GPT-4o | 200,019 | 3.45 | 40% |
| LLaMA 3.1 | 128,256 | 3.47 | 53% |

TAIDE is best at Taiwan-vocabulary compression, consistent with its 318K vocabulary. PangolinTokenizer's weighted cost is 2.48 — the best once TAIDE is set aside. Compared with the similarly sized LLaMA 3.1, PangolinTokenizer's weighted Taiwan-vocabulary cost is about 29% lower.

This supports PangolinTokenizer's core design hypothesis: under a limited vocabulary, training merge rules on the Taiwan context can reduce the fragmentation of Taiwan vocabulary.

## 8. Speech-transcript stability

PangolinBench tests speech-transcript encode/decode stability with the following JSON structure.

```json
[
  {"Start":0.00,"End":3.42,"Speaker":0,"Content":"大家好，歡迎回來。"},
  {"Start":3.50,"End":7.10,"Speaker":1,"Content":"今天我們要討論台灣本土語音模型。"},
  {"Start":10.25,"End":12.00,"Speaker":0,"Content":"注音 ㄅㄆㄇ 與台語 tshit-á 混合測試。"},
  {"Start":12.10,"End":14.00,"Speaker":null,"Content":"[Silence]","Type":"non_speech"},
  {"Start":3575.50,"End":3578.25,"Speaker":2,"Content":"長會議時間戳測試。"}
]
```

Every tokenizer tested passes lossless round-trip, JSON parsing, and timestamp-precision checks. However, only PangolinTokenizer natively includes the full set of speech-transcript structural markers.

| Quality check | Pangolin | TAIDE | Gemma 3/4 | Qwen 3.6 | LLaMA 3.1 | GPT-4o | Qwen 2.5/3 |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Lossless round-trip 100% | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| JSON parses correctly | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| Timestamp precision preserved | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| No dense timestamp tokens | Pass | Pass | Pass | Pass | Pass | Pass | Pass |
| Speech-transcript structural markers | **Pass** | Fail | Fail | Fail | Fail | Fail | Fail |

The point here is not that other tokenizers cannot handle JSON. Every byte-level or Unicode-compatible tokenizer can round-trip JSON losslessly. The difference is that PangolinTokenizer designs the speech-transcript structural markers as native single-ID tokens. It can therefore support speech-model training formats directly, without extending the vocabulary after the fact.

## 9. Vocabulary efficiency analysis

A key observation about PangolinTokenizer is that it reaches the lowest overall tokens/character with the smallest vocabulary.

Vocabulary efficiency is defined as follows:

$$
\text{Vocabulary Efficiency}
= \frac{1 / \text{tokens per character}}{\text{vocabulary size} / 100000}.
$$

| Tokenizer | Vocabulary size | Overall tokens/character | Vocabulary efficiency |
|:---|---:|---:|---:|
| PangolinTokenizer | **114,822** | **0.485** | **1.795** |
| TAIDE | 318,080 | 0.486 | 0.647 |
| Gemma 3/4 | 262,144 | 0.526 | 0.725 |
| Qwen 3.6 | 248,070 | 0.541 | 0.745 |
| LLaMA 3.1 | 128,256 | 0.554 | 1.408 |
| GPT-4o | 200,019 | 0.558 | 0.896 |
| Qwen 2.5/3 | 151,669 | 0.559 | 1.179 |

PangolinTokenizer's vocabulary efficiency is 1.795, the highest of all tokenizers tested. That is, it buys the most characters/token per 100K of vocabulary space.

This has several practical implications. First, a smaller vocabulary reduces the parameter count of the embedding matrix and the output projection layer. Second, lower tokens/character lets the same context window hold more Taiwan-context text. Third, when the training token budget is fixed, lower token cost lets the model see more raw text content. Fourth, at inference time, shorter token sequences also reduce KV-cache pressure.

Note that vocabulary size by itself does not directly reduce the KV cache. The KV cache is driven mainly by sequence length. PangolinTokenizer's KV-cache advantage comes from lower token counts, not from the smaller vocabulary itself.

## 10. Usage

PangolinTokenizer can be loaded directly through Hugging Face Transformers.

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained(
    "OpenFormosa/PangolinTokenizer",
    trust_remote_code=False,
)

text = "<|system|>台灣健保與注音ㄅㄆㄇ，Tailo: Tâi-uân"
ids = tokenizer.encode(text)
decoded = tokenizer.decode(ids)

assert decoded == text
```

The model's maximum sequence length is 131,072 tokens.

## 11. Known limitations

### 11.1 Token efficiency on Taigi, Hakka, and Bopomofo has room to improve

On the Taigi Han-roman mix, Hakka romanization, and Bopomofo subsets, PangolinTokenizer underperforms the larger-vocabulary TAIDE, Gemma 3/4, and some baseline tokenizers. This reflects the natural limit of a 115K vocabulary. Improving compression on Taigi, Hakka, Bopomofo, and English technical terms at the same time may require a larger vocabulary or a more careful merge-rule allocation strategy.

### 11.2 Code-switching and English technical terms can still be strengthened

On the code-switching subset, PangolinTokenizer's tokens/character is 0.478, slightly above TAIDE, Gemma 3/4, and Qwen 3.6. This shows that a smaller vocabulary still has limited merge-rule coverage for English technical terms, API names, and code snippets.

Future versions can raise the sampling weight for Taiwan technology text, open-source code, API documentation, hardware specifications, and AI-engineering corpora.

### 11.3 PangolinBench is still a synthetic test set

For now, PangolinBench uses a built-in test set of 30 curated samples. These samples cover the main linguistic phenomena, but they are still not enough to represent the full distribution of Taiwan text.

The results in this report should therefore be read as a targeted, tokenizer-level benchmark, not a full real-world distribution evaluation. Stronger conclusions would require adding large unseen corpora — for example government open data, Taiwan news corpora, education and healthcare text, ASR transcripts, customer-service and meeting data, Taigi and Hakka corpora, and technical documents and code.

PangolinBench already supports mounting private unseen data through an external config file. Future evaluation should use larger-scale, deduplicated, stratified unseen corpora.

### 11.4 Tokenizer compression is not language-model capability

This report evaluates tokenizer-level compression, correctness, and format stability. These metrics matter, but they do not directly imply that "a language model using PangolinTokenizer must be better."

Supporting model-level claims would require controlled language-model ablations. For example: fix the model architecture, fix the training data, fix the training token budget or byte budget, and compare bits-per-byte, bits-per-character, downstream Taiwan-context tasks, and training stability on speech-transcript formats.

Until such experiments are done, claims about PangolinTokenizer should stay at the tokenizer level.

## 12. Conclusion

The core contribution of PangolinTokenizer is not "being able to tokenize Traditional Chinese." Byte-level tokenizers can already represent arbitrary UTF-8. The point of PangolinTokenizer is this: with a smaller vocabulary, it offers lower token cost, lower over-fragmentation, and more stable speech-transcript structural support on the Taiwan context.

On PangolinBench, we compared PangolinTokenizer with 8 baseline tokenizers, with the following results.

- The vocabulary size is 114,822, the smallest of all tokenizers tested.
- The overall tokens/character is 0.485, the lowest of all tokenizers tested.
- On formal Traditional Chinese, token counts are 25% lower than GPT-4o and LLaMA 3.1, 8% lower than Qwen 2.5/3, and on par with Qwen 3.6.
- On Taiwan named entities, token counts are about 28% lower than GPT-4o, about 21% lower than Qwen 2.5/3, and about 18% lower than Gemma 3/4.
- On colloquial Taiwan Mandarin, tokens/character is 0.708, better than GPT-4o, LLaMA 3.1, Qwen 2.5/3, and Gemma 3/4.
- On speech-transcript JSON, tokens/character is 0.400, the lowest of all tokenizers tested.
- The weighted Taiwan-vocabulary cost is 2.48, the best once the 318K-vocabulary TAIDE is set aside.
- The vocabulary efficiency is 1.795, the highest of all tokenizers tested.
- The lossless round-trip rate is 100%.
- PangolinTokenizer passes every quality-check threshold.
- PangolinTokenizer is the only tokenizer tested with native support for the full set of speech-transcript structural markers.

A tokenizer suited to the Taiwan context should meet three conditions at once. First, it must round-trip arbitrary UTF-8 losslessly. Second, it must have lower token cost on Taiwan Mandarin, Taiwan named entities, institutional terms, and mixed-writing-system text. Third, it must support modern speech, multimodal, and structured training formats.

Through byte-level BPE, Taiwan-context merge rules, general structural special tokens, and the PangolinBench evaluation pipeline, PangolinTokenizer provides a concrete implementation of all three.

## 13. Open resources

- **PangolinTokenizer model**: [huggingface.co/OpenFormosa/PangolinTokenizer](https://huggingface.co/OpenFormosa/PangolinTokenizer)
- **UbiTok training toolkit**: [github.com/OpenFormosa/ubi_tokenizer](https://github.com/OpenFormosa/ubi_tokenizer)
- **PangolinBench evaluation suite**: [github.com/OpenFormosa/PangolinBench](https://github.com/OpenFormosa/PangolinBench)

## References

- Sennrich, Rico, Barry Haddow, and Alexandra Birch. 2016. *Neural Machine Translation of Rare Words with Subword Units*. Proceedings of ACL.
- Rust, Phillip, Ivan Pfeiffer, Jonas Pfeiffer, Elad Ben-Zaken, Sebastian Ruder, and Iryna Gurevych. 2021. *How Good is Your Tokenizer? On the Monolingual Performance of Multilingual Language Models*. Proceedings of ACL-IJCNLP.
- Hugging Face. *Tokenizers Documentation*. See the byte-level BPE and pre-tokenizer documentation.

</div>
