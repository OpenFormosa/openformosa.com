---
layout: post
title: "How we trained Barbet for a 1M-token context"
zh_title: "Barbet 怎麼練到 1M"
i18n_key: barbet_1m
description: "Longer training texts, short calculation exercises, and tests with key information removed: how we checked whether Barbet uses information from far back in its context."
zh_description: "把訓練文字拉長、補練查找與計算，再拿掉關鍵資料做對照，檢查 Barbet 是否用到了遠處的資訊。"
date: 2026-08-30
last_modified_at: 2026-09-09
category: research
tags: [pretrain, model, long-context, barbet]
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

我們把 Barbet 的訓練文字逐步拉長，直到每段都有 1M tokens，再穿插短文練習，補練查找與計算。重新載入模型測試後，七類長文任務中有六類顯示：保留遠處的正確資料，會提高模型預測正確答案的機率。把多筆資料合起來計算仍未通過；這些結果也不代表模型自行作答的正確率。

</div>

Barbet 是約 11 億參數的基底語言模型（base model）。它的練習方式是讀一段文字，預測接下來會出現什麼，再用預測誤差調整模型內部的參數。它還沒有經過聊天助理的訓練；本文也用文字預測來評估它。

模型預測時能參考的前文，稱為「上下文」。本文的 1M 是一段輸入的長度：1,048,576 tokens。Token 是模型切分文字的單位，不固定等於一個字。一次能讀多長，和訓練累計讀過多少資料，是兩個不同的數字。

本文記錄的是 2026 年 8 月發布的 Barbet，不包含後續實驗。

## 從 256K 接著訓練到 1M

[6 月的文章]({% post_url 2026-06-21-barbet-1b-base %})記錄的是訓練長度到 256K 的 Barbet。當時提供的 1M 研究設定，只調整模型表示文字位置的方式，讓程式可以嘗試更長的輸入。它還沒有真正用 1M 長的文字訓練過。

接續訓練仍使用同一個 Barbet，從較短的 64K 開始，再逐步增加到 128K、256K、512K 和 1M。到了 1M 階段，每段訓練文字都有完整的 1,048,576 tokens。模型逐一預測下一個 token，再根據整段文字的預測誤差更新參數。

我們也調整了模型內部的注意力層，也就是讓模型從前文取用資訊的部分。原本有些層只能直接讀取附近的 8K tokens，後來逐步改成能讀取完整前文，最後再加上一層。這讓更多層能直接取得遠處資料，但也增加了運算成本。完整架構與位置設定放在附錄。

資料裡有查找資訊、排列事件先後、追蹤數值變化，以及沿著幾段關係找出結果的練習。關鍵紀錄安排在不同位置，避免練習都集中在開頭或結尾。

這些練習仍然用預訓練的方式學習：整段文字都計算預測誤差，不只計算最後答案的誤差。這次沒有做指令微調、對話或人類偏好訓練，也沒有接上外部記憶模組。

## 找到資料，還要會用資料

假設一份庫存紀錄寫著：

> 甲倉庫原本有 3 箱貨。
>
> 後來，甲倉庫又收到 2 箱。

這只是說明用的例子，不是實際考題。如果接下來要寫「後來收到的箱數是……」，模型只要找到 2。若要寫「甲倉庫現在共有……」，它就得把兩筆紀錄合起來，算出 5。

當兩筆紀錄隔了很長一段文字，答錯可能有兩個原因：沒找到需要的數字，或找到了卻不會計算。要分清楚，就得分開測「找回數字」和「用數字計算」。

我們因此穿插 512 至 8K 的短文練習。有些把紀錄放得很近，練習計算；有些把紀錄隔開，練習找回原本的數值，再用它們計算。這是讓模型練習這些動作，是否學會仍要另外測試。期間仍有完整的 1M 訓練，模型的最大上下文也沒有改回 8K。

最後一段使用 8K 文字，完成 768 次參數更新，處理約 1 億 tokens。接著，我們重新載入存好的模型，再測一次完整 1M。最後一段練習較短，不代表可以省下長文測試。

從原始 Barbet 接續到本次發布，累計處理約 55.2 億 tokens，其中約 39.3 億來自每段恰好 1M 長的訓練文字。這是實際處理量，可能包含重複資料；Barbet 最初的預訓練量不在其中。各長度用量與訓練參數列在附錄。

## 怎麼確認模型用到了前面的資料？

程式能把 1M 長的輸入算完，只證明這個長度跑得動。要檢查其中的資料是否有用，我們讓同一個 Barbet 讀兩個版本：一份保留正確的關鍵紀錄，另一份拿掉或改壞那些紀錄。兩份文字的長度相同，結構也相近。

沿用庫存例子，我們比較的是：有 3 箱和 2 箱這兩筆紀錄時，模型給「5 箱」的機率，是否比紀錄缺失時更高。這是一題兩個版本的配對測試，直接檢查基底模型的文字預測，不要求它先學會聊天或回答指令。

但測試時，評分程式已經知道「5 箱」是答案。答案若包含多個 tokens，程式還會依序提供正確的前幾個，再計算下一個的機率。模型並沒有自行寫完整個答案。

所以，即使「5 箱」的機率提高，模型仍可能更想寫出別的答案。這項測試能回答「正確資料有沒有幫助」，無法回答「模型自己寫，會有幾題答對」。

## 結果：六類任務受益，合併計算仍未通過

重新載入 Barbet 後，七類任務、每類 20 組配對樣本，都完成了恰好 1M 長度的評分，沒有記憶體不足或無效分數。

我們先算出每題保留資料前後的評分差，再看每一類的平均差異。六類的平均差異都支持「正確資料有幫助」，而且在估計樣本造成的不確定性後，仍支持這個方向。每類只有 20 組，不能保證每一道題、每一個位置都會改善；完整分數與統計方法放在附錄。

| 模型要做的事 | 正確資料對預測有沒有幫助？ |
| --- | --- |
| 找出指定的一筆資訊 | 有幫助 |
| 查找沒有語意線索的編號 | 有幫助 |
| 一次查找多筆資料 | 有幫助 |
| 判斷事件發生的先後順序 | 有幫助 |
| 找出數值經過更新後的結果 | 有幫助 |
| 接連查三段關係，找出最後的結果 | 有幫助 |
| 把多筆資料合起來求出結果 | 仍未證明 |

「六類有幫助」不能換算成七分之六的答對率。合併計算這一類的平均改善很小，尚無法排除沒有改善的可能。這類題目的資料放在全文約 30% 和 50% 處時，保留正確資料，平均評分反而更差。

另一組 8K 測試把「照抄查到的值」與「算出結果」分開，也只通過六項中的三項。例如，模型通過了遠處數值的複製測試，卻沒有通過用那些數值合併計算的測試。文字較短時，部分計算也還沒通過，不能把所有失敗都歸因於距離太長。

至於原有的文字預測能力，我們用 6,955 筆樣本檢查，涵蓋程式碼、英文、日韓文、數學、多語和中文。六類分數都沒有比接續訓練前的 Barbet 變差。這個結果只適用於受測文字，不能延伸成所有應用、事實正確性或安全性的保證。

## 這次的「穩定 1M」代表什麼？

本專案把這次發布稱為「穩定 1M」，指的是完整 1M 長度能完成運算、六類任務顯示遠處資料有用，而且受測的基礎文字預測能力沒有退步。這是本專案的發布標準，不是對任意長文理解的保證。

這次訓練走過的路徑是：讓 Barbet 用完整長文學習，再穿插短文補練查找與計算，最後重新載入模型測試。不過，過程中架構、資料和訓練量都曾改變，沒有把各項改動分開比較。因此，這份紀錄不能告訴我們哪一項貢獻最大，也不能保證照著做就會得到相同結果。

目前還不能據此宣稱 Barbet 能自行可靠地回答任意 1M 長文的問題，更沒有證明 2M 或整體能力追上大型模型。要補上計算能力的證據，下一步得讓它根據紀錄，自行接著寫出合計或更新後的數值，再逐題檢查答案。

## 技術附錄

以下各節可展開查閱訓練設定和完整分數。需要確認模型檔案時，可用最後一節的固定版本連結與檔案雜湊核對。

<details markdown="1">
<summary>模型架構與載入設定</summary>

接續訓練前，我們先把 Hugging Face 的模型權重轉成 Megatron 使用的格式，再檢查轉換前後的輸出。模型會對每個可能的下一個 token 給一個分數，稱為 logits。在 4K 與 8K 選定位置，兩者的原始 FP32 分數逐位元一致，也就是連電腦儲存的位元都相同。這支持格式轉換保留了受測輸出，並不等於測遍所有輸入。

以下以 G 表示全域注意力、S 表示 8K 滑動視窗注意力、M 表示 Mamba2。架構依序改為：

```text
[G,S,S,M]×7 → [G,G,S,M]×7 → [G,G,G,M]×7 → [G,G,G,M]×7+G
```

最後新增的全域層，起初只把收到的輸入原樣傳下去，稱為「恆等映射」，之後才接受訓練。加入這一層本身沒有權重更新，也不計入訓練量。架構、資料與訓練量在過程中都有變動，不能只憑最終結果，單獨判定某次架構改動讓模型進步了多少。

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

平行配置表示怎麼把工作分給 GPU：TP2 將模型的張量運算分成兩份，CP4 將同一段長文分成四份，DP1 表示只有一組模型副本。這個配置共使用八張 GPU。

最後一段的資料分成四部分：

- 25% 再次使用既有訓練資料，稱為 replay。
- 50% 從較遠的紀錄找出數字並計算，數字的寫法有固定格式要求。
- 12.5% 使用修正取樣方式後的近距離練習資料，原實驗稱為「局部取樣修正」。
- 12.5% 在 8K 文字中，找出遠處的資料並原樣複製。

學習目標是因果語言模型交叉熵（causal language-model cross-entropy）：每一步只根據前文預測下一個 token，整段文字的預測誤差都用來訓練。沒有只計答案的誤差，也沒有教師模型分數、蒸餾、監督式微調（SFT）或人類回饋強化學習（RLHF）。768 次更新全數完成，沒有跳過更新、無效數值（NaN）、記憶體不足或致命錯誤。

</details>

<details markdown="1">
<summary>1M 評測方法、統計數字與判定標準</summary>

每題準備兩份同樣長、寫法相近的文字：一份保留正確的關鍵紀錄，另一份移除或改壞那些紀錄。其他條件盡量保持一致，才能比較關鍵紀錄對預測的影響。

評分時，只計算正確答案那一段的預測分數。如果答案有多個 tokens，每一步都先提供答案中前面那些正確的 tokens，再問模型下一個的機率。這個做法稱為 teacher forcing；它和讓模型從頭到尾自己接著寫不同。

我們用負對數似然（negative log-likelihood，NLL）把機率轉成分數。分數越低，表示模型越傾向這個答案；兩份文字的分數差就是下表的「效果」：

```text
遠距證據效果 = 移除證據後的目標 NLL − 保留證據時的目標 NLL
```

差值為正，表示保留正確紀錄有幫助；為負，則表示保留紀錄後的預測反而更差。每類有 20 組配對樣本。我們把整組配對資料當成抽樣單位，允許重複抽取，重做 2,000 次，估計平均效果的 95% 信賴區間；這個方法稱為成對 bootstrap。表中的 nats 是以自然對數計算的單位，不是百分比，也不是答對率。

| 任務 | 平均效果，nats／目標 token | 95% 信賴區間 | 判定 |
| --- | ---: | ---: | --- |
| 指定資訊查找（Exact NIAH） | +0.868817 | [+0.411734, +1.359182] | 通過 |
| 無語意編號查找（Opaque NIAH） | +1.451789 | [+0.751489, +2.303071] | 通過 |
| 多筆資料查找（Multi-key） | +1.041410 | [+0.494490, +1.671721] | 通過 |
| 事件排序（Ordering） | +1.160107 | [+0.710641, +1.667173] | 通過 |
| 變數追蹤（Variable tracking） | +0.249664 | [+0.075717, +0.456798] | 通過 |
| 三段關係串接（Three-hop chain） | +1.338904 | [+0.665179, +2.092832] | 通過 |
| 資訊彙整（Aggregation） | +0.028431 | [−0.019926, +0.080348] | 未證明 |

評測分成八份執行，140／140 筆都得到有限分數。最終訓練前已固定發布條件：所有 1M 樣本完成有效評分、至少五類任務的信賴區間下界大於零，以及六類基礎能力指標各自不超過 2% 的相對退步。結果為六類任務通過。這是本專案的發布標準，並非適用於所有模型的 1M 能力認證。

上述區間描述這批受測配對樣本的平均效果，不能視為所有題型、所有位置或不同訓練種子的保證。資訊彙整在 30% 與 50% 位置的平均效果仍為負；自由生成、所有位置皆有效和七類全數通過，都不是本次已證明的結果。

另一組嚴格的 8K 測試分別檢查「多筆資料合併計算」和「數值更新」；每種各測三件事：紀錄靠近時能不能計算、紀錄隔開時能不能計算，以及能不能把遠處的數值原樣複製。

六項中通過三項：兩種任務的遠距複製，以及數值更新的近距離計算。未通過三項：多筆資料合併的近距離計算、遠距離計算，以及數值更新的遠距離計算。複製測試用來檢查取值，不能代替計算測試。

</details>

<details markdown="1">
<summary>基礎能力保留結果與模型來源</summary>

我們用 6,955 筆樣本、3,000,079 個模型 tokens，檢查接續訓練後是否忘掉原本的文字預測能力。比較對象是接續訓練前、已核對格式轉換的原始 Barbet。

指標稱為 bits per byte（BPB）：把文字預測誤差換算成位元，再除以原文的 UTF-8 位元組數，讓分數以原文長度為單位。BPB 越低，表示模型越能預測這批文字；它不是知識問答的答對率。

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

We progressively lengthened Barbet's training texts to 1M tokens and interleaved shorter exercises in retrieval and calculation. After reloading the model, six of seven long-context task families showed a benefit from retaining the correct distant information: it increased the probability assigned to the right answer. Combining records to calculate a result did not pass. These results do not measure the accuracy of answers generated by the model itself.

</div>

Barbet is a base language model with approximately 1.1 billion parameters. It learns by reading text, predicting what comes next, and adjusting its internal parameters using prediction errors. It has not been trained as a chat assistant; this report evaluates its text predictions.

The preceding text available for a prediction is the model's “context.” In this article, 1M means an input length of 1,048,576 tokens. A token is a unit into which the model divides text, not necessarily a word or character. The length of one input and the total amount of training data processed are different quantities.

This report covers the August 2026 Barbet release and excludes later experiments.

## Continuing from 256K to 1M

The [June article]({% post_url 2026-06-21-barbet-1b-base %}) described Barbet trained at lengths up to 256K. Its experimental 1M configuration changed how the model represents text positions, allowing the program to attempt longer inputs. Barbet had not yet been trained on 1M-token sequences.

We continued training the same Barbet, starting at the shorter length of 64K and increasing to 128K, 256K, 512K, and 1M. At the 1M stage, each training sequence contained the full 1,048,576 tokens. The model predicted each next token, and prediction errors across the sequence updated its parameters.

We also changed its attention layers, which let the model draw on earlier text. Some layers could originally read directly only from the nearest 8K tokens. We progressively converted them to read the full preceding text, then added one more such layer. More layers could access distant information directly, at a higher computational cost. The appendix gives the full architecture and position settings.

The data included exercises in finding information, ordering events, tracking changing values, and following linked relationships. Key records appeared at different positions, so practice was not concentrated only at the beginning or end.

These exercises still used pretraining: prediction errors were counted across the whole text, not only the final answer. This release did not use instruction tuning, dialogue or human-preference training, or an external-memory module.

## Finding information and using it are separate tasks

Consider an inventory record:

> Warehouse A held 3 boxes.
>
> Later, Warehouse A received 2 more boxes.

This is an illustration, not an actual test item. To continue “The number of boxes received was…”, the model only needs to find 2. To continue “Warehouse A now holds…”, it needs to combine the records and calculate 5.

When a long stretch of text separates the records, an error could mean the model failed to find the numbers or found them but could not calculate with them. Distinguishing those problems requires separate tests of retrieval and calculation.

We therefore interleaved shorter exercises, from 512 to 8K tokens. Some placed records nearby for calculation practice. Others separated the records for practice in retrieving the original values and calculating with them. Providing that practice did not establish that the model had learned the tasks; separate tests were still needed. Full 1M training remained part of this work, and the model's maximum context was not reduced to 8K.

The final stage used 8K texts for 768 parameter updates, processing about 100 million tokens. We then reloaded the saved model and tested it again at the full 1M length. Ending with shorter exercises did not remove the need for a long-context test.

Continued training from the original Barbet to this release processed approximately 5.52 billion tokens, including 3.93 billion in sequences exactly 1M tokens long. These are processed-token counts and may include repeated data; they exclude Barbet's original pretraining. The appendix lists totals by sequence length and the training settings.

## How do we check whether earlier information helped?

Completing a computation on a 1M-token input establishes that the length runs. To check whether its information helps, we give the same Barbet two versions: one retains the correct key records; the other removes or corrupts them. The two texts have the same length and similar structure.

Using the inventory illustration, we ask whether the records of 3 boxes and 2 arrivals make “5 boxes” more likely than when those records are missing. This paired test directly checks a base model's text predictions, without requiring prior training in conversation or instruction following.

However, the scoring program already knows that “5 boxes” is the answer. If the answer contains several tokens, the program supplies the correct preceding tokens before scoring each next one. The model does not generate the entire answer on its own.

Even if “5 boxes” becomes more likely, the model could still prefer a different answer. The test tells us whether the correct information helps, not how often the model would generate the correct answer.

## Results: six families benefit; combining records does not pass

After reloading, Barbet completed scoring at exactly 1M tokens for all seven task families, with 20 matched examples per family. It did not run out of memory or produce invalid scores.

We first calculate each question's score difference with and without the key information, then average those differences within each family. Six families showed a benefit from the correct information, including after accounting for sample uncertainty. With only 20 pairs per family, this does not guarantee improvement on every question or at every position. Full scores and statistical methods are in the appendix.

| What the model needs to do | Did the correct information help prediction? |
| --- | --- |
| Find a specified value | Helpful |
| Look up a code that has no meaning-based clues | Helpful |
| Retrieve several values | Helpful |
| Determine the order of events | Helpful |
| Track a value through updates | Helpful |
| Follow three linked relationships | Helpful |
| Combine several records to work out a result | Not proven |

Helpful information in six families cannot be converted into an accuracy of six-sevenths. Combining records to calculate a result showed only a small mean improvement, which could not rule out no improvement. In that family, when key information appeared around 30% and 50% of the way through the text, retaining it made the mean score worse.

A separate 8K test distinguished copying a retrieved value from calculating a result and passed only three of six checks. For example, the model passed the test of copying distant values but not the test of combining them in a calculation. Some calculations also failed with shorter texts, so distance alone cannot explain every failure.

We checked existing text-prediction ability with 6,955 examples covering code, English, Japanese and Korean, math, multilingual text, and Chinese. None of the six scores worsened relative to Barbet before continued training. This result applies to the tested text, not every application, factual accuracy, or safety behavior.

## What does “stable 1M” mean in this report?

The project calls this release “stable 1M” because full 1M-token computation completes, distant information helps in six task families, and the tested base-language scores do not regress. This is the project's release standard, not a guarantee of understanding arbitrary long documents.

The training path used full long texts, interleaved shorter retrieval and calculation exercises, and evaluation after reloading. Architecture, data, and training volume all changed without separate comparisons isolating each factor. This record cannot establish which change contributed most or guarantee the same result from repeating the recipe.

These results do not establish reliable answer generation about arbitrary 1M-token texts, 2M capability, or overall parity with larger models. To establish calculation ability, the next test must let Barbet continue from the records, generate the combined total or updated value itself, and check each answer.

## Technical appendix

Expand the sections below for training settings and full scores. The fixed revision link and file hashes in the last section identify the specific model files.

<details markdown="1">
<summary>Model architecture and loading configuration</summary>

Before continued training, we converted the Hugging Face weights to Megatron's format and compared the model's outputs before and after conversion. The model assigns a score, called a logit, to each possible next token. At selected positions in 4K and 8K inputs, the raw FP32 scores were bitwise identical: even their stored bits matched. This supports preservation of the tested outputs, not exhaustive equivalence over all inputs.

G denotes global attention, S an 8K sliding-attention layer, and M Mamba2. The architecture changed in this order:

```text
[G,S,S,M]×7 → [G,G,S,M]×7 → [G,G,G,M]×7 → [G,G,G,M]×7+G
```

The final added layer initially passed its input through unchanged, an initialization called an identity mapping, before receiving further training. Its insertion involved no weight updates and is excluded from the token count. Architecture, data, and training volume all changed during the project, so the final result alone cannot isolate the gain caused by any one architectural change.

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

The parallel configuration describes how work is divided across GPUs: TP2 splits the model's tensor operations in two, CP4 splits each long sequence in four, and DP1 means one model replica. This configuration uses eight GPUs in total.

The final-stage data mixture had four parts:

- 25% reused existing training data, known as replay.
- 50% practiced retrieving distant numbers and calculating with them, with fixed requirements for how the numbers were written.
- 12.5% used nearby-record exercises after repairs to the sampling method, called “local sampler repair” in the experiment.
- 12.5% practiced finding distant information in 8K texts and copying it exactly.

The objective was causal language-model cross-entropy: predict each next token from the preceding text and train on prediction errors across the whole sequence. There was no answer-only loss, teacher-model scoring, distillation, supervised fine-tuning (SFT), or reinforcement learning from human feedback (RLHF). All 768 updates completed without skipped updates, invalid numeric values (NaN), out-of-memory events, or fatal errors.

</details>

<details markdown="1">
<summary>1M evaluation method, statistics, and release criteria</summary>

Each question has two texts of the same length and similar wording: one retains the correct key records, and the other removes or corrupts them. Other conditions are kept as similar as possible to compare the effect of those records.

Only the correct answer is scored. If it contains several tokens, each step supplies the preceding correct answer tokens before asking for the probability of the next one. This is called teacher forcing; it differs from having the model generate the answer from beginning to end.

Negative log-likelihood (NLL) converts those probabilities into a score. Lower scores mean the model assigns higher probability to the answer. The difference between the two scores gives the “effect” in the table:

```text
Distant-evidence effect = target NLL without evidence − target NLL with evidence
```

A positive difference means retaining the correct records helped; a negative difference means it made the prediction worse. Each family contains 20 matched examples. We resample whole pairs with replacement 2,000 times to estimate a 95% confidence interval (CI) for the mean effect, a method called paired bootstrap. Effects are in nats per target token: units based on natural logarithms, not percentages or answer accuracy.

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

The separate strict-8K diagnostic tested both combining records and updating values. For each, it checked three things: calculation with nearby records, calculation with separated records, and exact copying of distant values.

Three of six checks passed: distant copying for both tasks, and nearby-record calculation for value updates. Three failed: nearby and distant calculation for combining records, and distant calculation for value updates. Copying checks whether the model can retrieve a value; it cannot substitute for a calculation test.

</details>

<details markdown="1">
<summary>Base-capability retention and model sources</summary>

We used 6,955 examples and 3,000,079 model tokens to check whether continued training weakened existing text-prediction ability. The comparison uses the original Barbet after its verified format conversion and before continued training.

The metric is bits per byte (BPB): text-prediction error expressed in bits and divided by the original text's UTF-8 byte count. This normalizes the score by text length. Lower BPB means better prediction of this text; it is not knowledge-question accuracy.

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
