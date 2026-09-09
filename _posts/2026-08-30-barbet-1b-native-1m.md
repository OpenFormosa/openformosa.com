---
layout: post
title: "How Barbet learned to use a 1M-token context"
zh_title: "Barbet 如何學會使用 1M 長上下文"
i18n_key: barbet_1m
description: "Barbet's path to a million-token context: longer training texts, shorter calculation exercises, and tests that separate using distant information from answering correctly."
zh_description: "Barbet 如何接續預訓練到百萬長度，為什麼還要回頭練短文，以及我們如何分辨「用到遠處資料」和「能自行答對」。"
date: 2026-08-30
last_modified_at: 2026-09-09
category: research
tags: [pretrain, model, long-context, barbet]
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

我們從既有的 Barbet 接續預訓練，把單段訓練文字逐步延長到 1M，也穿插較短的查找與計算練習。訓練後的測試顯示，七類長文任務中有六類，遠處的正確資料能提高正確答案的機率。這支持 Barbet 已能利用部分百萬長度的資訊；需要合併多筆資料來計算的任務，以及自行產生可靠答案的能力，仍待證明。

</div>

Barbet 是約 11 億參數的基底語言模型。它根據前文預測接下來的文字，還沒有被訓練成聊天助理。這些可供參考的前文，就是「上下文」。

本文的 1M 精確指 1,048,576 tokens。Token 是模型讀寫文字的單位，不等於一個中文字；1M 說的是單段輸入的長度，不是訓練累計讀過多少資料。以下結果對應 2026 年 8 月發布的 Barbet，不包含後續實驗。

## 1M 是怎麼練出來的？

[6 月的 Barbet 介紹]({% post_url 2026-06-21-barbet-1b-base %})記錄的訓練長度到 256K。當時的 1M 是研究用設定：調整模型辨識文字位置的方式，讓程式嘗試處理更長的輸入。模型還沒有用完整的 1M 文字接受訓練。

後續訓練從既有的 Barbet 繼續，依序使用 64K、128K、256K、512K，最後到 1M。到了 1M 階段，完整的百萬長度文字會參與下一個 token 的預測，預測誤差也會用來更新模型參數。因此，8 月發布的 Barbet 確實接受過 1M 預訓練，發布設定也不再使用先前的線性位置縮放。

配合長文訓練，我們也調整了模型讀取前文的方式。原本有些層只能直接參考附近的 8K tokens，後來逐步改成能參考完整前文的「全域注意力」層，最後再加上一層。原有的七個 Mamba2 層保留；完整架構列在附錄。更多層因此能直接讀到遠處資料，長文運算的成本也隨之增加。

資料則加入查找資訊、排列事件先後、追蹤數值變化，以及沿著幾段關係找答案的練習。關鍵資料放在不同位置，避免只練習找文章開頭或結尾。

這些都是預訓練：模型學習預測整段文字，訓練計入每個 token 的預測誤差，不只計算最後答案的誤差。這次發布沒有做指令微調、對話訓練或人類偏好訓練，也沒有接上外部記憶模組。整個過程延續原本的 Barbet，沒有換成另一個模型。

## 為什麼還要回頭練短文？

Barbet 有時能找回遠處的一個數字，卻不一定會用它計算。以庫存紀錄為例，下面只是說明用的例子，不是實際考題：

> 甲倉庫原本有 3 箱貨。後來又收到 2 箱。

接著寫「後來收到 2 箱」，只要找到原文的數字。接著寫「現在共有 5 箱」，則需要合併兩筆資料並完成加法。如果兩筆紀錄相隔很遠，答錯時就有兩種可能：沒找到資料，或找到了卻不會算。

我們因此使用 512 至 8K 的短文，分開練習「資料在附近時做計算」和「資料較遠時找回原文」，再練習找回後繼續計算。期間仍穿插完整 1M 訓練。回頭練短文是為了補基本操作，模型的最大長度並沒有改回 8K；練過之後是否真的改善，也必須重新測試。

最後一段使用 8K 文字，完成 768 次參數更新，約處理 1 億 tokens。結束後，我們重新載入存下來的 Barbet，再測完整的 1M 長度，確認最後的短文訓練之後還能使用遠處資料。

接續到這次發布的訓練紀錄，合計處理約 55.2 億 tokens，其中約 39.3 億來自長度恰好為 1M 的文字。這是累計處理量，可能包含重複資料，不包含 Barbet 最初的預訓練量。完整的階段數與用量列在附錄。

## 怎麼驗證它用到了遠處資料？

跑完 1M 輸入，只能說明運算完成。要知道前面的資料有沒有幫助，還需要一組對照。

每題準備兩份一樣長、結構相近的文字。一份保留正確的關鍵資料，另一份移除或改壞那些資料。讓同一個 Barbet 分別讀過兩份文字，再比較它給正確答案的機率。這就是本文的「配對測試」。

沿用庫存的例子，正確紀錄還在時，「5 箱」是否變得比較可能？如果是，就支持那些資料對預測有幫助。這種評測直接檢查基底模型對後續文字的預測，不需要先把 Barbet 訓練成聊天助理。

不過，評分程式事先知道正確答案。答案如果有好幾個 tokens，評分時會依序提供正確的前幾個 tokens，再計算下一個的機率；模型沒有自行寫完整個答案。即使「5 箱」的機率提高，也可能仍低於錯誤答案。因此，「資料有幫助」和「模型自己能答對」是兩個不同的結果。

## 測試結果：六類看得到幫助，計算仍有缺口

重新載入模型後，140 筆長度恰好為 1M 的樣本都完成評分，沒有記憶體不足或無效數值。七類任務各有 20 組配對樣本。

下表的「有幫助」，表示這類題目平均來看，有正確資料時，正確答案的機率較高。我們也估計了換一批題目可能造成的結果變動；考慮這項不確定性後，六類仍支持正面的效果。完整分數與統計方法列在附錄。

| 測試內容 | 遠處的正確資料有沒有幫助？ |
| --- | --- |
| 找出指定資訊 | 有幫助 |
| 用沒有語意線索的編碼查資料 | 有幫助 |
| 同時查找多筆資料 | 有幫助 |
| 判斷事件發生的先後順序 | 有幫助 |
| 追蹤數值經過更新後的結果 | 有幫助 |
| 沿著三段相連的關係找到結果 | 有幫助 |
| 合併多筆資料來求出結果 | 仍未證明 |

這裡的六類是任務種類，不能換算成六成或七分之六的答對率，也不代表每道題、每個位置都有改善。

合併多筆資料來計算，通常稱為「資訊彙整」（aggregation）。這類的平均改善很小，還無法排除沒有改善的可能。關鍵資料放在全文約 30% 和 50% 的位置時，有正確資料的版本，平均預測反而更差。另一組 8K 計算測試也只通過六項中的三項，表示問題不只發生在百萬長度。

原本的語言能力也要保留。我們另用 6,955 筆樣本，測量 Barbet 對程式碼、英文、日韓文、數學、多語和中文的文字預測。六類分數都沒有比原始 Barbet 變差，但這不等於測過所有應用、事實正確性或安全性。

## 「穩定 1M」的範圍到哪裡？

本文的「穩定 1M」是本專案對上述發布結果的稱呼：完整百萬長度可以完成運算，六類測試顯示遠處資料有助於預測，受測的基礎語言能力也沒有退步。它不保證 Barbet 能理解任意百萬長度文件，或自行可靠地回答其中的問題；本次也沒有證明 2M，或整體能力追上大型模型。

訓練方法上的經驗，是把延長文字、練習基本操作和檢查遠距資料是否有用放在同一個流程裡。不過，過程中架構、資料與訓練量都曾改變，沒有逐項分開比較，因此不能斷言哪一項改動貢獻最大，也不能把這份紀錄當成保證成功的配方。

下一個需要證明的，是 Barbet 找到資料之後，能否正確地合併、更新與計算。這需要讓它自行接著寫出答案，再檢查結果；增加輸入長度或累計訓練量，都不能代替這項證據。

## 技術附錄

需要核對方法、設定與數字時，可以展開以下附錄。確切模型版本可用最後一節的固定連結和檔案雜湊核對。

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

We continued pretraining the existing Barbet with progressively longer texts, reaching 1M tokens, while also using shorter retrieval and calculation exercises. After training, correct distant information increased the probability of the correct answer in six of seven long-context task families. This supports some use of information within a million-token context. Combining several records to calculate a result, and reliably producing complete answers on its own, remain unproven.

</div>

Barbet is a base language model with approximately 1.1 billion parameters. It learns to predict the next part of a text from what came before; it has not been trained as a chat assistant. That preceding text is its “context.”

Here, 1M means exactly 1,048,576 tokens. A token is a unit of text used by the model, not necessarily a word or character. This is the length of one input, not the total amount of data processed during training. The results below describe the August 2026 Barbet release, excluding later experiments.

## How was Barbet trained to reach 1M?

The [June introduction to Barbet]({% post_url 2026-06-21-barbet-1b-base %}) described training up to 256K. At that point, 1M was a research configuration: it changed how the model represents text positions so that the program could attempt longer inputs. Barbet had not yet been trained on full 1M-token texts.

Continued training used the existing Barbet, progressing through 64K, 128K, 256K, 512K, and finally 1M. At the 1M stage, full million-token texts took part in next-token prediction, and the prediction errors were used to update the model's parameters. The August release has therefore received actual 1M pretraining. Its configuration also no longer uses the earlier linear position scaling.

We also changed how Barbet reads the preceding text. Some layers could originally refer directly only to the nearest 8K tokens. They were progressively converted to “global attention” layers, which can refer to the full preceding text, and one more such layer was added. The original seven Mamba2 layers were retained; the appendix gives the full architecture. More layers could thus read distant information directly, at a higher computational cost.

The data included exercises in finding information, ordering events, tracking changing values, and following linked relationships. Important information appeared at different positions, so practice was not limited to searching the beginning or end.

This was pretraining throughout: the model learned to predict the whole text, with prediction errors counted at every token, not just the final answer. This release did not use instruction tuning, dialogue training, or human-preference training, and it has no external-memory module. We continued training the original Barbet rather than substituting another model.

## Why return to shorter texts?

Barbet could sometimes find a distant number without reliably using it in a calculation. Consider this inventory record, used here only as an illustration, not an actual evaluation item:

> Warehouse A held 3 boxes. It later received 2 more.

Continuing with “It received 2 boxes” only requires finding a number in the text. Continuing with “It now holds 5 boxes” requires combining both records and doing the addition. If the records are far apart, an error could have either cause: failure to find the information, or failure to calculate with it.

We therefore used shorter texts, from 512 to 8K, to practice calculation with nearby information and retrieval from farther away, followed by calculation with the retrieved information. Full 1M training was interleaved with this work. Returning to short texts was intended to strengthen basic operations, without reducing the maximum context to 8K. Whether those exercises helped still had to be tested.

The final stage used 8K texts for 768 parameter updates, processing about 100 million tokens. We then reloaded the saved Barbet and tested it at the full 1M length, checking whether it could still use distant information after the short-text training.

The continued-training runs leading to this release processed approximately 5.52 billion tokens, including 3.93 billion in texts exactly 1M tokens long. These are cumulative processed tokens, potentially including repeated data, and exclude Barbet's original pretraining. The appendix lists the stage counts and exact totals.

## How do we test whether distant information helps?

Completing a 1M-token input establishes that the computation ran. Testing whether the earlier information helped requires a comparison.

For each item, we prepare two texts of equal length and similar structure. One retains the correct information; the other removes or corrupts it. The same Barbet reads each version, and we compare the probability it assigns to the correct answer. This is the article's “paired test.”

In the inventory illustration, is “5 boxes” more likely when the correct records are present? If so, that supports a contribution from those records to the prediction. This evaluates a base model's predictions for the text that follows, without first training Barbet as a chat assistant.

The scoring program already knows the correct answer, however. For an answer with several tokens, it supplies the correct preceding answer tokens and calculates the next token's probability. The model does not write the whole answer on its own. Even if “5 boxes” becomes more likely, a wrong answer could still be more likely. Helpful information and a correctly generated answer are different results.

## Results: evidence helps in six families; calculation remains a gap

After reloading, Barbet completed scoring for all 140 examples, each exactly 1M tokens long, without running out of memory or producing invalid scores. The seven task families each had 20 matched examples.

“Helpful” below means that, on average within that family, the correct answer was more likely with the correct information present. We also estimated how the results might vary with a different sample of questions. Six families still supported a positive effect after accounting for that uncertainty. The appendix gives the exact scores and statistical method.

| Test | Did the correct distant information help? |
| --- | --- |
| Find a specified value | Helpful |
| Look up a code without clues from its meaning | Helpful |
| Retrieve several values | Helpful |
| Determine the order of events | Helpful |
| Track a value through updates | Helpful |
| Follow three linked relationships | Helpful |
| Combine several records to work out a result | Not proven |

The six families are types of tasks, not a 60% or six-sevenths answer accuracy. The result also does not establish improvement on every question or at every position.

Combining several records to calculate a result is usually called “aggregation.” Its mean improvement was small, and the interval could not rule out no improvement. With key information around 30% and 50% of the way through the text, predictions were worse on average when the correct information was present. A separate 8K computation diagnostic passed only three of six tests, showing that the problem is not limited to million-token inputs.

Earlier language abilities also need to be retained. We used another 6,955 examples to measure Barbet's text predictions for code, English, Japanese and Korean, math, multilingual text, and Chinese. None of the six scores worsened relative to the original Barbet. This does not cover every application, factual accuracy, or safety behavior.

## What does “stable 1M” mean here?

“Stable 1M” is this project's name for the release results above: full million-token computation completes, distant information helps prediction in six task families, and the tested base-language scores do not regress. It does not guarantee understanding of arbitrary million-token documents or reliable answers generated about them. These results also do not establish 2M capability or overall parity with larger models.

The training approach combined longer texts, practice on basic operations, and checks on whether distant information helped. Architecture, data, and training volume all changed along the way without separate comparisons isolating each factor. We therefore cannot say which change contributed most or offer this history as a guaranteed recipe.

The next result to establish is whether Barbet can combine, update, and calculate with information after finding it. That requires letting it generate the answer and checking the result. Longer inputs and more training tokens cannot replace that evidence.

## Technical appendix

Expand the sections below to check methods, settings, and exact figures. The fixed revision link and file hashes in the last section identify the specific model release.

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
