---
layout: post
title: "How Barbet learned to use a 1M-token context"
zh_title: "Barbet 如何學會使用 1M 長上下文"
i18n_key: barbet_1m
description: "How Barbet was trained on million-token texts, why it still needed shorter exercises, and how we tested whether distant information helped it predict the right answer."
zh_description: "Barbet 怎麼從較短的文字練到百萬長度？為什麼又回頭練 8K？本文說明訓練經過、測試方法，以及目前能做和還做不到的事。"
date: 2026-08-30
last_modified_at: 2026-09-08
category: research
tags: [pretrain, model, long-context, barbet]
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

Barbet 已經用單段長達一百萬 tokens 的文字做過預訓練。在七類長文測試中，六類顯示：前面相隔很遠的資訊，確實能幫助它預測正確答案。至於要合併多筆資料來運算的題目，遠處資訊是否有幫助，目前仍未證明。這些結果還不能保證它能自行答對任意長文件的問題。

</div>

Barbet 是約 11 億參數的基底語言模型：它學的是根據前文預測接下來的文字，還沒有被訓練成聊天助理。這些可供參考的前文，就是「上下文」。

本文的 1M 精確指 1,048,576 tokens。Token 是模型讀寫文字的單位，不等於一個中文字；1M 說的是單段輸入的長度，不是訓練累計讀過多少資料。以下結果對應 2026 年 8 月發布的 Barbet，不包含後續實驗。

## 從延長設定，到真正用 1M 文字訓練

[6 月的 Barbet 介紹]({% post_url 2026-06-21-barbet-1b-base %})記錄的訓練長度到 256K。當時要嘗試 1M，得調整模型辨識文字位置的設定，也就是「位置編碼」。這能讓程式嘗試處理更長的輸入，卻還不能證明模型會使用整段文字裡的資訊。

8 月發布的 Barbet，已經實際用完整的 1M 文字訓練。模型根據前文預測下一個 token，訓練程式再依預測誤差調整模型的內部參數，也就是「權重」。因此，百萬長度的文字已經參與學習，不只是在測試時才放進模型。發布設定也不再使用先前的線性位置縮放。

我們也改了模型讀取前文的方式。原本有些層只能直接參考附近的 8K tokens，後來逐步改成能參考完整前文的「全域注意力」層，最後再加上一層。原有的七個 Mamba2 層則保留，完整架構列在附錄。

這樣讓更多層能直接讀到遠處的資料，代價是長文運算更貴。整個過程都是從原本的 Barbet 接著訓練，沒有換成另一個模型。不過，架構、資料和訓練量都曾改變；這份紀錄能說明我們做了什麼，不能單獨證明哪一項改動貢獻最大。

## 為什麼練到 1M，又回頭練 8K？

訓練先經過 64K、128K、256K、512K，再到 1M。我們在資料中加入找資料、排事件先後、追蹤數值變化，以及沿著幾段關係找答案的練習。關鍵資訊會放在不同位置，避免只練習找開頭或結尾。

測試後，我們發現 Barbet 有時能找回遠處的一個數字，卻不一定會用它計算。用一份庫存紀錄就能說明這個差別。以下是示意例子，不是本次實際考題：

> 甲倉庫原本有 3 箱貨。後來又收到 2 箱。

問「後來收到幾箱」，找到「2 箱」就夠了。問「現在共有幾箱」，則要把兩筆資料合起來，算出「5 箱」。如果兩筆紀錄相隔很遠，模型還得在計算時用到前面的資料。這時答錯，可能是沒找到資料，也可能是找到了卻不會算。

後續訓練因此也使用 512 至 8K 的較短文字，分開補強這幾件事：資料就在附近時能不能算對、相隔較遠時能不能找回原文、找回後能不能繼續計算。期間仍穿插完整 1M 訓練。短文練習是在補基本操作，沒有把模型的最大長度改回 8K。

最後一段訓練使用 8K 文字，完成 768 次權重更新，約處理 1 億 tokens。訓練結束後，我們把存下來的模型重新載入，再測完整的 1M 長度。

從原始 Barbet 接續訓練、最後用於這次發布的紀錄，合計處理約 55.2 億 tokens，其中約 39.3 億來自長度恰好為 1M 的文字。這是累計處理量，可能包含重複資料，也不包含 Barbet 最初的預訓練量。

這些工作都屬於預訓練。即使資料包含計算練習，模型仍然是在學習預測整段文字；訓練計入每個 token 的預測誤差，不只看最後答案。這次發布沒有做指令微調、對話訓練或人類偏好訓練，也沒有接上外部記憶模組。

## 怎麼知道 Barbet 真的用到了遠處的資料？

評測沿用基底模型的工作方式：給它前文，檢查它對後續文字的預測。這樣可以先測長文資訊是否有用，不把熟不熟悉聊天格式混進來。

每題都有兩份一樣長、結構相近的文字：一份保留正確的關鍵資料，另一份移除或改壞那些資料。接著比較，在這兩種情況下，模型各給正確答案多高的機率。這就是「配對測試」；要比較的不是兩個模型，而是同一個 Barbet 看過兩種前文後的差別。

沿用庫存的例子：前面有正確紀錄時，Barbet 是否更傾向接著寫出「5 箱」？若正確資料能提高正確答案的機率，就有證據支持它的預測用到了那些資料，而不只是成功跑完一百萬 tokens。

這裡有一個重要限制：評分程式已經知道正確答案，會按照正確答案的順序，逐個 token 計算機率；它沒有讓模型自行把整個答案寫出來。即使「5 箱」的機率提高，也可能仍低於某個錯誤答案。因此，這項測試能回答「資料有沒有幫助預測」，還不能回答「模型自己作答時，有多少題會答對」。

## 目前做到哪裡？

重新載入模型後，140 筆長度恰好為 1M 的樣本都完成評分，沒有記憶體不足或無效數值。七類任務各有 20 組配對樣本。

下表的「有幫助」，表示這類題目平均來看，正確資料讓模型更傾向預測正確答案。我們也估計了換一批樣本可能帶來的誤差；將這個不確定性納入後，六類仍支持正面的效果。完整數字與統計方法列在附錄。

| 測試內容 | 遠處的正確資料有沒有幫助？ |
| --- | --- |
| 找出指定資訊 | 有幫助 |
| 用沒有語意線索的編碼查資料 | 有幫助 |
| 同時查找多筆資料 | 有幫助 |
| 判斷事件發生的先後順序 | 有幫助 |
| 追蹤數值經過更新後的結果 | 有幫助 |
| 沿著三段相連的關係找到結果 | 有幫助 |
| 合併多筆資料來求出結果 | 仍未證明 |

「六類通過」不能換算成答對六成或七分之六的題目。它描述的是六類任務的平均機率變化，不保證每個位置、每一道題都有改善。

最後一類通常稱為「資訊彙整」（aggregation），也是目前的弱點。它的平均改善很小，統計上還無法排除沒有改善的可能。關鍵資料放在全文約 30% 和 50% 的位置時，有正確資料的版本，平均預測反而更差。另一組 8K 計算測試也只通過六項中的三項，顯示計算上的問題不只出現在百萬長度。

練長文時，也要檢查原本的能力有沒有退步。我們用 6,955 筆樣本，測量 Barbet 對程式碼、英文、日韓文、數學、多語和中文的文字預測。六類分數都沒有比原始 Barbet 變差。這只說明受測的文字預測能力保留下來，不能推論所有應用、事實正確性或安全性都沒有退步。

本文稱為「穩定 1M」的，是上述受測範圍：Barbet 能完成百萬長度的運算、在六類測試中使用遠處資料，並保留這組評測涵蓋的基礎能力。這不是對任意長文件的保證。可靠地自行作答、彙整多筆資訊，以及完整理解百萬長度文件，都還沒有證明；本次結果也不包含 2M，或整體能力追上大型模型的主張。

接下來需要補強的，是找到資料之後的合併、更新與計算。單看輸入有多長、訓練用了多少 tokens，還看不出這些能力是否進步。最終仍要讓 Barbet 自己接著寫，檢查它能不能產生正確的答案。

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

Barbet has been pretrained on texts a million tokens long. In six of seven long-context task families, information far back in the text helped it predict the correct answer. For tasks that require combining several records to calculate a result, a benefit from distant information remains unproven. These results do not guarantee that Barbet can answer questions about arbitrary long documents correctly on its own.

</div>

Barbet is a base language model with approximately 1.1 billion parameters. It learns to predict the next part of a text from what came before; it has not been trained as a chat assistant. That preceding text is its “context.”

Here, 1M means exactly 1,048,576 tokens. A token is a unit of text used by the model, not necessarily a word or character. This is the length of one input, not the total amount of data processed during training. The results below describe the August 2026 Barbet release, excluding later experiments.

## From a longer setting to training on 1M-token texts

The [June introduction to Barbet]({% post_url 2026-06-21-barbet-1b-base %}) described training up to 256K. Trying 1M at that point required changing how the model represents positions in a text, known as its position encoding. The setting allowed experiments with longer inputs, but did not establish that the model could use information throughout them.

The August release has been trained on full 1M-token texts. The model predicts the next token from the preceding text, and the training program uses its prediction error to adjust its internal parameters, or “weights.” Million-token texts have therefore contributed to learning, rather than appearing only at test time. The release configuration also no longer uses the earlier linear position scaling.

We also changed how Barbet reads the preceding text. Some layers could originally refer directly only to the nearest 8K tokens. They were progressively converted to “global attention” layers, which can refer to the full preceding text, and one more such layer was added. The original seven Mamba2 layers were retained. The appendix gives the full architecture.

This lets more layers read distant information directly, at a higher computational cost. Training continued from the existing Barbet throughout; we did not substitute another model. Architecture, data, and training volume all changed, however. This record documents what we did, but cannot establish which change contributed most.

## Why return to 8K after training at 1M?

Training first progressed through 64K, 128K, 256K, 512K, and then 1M. The data included exercises in finding information, ordering events, tracking changing values, and following linked relationships. Important information appeared at different positions, so practice was not limited to searching the beginning or end.

Tests showed that Barbet could sometimes find a distant number without reliably using it in a calculation. A simple inventory record illustrates the difference. This is an example for explanation, not an actual evaluation item:

> Warehouse A held 3 boxes. It later received 2 more.

To answer how many boxes arrived, the model only needs to find “2.” To work out the current stock, it must combine both records and calculate “5.” If the records are far apart, it also has to use the earlier information when calculating. A wrong answer could mean it failed to find the information, or found it but could not do the calculation.

Later training therefore also used shorter texts, from 512 to 8K. These exercises separately addressed calculating with nearby information, finding the original text farther away, and calculating with what had been found. Full 1M training was interleaved with this work. The shorter exercises addressed basic operations; they did not reduce the model's maximum context to 8K.

The final stage used 8K texts for 768 weight updates, processing about 100 million tokens. After training, we loaded the saved model again and tested it at the full 1M length.

The continued-training runs leading from the original Barbet to this release processed approximately 5.52 billion tokens, including 3.93 billion in texts exactly 1M tokens long. These are cumulative processed tokens, potentially including repeated data. They exclude Barbet's original pretraining.

All of this was pretraining. Even when the text contains calculation exercises, the model is learning to predict the whole text. Training counts prediction errors at every token, not just the final answer. This release did not use instruction tuning, dialogue training, or human-preference training, and it has no external-memory module.

## How do we know Barbet used the distant information?

The evaluation follows the base model's task: give it preceding text and examine its predictions for what follows. This tests whether the long context helps, without mixing in familiarity with a chat format.

Each item has two texts of equal length and similar structure. One retains the correct information; the other removes or corrupts it. We compare the probability assigned to the correct answer in each case. This is a “paired test”: the comparison is between the same Barbet reading two versions of the text, not between two models.

Using the inventory illustration, do the correct records make Barbet more likely to predict “5 boxes”? If correct information raises the probability of the correct answer, that supports its use in the prediction, beyond simply completing a million-token computation.

There is an important limit. The scoring program already knows the correct answer. It follows that answer token by token, supplying its correct preceding tokens and calculating the next token's probability. It does not let the model write the entire answer on its own. Even if “5 boxes” becomes more likely, a wrong answer could still be more likely. The test tells us whether the information helps prediction, not how many questions the model would answer correctly by itself.

## What can Barbet do so far?

After reloading, Barbet completed scoring for all 140 examples, each exactly 1M tokens long, without running out of memory or producing invalid scores. The seven task families each had 20 matched examples.

“Helpful” below means that, on average within that family, correct information made the correct answer more likely. We also estimated the uncertainty from sampling different examples. Six families still supported a positive effect after accounting for that uncertainty. The appendix gives the exact results and statistical method.

| Test | Did the correct distant information help? |
| --- | --- |
| Find a specified value | Helpful |
| Look up a code without clues from its meaning | Helpful |
| Retrieve several values | Helpful |
| Determine the order of events | Helpful |
| Track a value through updates | Helpful |
| Follow three linked relationships | Helpful |
| Combine several records to work out a result | Not proven |

Six passing families does not mean 60% or six-sevenths of the questions were answered correctly. It describes an average probability change within six task families, not improvement on every item or at every position.

The last family, usually called “aggregation,” remains a weakness. Its mean improvement was small, and the statistical interval could not rule out no improvement. With the key information around 30% and 50% of the way through the context, predictions were worse on average when the correct information was present. A separate 8K computation diagnostic passed only three of six tests, showing that calculation problems are not limited to million-token inputs.

Long-context training also needs a check on earlier abilities. We used 6,955 examples to measure Barbet's text predictions for code, English, Japanese and Korean, math, multilingual text, and Chinese. None of the six scores worsened relative to the original Barbet. This supports retention of the tested text-prediction abilities, not a guarantee about every application, factual accuracy, or safety behavior.

“Stable 1M” refers to that tested scope: Barbet completes million-token computation, uses distant information in six task families, and retains the base abilities measured by this suite. It is not a guarantee about arbitrary long documents. Reliable answers generated on its own, aggregation, and complete understanding of million-token documents remain unproven. These results also make no claim about 2M or overall parity with larger models.

The remaining work is to combine, update, and calculate with information after finding it. Input length and total training tokens cannot tell us whether those operations have improved. Barbet will need to produce its own continuations so we can check whether the answers are correct.

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
