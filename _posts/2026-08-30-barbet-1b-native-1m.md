---
layout: post
title: "How Barbet learned to use a 1M-token context"
zh_title: "Barbet 如何學會使用 1M 長上下文"
i18n_key: barbet_1m
description: "How Barbet was trained on million-token sequences, what its long-context tests show, and why finding distant information still does not guarantee reliable answers."
zh_description: "Barbet 如何透過百萬長度訓練與較短的能力補強，學習使用遠處的資訊？本文說明訓練過程、六類測試的正向結果，以及仍未解決的資訊彙整問題。"
date: 2026-08-30
last_modified_at: 2026-09-07
category: research
tags: [pretrain, model, long-context, barbet]
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

Barbet 已完成單段長達 1,048,576 tokens 的預訓練。在七類長上下文測試中，有六類看到同一個結果：提供正確的遠距資料後，模型對正確答案的預測機率提高了。不過，彙整多筆資訊的能力仍未通過測試，也還不能據此宣稱它能可靠回答任意長文件的問題。

</div>

這裡的 1M 是模型一次處理的上下文長度。Token 是模型讀寫文字的單位，不等於一個中文字；本文的 1M 精確指 1,048,576 tokens，和訓練累計讀過多少資料是兩回事。以下整理的是 2026 年 8 月發布版本的結果。

## 從延長設定，到真正用 1M 資料訓練

[6 月的 Barbet 介紹]({% post_url 2026-06-21-barbet-1b-base %})記錄了當時的狀態：原生訓練長度到 256K，1M 則靠調整位置編碼的研究設定來延伸。這讓模型可以嘗試處理更長的輸入，但當時沒有足夠證據證明，它能穩定使用整段長文裡的資訊。

8 月發布的 Barbet 已實際用完整的 1M 長序列更新模型權重，正式設定也不再使用原先的線性位置縮放。從原始 Barbet 接續訓練、最後用於這次發布的訓練紀錄，合計處理了約 55.2 億 tokens；其中約 39.3 億來自長度恰好為 1M 的序列。這些數字只計算這次接續訓練，不包含 Barbet 最初的預訓練量。

我們也調整了模型讀取遠處資訊的方式。原本有些注意力層只看附近的 8K tokens，後來逐步改成可以讀取完整前文的全域注意力，最後再增加一層全域注意力。七個 Mamba2 層則保留，發布模型約有 11 億參數。

這項改動增加了遠距資訊可以直接參與計算的層數，代價是更高的長序列計算成本。整個過程沿用 Barbet 的模型權重繼續訓練，沒有換用另一個預訓練模型。

## 找得到資料，還要學會怎麼使用

訓練先經過 64K、128K、256K、512K，再到 1M。資料除了長度增加，也加入資訊查找、事件排序、變數追蹤和多段關係等練習，並把關鍵資訊放在不同位置。

之後的測試暴露出一個問題：Barbet 有時能從遠處找回一個值，卻無法穩定地用這個值完成計算。以庫存紀錄作比喻，找到某次入庫的數量，和根據多次入庫、出庫算出剩餘庫存，需要的能力並不相同。

若模型連附近的資料都算不好，繼續把資料放得更遠，很難分清它到底卡在哪裡。因此，後續訓練也回到 512 至 8K 的較短序列，分別補強附近的計算、遠處資料的複製，以及把取回的資料用於計算。期間再穿插完整 1M 訓練。這些短序列階段是在補能力，沒有把模型的最大長度改回 8K。

最後一段訓練使用 8K 序列，完成 768 次權重更新，約處理 1 億 tokens；之後重新載入模型，執行完整的 1M 評測。

這些工作都屬於預訓練：模型根據前文預測下一個 token，訓練損失涵蓋整段序列。這次發布沒有使用指令微調、對話訓練或人類偏好訓練，也沒有接上外部記憶模組。

## 怎麼確認模型用到了遠處的資訊？

Barbet 仍是基底模型，尚未被訓練成聊天助理。因此，這次主要測量的是它如何預測後續文字，而不是要求它遵照聊天指令作答。

每一題都有兩份一樣長、結構相近的上下文。一份保留正確的關鍵資料；另一份移除或破壞那些資料。接著，我們比較模型在兩種情況下，給正確答案多高的預測機率。

如果保留關鍵資料能提高正確答案的機率，就表示那些資料確實影響了模型的預測。這比單純確認「能載入一百萬 tokens」多了一層能力證據。

但這種測法會沿著已知的正確答案逐字評分。它沒有讓模型從頭自由生成答案，所以也不能把結果直接當成答題正確率。是否能自行產生可靠答案，仍需要另外測試。

## 測試結果，以及還沒做到的事

重新載入模型後，140 筆長度恰好為 1M 的樣本都完成了評分，沒有記憶體不足或無效數值。七類任務各有 20 組配對樣本，結果如下。「有正向效果」表示保留正確資料能提高正確答案的預測機率，而且平均效果的 95% 信賴區間高於零。

| 測試內容 | 正向效果 |
| --- | --- |
| 找出指定資訊 | 有 |
| 以無語意代碼查找資訊 | 有 |
| 同時查找多筆資料 | 有 |
| 判斷事件順序 | 有 |
| 追蹤變數更新後的值 | 有 |
| 串接三段關係 | 有 |
| 彙整多筆資訊 | 仍未證明 |

這裡的「六類通過」不是答題正確率。它描述的是六類任務中的平均機率變化，也不保證每個位置、每一道題都有改善。

資訊彙整是目前明確的弱點。它的平均效果很小，統計上還無法排除沒有改善的可能；關鍵資料放在全文約 30% 和 50% 的位置時，平均效果甚至為負。另一組 8K 計算診斷也只通過六項中的三項，顯示「找到資料之後如何運算」仍不完整。

我們另外用 6,955 筆樣本檢查接續訓練是否損害原有能力，涵蓋程式碼、英文、日韓文、數學、多語和中文。六類的文字預測指標都沒有比原始 Barbet 變差。這支持原有語言建模能力得到保留，但不能延伸成所有應用、事實正確性或安全性都不退步。

因此，這次的「穩定 1M」有明確範圍：Barbet 能完成百萬長度的運算，能在上述六類測試中利用遠距資料，也保留了這組評測所涵蓋的基礎能力。它尚未證明能完整理解任意百萬長度文件、穩定彙整資料或可靠地自由作答；本次結果也不包含 2M 長度，或與大型模型整體能力相當的主張。

對後續研究而言，待解問題已經更具體：除了把資料找回來，還要讓 Barbet 在不同位置都能正確使用它，並把預測機率上的改善轉化成實際生成的答案。

## 技術附錄

以下保留實驗方法與完整數字，供需要核對或重現的讀者展開閱讀。

<details markdown="1">
<summary>模型架構與載入設定</summary>

原始 Hugging Face 權重轉成 Megatron 訓練格式後，4K 與 8K 選定位置的原始 FP32 輸出分數（logits）逐位元一致。這項檢查支持格式轉換保留了受測輸出，並不等於測遍所有輸入。

以下以 G 表示全域注意力、S 表示 8K 滑動視窗注意力、M 表示 Mamba2。架構依序改為：

```text
[G,S,S,M]×7 → [G,G,S,M]×7 → [G,G,G,M]×7 → [G,G,G,M]×7+G
```

最後新增的全域層先設成不改變輸出的恆等映射，再接受後續訓練。插層本身沒有權重更新，也不計入訓練量。架構、資料與訓練量在過程中都有變動，不能只憑最終結果，單獨判定某次架構改動帶來多少能力提升。

| 項目 | 值 |
| --- | ---: |
| 參數量，不重複計算共用的輸出權重 | 1,118,799,096 |
| 總層數 | 29 |
| 全域注意力／Mamba2 層數 | 22／7 |
| 隱藏維度／前饋層維度 | 1,536／5,120 |
| 注意力頭／KV 頭數 | 16／2 |
| 詞彙表大小 | 114,944 |
| 原生上下文長度 | 1,048,576 |

模型沿用 PangolinTokenizer，以及共用權重的 embedding／LM head。曾測試的純 KDA 架構因原始能力保留不足，未用於本次發布；發布模型也不包含 QSA 或外部記憶控制器。

```json
{
  "max_position_embeddings": 1048576,
  "rope_theta": 10000000.0,
  "rope_scaling": null
}
```

6 月版本使用 262,144 的原生長度與 factor 4 的線性 RoPE 延伸設定。GitHub 中的 `configs/barbet_1b/` 和 `configs/barbet_1b_1m/` 保留了那些舊設定；載入本文版本時，請使用模型權重隨附的 `config.json`。

</details>

<details markdown="1">
<summary>訓練量、最後一段訓練的資料與參數</summary>

從原始 Barbet 接續訓練、最後承接到發布模型的紀錄，共有 42 個訓練階段、11,715 次權重更新、5,516,558,336 個實際處理的 tokens。其中 22 個階段、3,744 次更新使用完整的 1,048,576-token 序列，合計 3,925,868,544 tokens。

| 單段序列長度 | 累計處理的 tokens |
| ---: | ---: |
| 512 | 144,703,488 |
| 1K | 25,165,824 |
| 2K | 25,165,824 |
| 4K | 25,165,824 |
| 8K | 427,819,008 |
| 64K | 100,663,296 |
| 128K | 305,135,616 |
| 256K | 268,435,456 |
| 512K | 268,435,456 |
| 1M | 3,925,868,544 |
| 合計 | 5,516,558,336 |

這是實際處理量，不代表全部都是不重複的資料。統計不包含未更新權重就失敗的執行、評測、匯出、重新載入、恆等插層，以及未用於發布模型的實驗分支。插層時曾重設更新編號，因此單一檔名的編號不能當成整段訓練的總更新數。

較早的文件另有約 1,500 億 tokens（150B）的原始訓練預算，涵蓋一般預訓練、繁中訓練和長度延伸。現有紀錄不足以把它核對成這份發布權重確實完成的總量，因此不把這筆預算與上表相加，宣稱為精確的完整訓練量。

最後一段訓練設定如下：

| 設定 | 值 |
| --- | ---: |
| 序列長度 | 8,192 |
| 權重更新次數 | 768 |
| 實際處理的 tokens | 100,663,296 |
| 全域批次大小／每次更新 tokens | 16／131,072 |
| 平行配置 | TP2 × CP4 × DP1 |
| 數值精度 | BF16 |
| 最佳化器 | AdamW，betas `(0.9, 0.95)`，epsilon `1e-8` |
| 權重衰減／梯度裁剪 | `0.1`／`1.0` |
| 學習率 | 此階段採 cosine，`1.2e-6 → 3e-7` |
| 暖身更新次數／隨機種子 | 16／17 |

資料比例為 25% 既有資料重播、50% 嚴格數字格式的遠距取值與計算、12.5% 局部取樣修正、12.5% 8K 遠距原文複製。訓練使用涵蓋所有 tokens 的因果語言模型交叉熵，沒有只計答案的損失、教師模型分數、蒸餾、SFT 或 RLHF。768 次更新全數完成，沒有跳過更新、NaN、記憶體不足或致命錯誤。

</details>

<details markdown="1">
<summary>1M 評測方法、統計數字與判定標準</summary>

每組樣本包含保留正確證據與移除或破壞證據的兩個版本，長度和文字表面結構互相匹配。評分使用 teacher forcing：每一步都給定正確答案此前的 tokens，只計算目標答案的負對數似然（NLL）。

```text
遠距證據效果 = 移除證據後的目標 NLL − 保留證據時的目標 NLL
```

NLL 越低，代表模型給正確文字的機率越高，因此上述差值為正表示證據有幫助。每類 20 組配對樣本，以 2,000 次成對 bootstrap 重抽樣，估計平均效果的 95% 信賴區間。

| 任務 | 平均效果，nats／目標 token | 95% 信賴區間 | 判定 |
| --- | ---: | ---: | --- |
| 指定資訊查找（Exact NIAH） | +0.868817 | [+0.411734, +1.359182] | 通過 |
| 無語意代碼查找（Opaque NIAH） | +1.451789 | [+0.751489, +2.303071] | 通過 |
| 多筆資料查找（Multi-key） | +1.041410 | [+0.494490, +1.671721] | 通過 |
| 事件排序（Ordering） | +1.160107 | [+0.710641, +1.667173] | 通過 |
| 變數追蹤（Variable tracking） | +0.249664 | [+0.075717, +0.456798] | 通過 |
| 三段關係串接（Three-hop chain） | +1.338904 | [+0.665179, +2.092832] | 通過 |
| 資訊彙整（Aggregation） | +0.028431 | [−0.019926, +0.080348] | 未證明 |

評測分成八份執行，140／140 筆都得到有限分數。最終訓練前已固定發布條件：所有 1M 樣本完成有效評分、至少五類任務的信賴區間下界大於零，以及六類基礎能力指標各自不超過 2% 的相對退步。結果為六類任務通過。這是本專案的發布標準，並非適用於所有模型的 1M 能力認證。

上述區間描述這批受測配對樣本的平均效果，不能視為所有題型、所有位置或不同訓練種子的保證。資訊彙整在 30% 與 50% 位置的平均效果仍為負；自由生成、所有位置皆有效和七類全數通過，都不是本次已證明的結果。

獨立的嚴格 8K 診斷只通過 3／6 項：資訊彙整的遠距複製對照、狀態更新的局部計算，以及狀態更新的遠距複製對照。未通過的是資訊彙整的局部計算、資訊彙整的遠距計算，以及狀態更新的遠距計算。

</details>

<details markdown="1">
<summary>基礎能力保留結果與模型來源</summary>

保留能力測試共有 6,955 筆樣本、3,000,079 個模型 tokens。指標為每個 UTF-8 位元組的預測資訊量（bits per byte，BPB），越低越好；比較對象是接續訓練前、已核對格式轉換的原始 Barbet。

| 類別 | 本次發布 BPB | 原始 Barbet BPB | 相對變化 |
| --- | ---: | ---: | ---: |
| 程式碼 | 0.686505 | 0.739298 | −7.14% |
| 英文 | 0.845356 | 0.894396 | −5.48% |
| 日文／韓文 | 0.953428 | 0.964779 | −1.18% |
| 數學 | 0.664294 | 0.701121 | −5.25% |
| 多語 | 1.110032 | 1.224230 | −9.33% |
| 繁中／中文 | 1.126968 | 1.137099 | −0.89% |

六類均未退步。這個結果限於上述語言模型評分，不等同於指令遵循、對話品質、事實性或安全對齊評估。

程式碼與專案文件位於 [OpenFormosa/Barbet](https://github.com/OpenFormosa/Barbet)。本文對應的模型可由 [Hugging Face 固定版本](https://huggingface.co/OpenFormosa/barbet-1b-base/tree/bd8de3ec404752d61da9df78ab2d1f59928f7f44)核對；模型庫在本文發布時採權限控管。

檔案核對用的 SHA256：

```text
模型存檔目錄
0380aee774af7f1e81c8e4b99d016171b07490999a117f66653d4c520b580cf6

model.safetensors
05376dde654c9beb8154e1e997d0765ce4e236e51d4de99f38ad2e20fd730000

config.json
968e293a32e225a993e9a0e503ed4f41f0d3c69e7d7b03c85078497935b48d91
```

</details>

</div>

<div class="post-lang-en" markdown="1">

<div class="post-abstract" markdown="1">

Barbet has completed pretraining on sequences exactly 1,048,576 tokens long. In six of seven long-context task families, providing the correct distant information increased the model's probability of the correct answer. Aggregating multiple pieces of information remains unproven, and these results do not establish reliable answers to questions about arbitrary long documents.

</div>

Here, 1M is the amount of context the model processes in one sequence. A token is a unit of text used by the model, not necessarily a word or character. We use 1M to mean exactly 1,048,576 tokens; the total amount of data processed during training is a separate quantity. This article describes the August 2026 release.

## From a longer configuration to training at 1M

The [June introduction to Barbet]({% post_url 2026-06-21-barbet-1b-base %}) described native training up to 256K, with a research configuration that extended the position encoding to 1M. That setting allowed experiments with longer inputs, but there was not enough evidence that the model could reliably use information throughout them.

The August release has had its weights updated on full 1M-token sequences. Its release configuration no longer uses the earlier linear position scaling. The continued-training runs that led to this release processed approximately 5.52 billion tokens, including 3.93 billion in sequences exactly 1M tokens long. These figures exclude Barbet's original pretraining.

We also changed how the model accesses distant information. Some attention layers originally attended only to the preceding 8K tokens. They were progressively converted to global attention, which can attend to the full preceding context, and one more global-attention layer was added. The seven Mamba2 layers were retained. The released model has approximately 1.1 billion parameters.

This gives distant information more layers in which it can participate directly in computation, at the cost of more expensive long-sequence processing. The work continued from Barbet's weights throughout; it did not substitute another pretrained model.

## Finding information and learning to use it

Training first progressed through 64K, 128K, 256K, 512K, and then 1M. Alongside longer sequences, the data introduced retrieval, event ordering, variable tracking, and chains of relationships, with important information placed at different positions.

Later tests exposed a weakness. Barbet could sometimes retrieve a distant value without reliably using it in a calculation. An inventory log illustrates the distinction: finding the quantity in one delivery is different from calculating the stock remaining after several arrivals and departures.

If a model cannot calculate correctly with nearby information, moving that information farther away makes the cause of failure harder to identify. Later training therefore also used shorter sequences, from 512 to 8K, to work separately on local computation, copying distant values, and using retrieved values in calculations. Full 1M training was interleaved with this work. The shorter stages did not reduce the model's maximum context to 8K.

The final stage used 8K sequences for 768 weight updates, processing about 100 million tokens. The saved model was then loaded again for the full 1M evaluation.

All of this was pretraining: predict the next token from the preceding text, with loss across the whole sequence. This release did not use instruction tuning, dialogue training, or human-preference training, and it has no external-memory module.

## How we tested whether distant information mattered

Barbet is still a base model, not a trained chat assistant. The main evaluation therefore measured its predictions of subsequent text, rather than its ability to follow conversational instructions.

Each test item had two contexts of equal length and similar structure. One retained the correct evidence; the other removed or corrupted it. We then compared the probability the model assigned to the correct answer in each case.

If retaining the evidence raised that probability, the information had affected the model's prediction. That provides capability evidence beyond simply loading a million-token input.

There is an important limit: this method scores the known correct answer token by token, supplying its correct preceding tokens at each step. It does not ask the model to generate an answer freely. The result is therefore not an answer-accuracy score; dependable generation needs its own evaluation.

## Results and remaining limitations

After reloading, Barbet completed scoring for all 140 examples, each exactly 1M tokens long, without running out of memory or producing invalid scores. There were 20 matched examples per task family. A positive effect below means that correct evidence raised the probability of the correct answer, with the mean effect's 95% confidence interval above zero.

| Test | Effect |
| --- | --- |
| Find a specified value | Yes |
| Look up an opaque code | Yes |
| Retrieve several values | Yes |
| Order events | Yes |
| Track variable updates | Yes |
| Follow three-hop chains | Yes |
| Aggregate information | Not proven |

Six passing families does not mean six-sevenths of the questions were answered correctly. It describes an average probability change within six task families, not improvement on every item or at every position.

Aggregation is a clear remaining weakness. Its mean effect was small, and the statistical interval could not rule out no improvement. The mean effect was negative when evidence appeared around 30% and 50% of the way through the context. A separate 8K computation diagnostic passed only three of six tests, also showing that using information after finding it remains incomplete.

We checked for damage to earlier capabilities using 6,955 examples covering code, English, Japanese and Korean, math, multilingual text, and Chinese. None of the six text-prediction scores worsened relative to the original Barbet. This supports retention of the language-modeling abilities covered by the suite, not a guarantee about every application, factual accuracy, or safety behavior.

“Stable 1M” thus has a defined scope here: Barbet completes million-token computation, uses distant information in the six task families above, and retains the base abilities measured by this suite. The results do not establish complete understanding of arbitrary million-token documents, reliable aggregation, or dependable free answers. They also make no claim about a 2M context or overall parity with larger models.

The remaining research question is more specific now: can Barbet consistently use retrieved information at different positions, and turn improvements in answer probability into answers it actually generates?

## Technical appendix

Expand the sections below for methods and exact figures needed to check or reproduce the work.

<details markdown="1">
<summary>Model architecture and loading configuration</summary>

After converting the original Hugging Face weights to Megatron's training format, selected raw FP32 output scores (logits) at 4K and 8K were bitwise identical. This supports preservation of the tested outputs during conversion, not exhaustive equivalence over all inputs.

G denotes global attention, S an 8K sliding-attention layer, and M Mamba2. The architecture changed in this order:

```text
[G,S,S,M]×7 → [G,G,S,M]×7 → [G,G,G,M]×7 → [G,G,G,M]×7+G
```

The final added layer was initialized as an identity mapping before further training. Its insertion involved no weight updates and is excluded from the token count. Architecture, data, and training volume all changed during the project, so the final result alone cannot isolate the capability gain caused by any one architectural change.

| Property | Value |
| --- | ---: |
| Parameters, excluding a duplicate tied output head | 1,118,799,096 |
| Total layers | 29 |
| Global-attention / Mamba2 layers | 22 / 7 |
| Hidden / feed-forward dimensions | 1,536 / 5,120 |
| Attention / KV heads | 16 / 2 |
| Vocabulary size | 114,944 |
| Native context length | 1,048,576 |

Barbet retains PangolinTokenizer and tied embedding / LM-head weights. An experimental pure-KDA architecture was excluded because it did not retain enough of the original ability. This release also contains no QSA or external-memory controller.

```json
{
  "max_position_embeddings": 1048576,
  "rope_theta": 10000000.0,
  "rope_scaling": null
}
```

The June release used a native length of 262,144 and factor-4 linear RoPE extension. The GitHub directories `configs/barbet_1b/` and `configs/barbet_1b_1m/` retain those older settings. Load the model described here with the `config.json` shipped alongside its weights.

</details>

<details markdown="1">
<summary>Training volume, final-stage data, and hyperparameters</summary>

The continued-training history leading from the original Barbet to this release contains 42 stages, 11,715 weight updates, and 5,516,558,336 processed tokens. Of these, 22 stages and 3,744 updates used full 1,048,576-token sequences, totaling 3,925,868,544 tokens.

| Sequence length | Cumulative tokens processed |
| ---: | ---: |
| 512 | 144,703,488 |
| 1K | 25,165,824 |
| 2K | 25,165,824 |
| 4K | 25,165,824 |
| 8K | 427,819,008 |
| 64K | 100,663,296 |
| 128K | 305,135,616 |
| 256K | 268,435,456 |
| 512K | 268,435,456 |
| 1M | 3,925,868,544 |
| Total | 5,516,558,336 |

These are processed tokens, not necessarily unique data. Counts exclude runs that failed before any weight update, evaluation, export, reload, identity-only layer insertion, and experimental branches that did not lead to the release. Update numbering was reset during layer insertion, so a number in a saved-model filename does not give the total update count.

Earlier documents describe an original recipe budget of approximately 150 billion tokens across general pretraining, Traditional-Chinese training, and context extension. Available records do not establish that figure as the completed total for these released weights. We therefore do not add that budget to this table and present the sum as an exact lifetime training total.

The final training stage used:

| Setting | Value |
| --- | ---: |
| Sequence length | 8,192 |
| Weight updates | 768 |
| Tokens processed | 100,663,296 |
| Global batch / tokens per update | 16 / 131,072 |
| Parallel configuration | TP2 × CP4 × DP1 |
| Precision | BF16 |
| Optimizer | AdamW; betas `(0.9, 0.95)`; epsilon `1e-8` |
| Weight decay / gradient clipping | `0.1` / `1.0` |
| Learning rate | Stage-local cosine, `1.2e-6 → 3e-7` |
| Warmup updates / random seed | 16 / 17 |

The data mixture was 25% replay, 50% strict-digit distant-value retrieval and computation, 12.5% local sampler repair, and 12.5% literal remote copying at 8K. The objective was all-token causal language-model cross-entropy, with no answer-only loss, teacher-model scores, distillation, SFT, or RLHF. All 768 updates completed without skipped updates, NaN, out-of-memory events, or fatal errors.

</details>

<details markdown="1">
<summary>1M evaluation method, statistics, and release criteria</summary>

Each pair contains one context retaining correct evidence and one with that evidence removed or corrupted, matched for length and surface structure. Teacher forcing supplies the correct preceding answer tokens at each step. Negative log-likelihood (NLL) is scored only on the target answer.

```text
Distant-evidence effect = target NLL without evidence − target NLL with evidence
```

Lower NLL means higher probability assigned to the correct text, so a positive difference indicates useful evidence. Each family contains 20 matched examples. We estimate a 95% confidence interval (CI) for the mean effect with 2,000 paired-bootstrap resamples. Effects are in nats per target token.

| Task | Mean effect | 95% CI | Decision |
| --- | ---: | ---: | --- |
| Exact NIAH | +0.868817 | [+0.411734, +1.359182] | Pass |
| Opaque NIAH | +1.451789 | [+0.751489, +2.303071] | Pass |
| Multi-key | +1.041410 | [+0.494490, +1.671721] | Pass |
| Ordering | +1.160107 | [+0.710641, +1.667173] | Pass |
| Variable tracking | +0.249664 | [+0.075717, +0.456798] | Pass |
| Three-hop chain | +1.338904 | [+0.665179, +2.092832] | Pass |
| Aggregation | +0.028431 | [−0.019926, +0.080348] | Not proven |

Evaluation ran in eight shards, with finite scores for all 140 examples. The release criteria were fixed before the final training run: valid scoring for every 1M example, a confidence-interval lower bound above zero in at least five families, and no more than 2% relative regression in each of the six base-capability categories. Six task families passed. This is a project-specific release standard, not a universal certification of 1M capability.

These intervals describe mean effects in the tested pairs. They do not guarantee performance across every task, position, or training seed. Aggregation still had negative mean effects at 30% and 50% depth. Free generation, positive effects at all positions, and seven passing families remain unestablished.

The separate strict-8K diagnostic passed 3/6 tests: aggregation remote-copy control, state-update local computation, and state-update remote-copy control. It failed aggregation local computation, aggregation remote computation, and state-update remote computation.

</details>

<details markdown="1">
<summary>Base-capability retention and model sources</summary>

The retention suite contains 6,955 examples and 3,000,079 model tokens. It uses bits per UTF-8 byte (BPB; lower is better), comparing this release with the original Barbet after its verified format conversion and before continued training.

| Category | This release BPB | Original Barbet BPB | Relative change |
| --- | ---: | ---: | ---: |
| Code | 0.686505 | 0.739298 | −7.14% |
| English | 0.845356 | 0.894396 | −5.48% |
| Japanese / Korean | 0.953428 | 0.964779 | −1.18% |
| Math | 0.664294 | 0.701121 | −5.25% |
| Multilingual | 1.110032 | 1.224230 | −9.33% |
| Traditional Chinese / Chinese | 1.126968 | 1.137099 | −0.89% |

None of the six categories regressed. This result is limited to these language-model scores; it is not an evaluation of instruction following, dialogue quality, factuality, or safety alignment.

Code and project documentation are in [OpenFormosa/Barbet](https://github.com/OpenFormosa/Barbet). The model described here is identified by this [fixed Hugging Face revision](https://huggingface.co/OpenFormosa/barbet-1b-base/tree/bd8de3ec404752d61da9df78ab2d1f59928f7f44). The model repository was access-controlled at publication.

SHA256 hashes for checking the files:

```text
Saved-model directory tree
0380aee774af7f1e81c8e4b99d016171b07490999a117f66653d4c520b580cf6

model.safetensors
05376dde654c9beb8154e1e997d0765ce4e236e51d4de99f38ad2e20fd730000

config.json
968e293a32e225a993e9a0e503ed4f41f0d3c69e7d7b03c85078497935b48d91
```

</details>

</div>
