---
layout: post
title: "How Barbet 1B Base reached a native, evidence-backed 1M context"
zh_title: "Barbet 1B Base 的原生 1M：從位置外推到可驗證的遠距資訊使用"
i18n_key: barbet_1m
description: "How the same 1.1B-parameter Barbet lineage moved from a 256K-native, 1M-extrapolated release to native exact-1M continued pretraining, with positive distant-evidence effects in six of seven long-context task families."
zh_description: "同一條 1.1B Barbet 訓練沿革如何從「256K 原生、1M 外推」走到 exact-1M 持續預訓練，並在七類長上下文任務中的六類驗出正向遠距證據效果。"
date: 2026-08-30
category: research
tags: [pretrain, model, long-context, barbet]
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

**摘要**　2026 年 6 月發布的 Barbet 1B Base 原生訓練長度是 262,144 tokens；當時的 1M 只是一份線性 RoPE 外推設定。現在的 `final-global-barbet-iter7008-stable-1m-v11` 已在 exact 1,048,576-token sequences 上完成持續預訓練，正式設定不再使用 RoPE scaling。重新載入 checkpoint 後，140/140 筆 exact-1M 樣本皆得到有限分數，七類長上下文任務有六類呈現統計上可分辨的遠距證據效果，六類基底模型 BPB retention 也全部通過。這項結果支持一個範圍明確的 stable 1M 判定；aggregation、任意長文件理解與可靠自由生成仍未獲得證明。

</div>

2026 年 6 月的[原始介紹]({% post_url 2026-06-21-barbet-1b-base %})把「256K 原生訓練」和「1M RoPE 外推」分開陳述。那是當時權重的正確描述。兩個月後，模型的權重、架構與驗證證據都已改變，因此 1M 現在有了更窄、也更扎實的含義。

這裡的 **1M 指單一序列可含 1,048,576 tokens，是上下文長度**。它不是某一階段的訓練 token 預算。本文中的 `3,925,868,544 exact-1M physical training tokens`，則是所有 1M 長序列在訓練中累計處理的 token 數，兩者不可混用。

| 版本 | 2026 年 6 月 R2 | 2026 年 8 月 stable 1M |
| --- | --- | --- |
| 原生訓練長度 | 262,144 | 1,048,576 |
| 1M 位置設定 | 線性 RoPE scaling，factor 4 | `rope_scaling=null` |
| 長距混合器 | `[G,S,S,M]×7` | `[G,G,G,M]×7+G` |
| 1M 證據 | 推論外推研究設定 | exact-1M 訓練、reload 與 frozen evaluation |
| 可發布的能力敘述 | 可執行 1M 外推研究 | 6/7 類遠距證據使用效果；aggregation 未證明 |

## 一個可檢驗的 1M 定義

把 `max_position_embeddings` 寫成 1,048,576，只能讓程式接受更長的位置索引。它無法回答模型是否曾在這個長度更新權重，也無法確認第 900K token 附近的內容會影響後續預測。

這次發布把 stable 1M 拆成三個可各自失敗的條件：

1. **物理執行**：fresh-loaded checkpoint 能完成 exact 1,048,576-token forward 與評分，沒有 OOM、NaN 或 non-finite target NLL。
2. **遠距資訊使用**：保留正確證據的長上下文，應比移除證據但長度與表面結構匹配的上下文，更能提高正確 continuation 的 likelihood。
3. **原始能力保留**：長上下文持續預訓練後，中文、多語、英文、數學與程式碼等基底語言模型能力不能明顯退化。

第一項檢查執行路徑，第二項檢查能力，第三項檢查代價。三項都通過後，我們才使用 stable 1M 這個名稱。

## 起點仍是 Barbet

訓練主線從 native Role-B checkpoint 開始，層排列為：

```text
[G, S, S, M] × 7
```

`G` 是全域注意力，`S` 是 8K 滑動視窗注意力，`M` 是 Mamba2。原始 Hugging Face checkpoint 轉換成 native Megatron Role-B 後，4K 與 8K 的 selected raw-FP32 logits 都已驗證 exact。這項檢查先固定了起點：後續量到的變化來自持續預訓練與架構演進，不是格式轉換造成的漂移。

實驗曾探索 KDA，但 pure-KDA 的原始能力 retention 不足，沒有進入發布 lineage。最終 checkpoint 也不含 QSA、外部記憶 controller 或其他 test-time memory module。PangolinTokenizer、1,536 hidden size、七個 Mamba2 blocks、tied embedding／LM head，以及 all-token causal language-model objective 都沿用自 Barbet。

## 讓遠距 token 有更短的交互路徑

原始架構每四層只有一層全域注意力。在 1M 長度下，中間的滑動視窗層會拉長遠距 token 互相影響的路徑。訓練期間，我們依序把兩個 sliding slots 轉為 global，最後再加入一個先以 identity 物化的全域層：

```text
[G,S,S,M]×7
  → [G,G,S,M]×7
  → [G,G,G,M]×7
  → [G,G,G,M]×7+G
```

最後一次插層本身沒有消耗訓練 token；新增路徑之後才接受 acquisition 與 exact-1M training。物化程序曾重設 iteration counter，所以 checkpoint 名稱中的 `iter7008` 不是整條 ancestry 的更新總數。從 Role-B 起算，獲選的發布沿革有 42 個 accepted optimizer stages、11,715 次更新。

| 最終模型項目 | 值 |
| --- | ---: |
| Stored parameters（不重複計算 tied LM head） | 1,118,799,096 |
| Logical layers | 29 |
| Global Attention / Mamba2 layers | 22 / 7 |
| Hidden / FFN size | 1,536 / 5,120 |
| Attention heads / KV heads | 16 / 2 |
| Vocabulary size | 114,944 |
| Native context | 1,048,576 |

架構確實有演進，但沒有換成另一個預訓練模型。改變集中在遠距 token mixing 的容量。

## 訓練不是一路把序列拉長

Role-B 之後的發布訓練帳本共記錄 5,516,558,336 個 physical training tokens。當中有 22 個 stages、3,744 次更新直接使用 exact 1,048,576-token sequences，合計 3,925,868,544 tokens。

| Physical sequence length | Audited physical tokens |
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
| exact 1M | **3,925,868,544** |
| **合計** | **5,516,558,336** |

這個 ledger 只計入 selected ancestry 中真正完成 optimizer update 的 stages。Pre-forward 失敗、評測、匯出、reload、identity materialization，以及未被選入發布 lineage 的分支均不列入。

歷史 R2 repository 另外記錄過約 150B tokens 的三階段 recipe budget，涵蓋 8K general pretraining、繁中 midtraining，以及 32K 到 256K 的延伸。因為歷史資料沒有把各階段完成量和發布 Role-B checkpoint 綁成一份完整 receipt，本文只稱它為「文件記載的 recipe budget」，不把 150B 寫成 checkpoint-bound consumed total。

### 先建立長度，再處理失敗型態

Selected parent 依序完成 64K、128K、256K、512K 與第一段 exact-1M training。這段訓練確認硬體與分散式執行路徑可工作，也讓 retrieval、variable binding、ordering、multi-key、短鏈組合與不同 evidence depth 逐步進入資料。

但診斷很快顯示一個更細的問題：模型有時能從遠處複製值，卻無法穩定地用同一份值完成 aggregation 或 state update。此時只增加 1M 樣本，會把三種原因混在一起：模型可能找不到證據、尚未學會局部 operator，或無法把已學會的 operator 綁到遠距證據。

因此後續階段回到 512、1K、2K、4K 與 8K，分別檢查 local computation、literal remote copy、remote binding，再回到 exact 1M closeout。這些較短的階段是能力隔離與修補，不是把最大上下文降回 8K。

最後的 consolidation 從 immutable iter6240 訓練至 iter7008：

| 設定 | 值 |
| --- | ---: |
| Sequence length | 8,192 |
| Optimizer updates | 768 |
| Physical tokens | 100,663,296 |
| Global batch / tokens per update | 16 / 131,072 |
| Parallel layout | TP2 × CP4 × DP1 |
| Precision | BF16 |
| Optimizer | AdamW，betas `(0.9, 0.95)`，epsilon `1e-8` |
| Weight decay / gradient clip | `0.1` / `1.0` |
| Learning rate | stage-local cosine，`1.2e-6 → 3e-7` |
| Warmup / seed | 16 updates / 17 |

資料由 25% replay、50% strict-digit remote compute binding、12.5% local sampler repair、12.5% literal remote 8K 組成。目標函數是一般 all-token causal next-token cross-entropy；沒有 answer-only loss、teacher logits、distillation、SFT 或 RLHF。768 次更新全部完成，沒有 skipped update、NaN、OOM 或 fatal error。

## 以基底模型的方式測量能力

Barbet 是 causal base model，沒有 chat template，也沒有接受指令微調。用對話式 exact match 當主要 gate，會同時測到提示格式、解碼策略與指令遵循，反而模糊了預訓練模型是否利用遠距資訊。

我們為每筆 exact-1M 樣本建立兩個長度與表面結構匹配的上下文：`coherent` 版本保留正確遠距證據，`ablated` 版本移除或破壞關鍵證據。接著以 teacher forcing（教師強制）計算正確 continuation 的 target-only negative log-likelihood：

```text
evidence benefit = ablated target NLL − coherent target NLL
```

正值表示正確證據提高了正確 continuation 的模型機率。每一類任務有 20 組配對樣本；以 2,000 次 paired bootstrap（成對重抽樣）估計平均效果的 95% 信賴區間。評測門檻在最終訓練前就已凍結：140 筆分數必須全部有限，七類任務至少五類的信賴區間下界大於零，六類 BPB retention 全部通過。

### Exact-1M 結果

重新載入 iter7008 後，八個 shards 共完成 140/140 筆評分。結果有六類通過：

| Exact-1M task | Mean nats / target token | 95% CI | 判定 |
| --- | ---: | ---: | ---: |
| Exact NIAH | +0.868817 | [+0.411734, +1.359182] | PASS |
| Opaque NIAH | +1.451789 | [+0.751489, +2.303071] | PASS |
| Multi-key | +1.041410 | [+0.494490, +1.671721] | PASS |
| Ordering | +1.160107 | [+0.710641, +1.667173] | PASS |
| Variable tracking | +0.249664 | [+0.075717, +0.456798] | PASS |
| Three-hop chain | +1.338904 | [+0.665179, +2.092832] | PASS |
| Aggregation | +0.028431 | [−0.019926, +0.080348] | **NOT PROVEN** |

Aggregation 的平均值略高於零，但信賴區間跨越零；證據放在 30% 與 50% depth 時，平均效果仍為負。這一列保留為未證明，不用整體 6/7 結果把它蓋掉。

### 基底模型能力保留

Retention suite 有 6,955 筆樣本、3,000,079 model tokens，以 bits per UTF-8 byte（BPB，越低越好）比較 iter7008 和 Role-B：

| Bucket | iter7008 BPB | Role-B BPB | Relative change |
| --- | ---: | ---: | ---: |
| Code | 0.686505 | 0.739298 | −7.14% |
| English | 0.845356 | 0.894396 | −5.48% |
| Japanese / Korean | 0.953428 | 0.964779 | −1.18% |
| Math | 0.664294 | 0.701121 | −5.25% |
| Multilingual | 1.110032 | 1.224230 | −9.33% |
| zh-TW / zh | 1.126968 | 1.137099 | −0.89% |

六類都沒有比 Role-B 變差。這項結果支持 frozen likelihood retention；它沒有涵蓋所有 downstream benchmark、事實正確性或安全行為。

## 為何不要求七類全部通過？

模型大小約 1.119B，這次發布要回答的是：它是否在多種任務上呈現可重現的 1M 遠距證據效果，而且沒有以原始語言建模能力交換這項結果。要求每個任務、每個位置、每種表面形式都成功，測量的會是 universal robustness，超出了這個 release claim。

5/7 門檻在最終訓練前凍結，沒有依結果事後調整。Exact-1M finite、task-level statistical effect 與 BPB retention 仍是硬條件；free-generation、7/7、每個 evidence depth 都為正，以及 strict-8K operator cells 6/6，則保留作研究診斷。後者最終為 3/6，也再次指出 operator transfer 仍不完整。

這種校準避免兩個極端：只看 runtime 就宣稱理解 1M，或要求十億參數的基底模型在所有長上下文問題上一次達到通用穩健性。失敗項仍逐項公開。

## 可以宣稱什麼，以及不能宣稱什麼

目前證據支持以下敘述：

> `final-global-barbet-iter7008-stable-1m-v11` 是一個約 1.119B parameters 的 causal base model。它具有原生 1,048,576-token runtime；在六類 frozen exact-1M likelihood tasks 上，正確遠距證據對正確 continuation 產生可重現的正向效果；六類基底模型 BPB retention 同時通過。

下列能力尚未由這次實驗證明：

- 完整理解任意一百萬 token 文件；
- 穩定 aggregation，或每個 evidence depth 都有效；
- teacher-forced likelihood 能直接轉換成可靠的自由生成；
- instruction following、對話品質、事實性或安全對齊；
- 原生 2M context；
- 與大型 frontier foundation model 相當的整體能力。

這些界線不降低六類已通過任務的結果；它們讓下一輪研究知道還缺哪一塊。

## Checkpoint 與可核對資訊

正式 checkpoint 為 `final-global-barbet-iter7008-stable-1m-v11`。Hugging Face repository 在本文發布時仍採權限控管：[`OpenFormosa/barbet-1b-base`](https://huggingface.co/OpenFormosa/barbet-1b-base)。公開程式碼與模型文件位於 [`OpenFormosa/Barbet`](https://github.com/OpenFormosa/Barbet)。

| Artifact | Identity |
| --- | --- |
| Hugging Face revision | `bd8de3ec404752d61da9df78ab2d1f59928f7f44` |
| Checkpoint tree SHA256 | `0380aee774af7f1e81c8e4b99d016171b07490999a117f66653d4c520b580cf6` |
| `model.safetensors` SHA256 | `05376dde654c9beb8154e1e997d0765ce4e236e51d4de99f38ad2e20fd730000` |
| `config.json` SHA256 | `968e293a32e225a993e9a0e503ed4f41f0d3c69e7d7b03c85078497935b48d91` |

正式設定為：

```json
{
  "max_position_embeddings": 1048576,
  "rope_theta": 10000000.0,
  "rope_scaling": null
}
```

GitHub repository 裡的 `configs/barbet_1b/` 與 `configs/barbet_1b_1m/` 是原始 R2 的 legacy presets，用來重現舊版研究設定；載入 iter7008 時，應以 Hugging Face 權重隨附的 `config.json` 為準。

Barbet 的 1M 路徑最後留下的結論很具體：長序列可執行只是起點。模型還要讓正確遠距證據改變正確 continuation 的機率，並在完成持續預訓練後保留原有的語言建模能力。Iter7008 在六類任務上完成了這條證據鏈；aggregation 是下一個仍需解決的問題。

</div>

<div class="post-lang-en" markdown="1">

<div class="post-abstract" markdown="1">

**Abstract**　The Barbet 1B Base release described in June 2026 was trained natively to 262,144 tokens; its 1M option was a linear RoPE extrapolation configuration. The current checkpoint, `final-global-barbet-iter7008-stable-1m-v11`, has instead undergone continued pretraining on exact 1,048,576-token sequences, and its release configuration no longer uses RoPE scaling. In a fresh-loaded evaluation, all 140 exact-1M examples received finite scores, six of seven long-context task families showed statistically distinguishable distant-evidence effects, and all six base-model BPB-retention buckets passed. These results support a scoped stable-1M claim. They do not establish reliable aggregation, arbitrary million-token document understanding, or dependable free generation.

</div>

The [original June article]({% post_url 2026-06-21-barbet-1b-base %}) carefully separated “256K native training” from “1M RoPE extrapolation.” That was the correct description of the weights at the time. Two months later, the weights, architecture, and evaluation evidence have changed, giving 1M a narrower but substantially stronger meaning.

Here, **1M means a context length of 1,048,576 tokens in one sequence**. It is not a training-token budget. The figure `3,925,868,544 exact-1M physical training tokens` refers to the cumulative number of tokens processed across 1M-length training sequences; the two quantities should not be conflated.

| Release | June 2026 R2 | August 2026 stable 1M |
| --- | --- | --- |
| Native training length | 262,144 | 1,048,576 |
| 1M position configuration | Linear RoPE scaling, factor 4 | `rope_scaling=null` |
| Long-range mixers | `[G,S,S,M]×7` | `[G,G,G,M]×7+G` |
| 1M evidence | Inference-time extrapolation setting | Exact-1M training, reload, and frozen evaluation |
| Supported capability statement | Can run the 1M extrapolation experiment | Distant-evidence effect in 6/7 task families; aggregation not proven |

## A falsifiable definition of 1M

Setting `max_position_embeddings` to 1,048,576 only makes the program accept a larger range of position indices. It does not show that the weights were updated at that length, or that evidence near token 900K will affect a later prediction.

For this release, stable 1M consists of three conditions that can fail independently:

1. **Physical execution:** a freshly loaded checkpoint completes exact 1,048,576-token forward scoring without OOM, NaN, or non-finite target NLL.
2. **Distant-evidence use:** a long context containing the correct evidence raises the likelihood of the correct continuation relative to a length- and surface-matched context in which that evidence is removed or corrupted.
3. **Base-capability retention:** continued long-context pretraining does not materially damage the original model's Chinese, multilingual, English, math, and code modeling ability.

The first tests runtime, the second capability, and the third the cost of acquiring that capability. We use the name stable 1M only when all three hold.

## The starting point was still Barbet

The training lineage began from the native Role-B checkpoint with the following layer pattern:

```text
[G, S, S, M] × 7
```

`G` denotes global attention, `S` an 8K sliding-attention layer, and `M` Mamba2. After converting the original Hugging Face checkpoint to native Megatron Role-B, selected raw-FP32 logits at 4K and 8K were exact. This fixed a trustworthy starting point: later changes could be attributed to continued pretraining and architectural evolution rather than conversion drift.

The project also explored KDA, but pure-KDA did not retain enough of the original capability and was excluded from the release lineage. The final checkpoint contains no QSA, external-memory controller, or other test-time memory module. PangolinTokenizer, the 1,536 hidden size, seven Mamba2 blocks, the tied embedding and LM head, and the all-token causal language-model objective all remain part of Barbet.

## Shortening the path between distant tokens

The original architecture had one global-attention layer per four-layer block. At a 1M context, the intervening sliding-window layers lengthen the path through which distant tokens can influence one another. During training, the two sliding slots were progressively converted to global attention, followed by an additional global layer that was first materialized as an identity mapping:

```text
[G,S,S,M]×7
  → [G,G,S,M]×7
  → [G,G,G,M]×7
  → [G,G,G,M]×7+G
```

The final insertion itself consumed zero training tokens. The new path received acquisition and exact-1M training only afterward. Materialization reset the local iteration counter, so `iter7008` in the checkpoint name is not the number of updates in its entire ancestry. Measured from Role-B, the selected release lineage contains 42 accepted optimizer stages and 11,715 updates.

| Final-model property | Value |
| --- | ---: |
| Stored parameters (excluding a duplicate tied LM head) | 1,118,799,096 |
| Logical layers | 29 |
| Global-attention / Mamba2 layers | 22 / 7 |
| Hidden / FFN size | 1,536 / 5,120 |
| Attention / KV heads | 16 / 2 |
| Vocabulary size | 114,944 |
| Native context | 1,048,576 |

The architecture evolved, but the checkpoint was not replaced by another pretrained model family. The principal change was the capacity for long-range token mixing.

## Training did not simply march toward longer sequences

The selected-lineage ledger after Role-B records 5,516,558,336 physical training tokens. Of these, 22 stages and 3,744 updates used exact 1,048,576-token sequences, accounting for 3,925,868,544 tokens.

| Physical sequence length | Audited physical tokens |
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
| exact 1M | **3,925,868,544** |
| **Total** | **5,516,558,336** |

This ledger includes only stages in the selected ancestry that completed optimizer updates. Pre-forward failures, evaluation, export, reload, identity materialization, and branches not selected for release are excluded.

The historical R2 repository separately documented a roughly 150B-token, three-phase recipe budget spanning 8K general pretraining, Traditional-Chinese midtraining, and extension from 32K to 256K. The historical records do not bind every completed phase to the released Role-B checkpoint in one completion receipt. We therefore describe 150B as a documented recipe budget, not an exact checkpoint-bound consumed total.

### Establish the length, then isolate the failure

The selected parent progressed through 64K, 128K, 256K, 512K, and an initial exact-1M stage. This established the hardware and distributed execution path while introducing retrieval, variable binding, ordering, multi-key tasks, short compositional chains, and varied evidence depths.

Diagnostics then exposed a more specific weakness: the model could sometimes copy a value from far away but could not reliably use that same value for aggregation or a state update. Adding only more 1M examples would confound three explanations. The model might fail to find the evidence, lack the local operator, or fail to bind an acquired operator to distant evidence.

Later stages therefore returned to 512, 1K, 2K, 4K, and 8K to test local computation, literal remote copy, and remote binding separately before another exact-1M closeout. These shorter stages isolated and repaired capabilities; they did not reduce the model's maximum context back to 8K.

The final consolidation stage ran from immutable iter6240 to iter7008:

| Setting | Value |
| --- | ---: |
| Sequence length | 8,192 |
| Optimizer updates | 768 |
| Physical tokens | 100,663,296 |
| Global batch / tokens per update | 16 / 131,072 |
| Parallel layout | TP2 × CP4 × DP1 |
| Precision | BF16 |
| Optimizer | AdamW; betas `(0.9, 0.95)`; epsilon `1e-8` |
| Weight decay / gradient clipping | `0.1` / `1.0` |
| Learning rate | Stage-local cosine, `1.2e-6 → 3e-7` |
| Warmup / seed | 16 updates / 17 |

The data mixture was 25% replay, 50% strict-digit remote compute binding, 12.5% local sampler repair, and 12.5% literal remote 8K. The objective was ordinary all-token causal next-token cross-entropy, with no answer-only loss, teacher logits, distillation, SFT, or RLHF. All 768 updates completed with no skipped update, NaN, OOM, or fatal error.

## Evaluating a base model as a base model

Barbet is a causal base model with no chat template or instruction tuning. Making conversational exact match the main gate would add prompt format, decoding policy, and instruction following to the measurement, obscuring the pretraining question: did the model use distant information?

Each exact-1M evaluation example therefore has two length- and surface-matched contexts. The `coherent` context retains the correct distant evidence; the `ablated` context removes or corrupts it. Teacher forcing then measures target-only negative log-likelihood for the correct continuation:

```text
evidence benefit = ablated target NLL − coherent target NLL
```

A positive value means the correct evidence increased the model probability of the correct continuation. Each task family contains 20 matched rows, and 2,000 paired-bootstrap resamples estimate the 95% confidence interval of the mean effect. The frozen release gate was fixed before the terminal run: all 140 scores had to be finite, at least five of seven task families needed a confidence-interval lower bound above zero, and all six BPB-retention buckets had to pass.

### Exact-1M results

Fresh-loaded iter7008 completed all 140 rows across eight shards. Six task families passed:

| Exact-1M task | Mean nats / target token | 95% CI | Decision |
| --- | ---: | ---: | ---: |
| Exact NIAH | +0.868817 | [+0.411734, +1.359182] | PASS |
| Opaque NIAH | +1.451789 | [+0.751489, +2.303071] | PASS |
| Multi-key | +1.041410 | [+0.494490, +1.671721] | PASS |
| Ordering | +1.160107 | [+0.710641, +1.667173] | PASS |
| Variable tracking | +0.249664 | [+0.075717, +0.456798] | PASS |
| Three-hop chain | +1.338904 | [+0.665179, +2.092832] | PASS |
| Aggregation | +0.028431 | [−0.019926, +0.080348] | **NOT PROVEN** |

Aggregation had a slightly positive mean, but its interval crossed zero. Its mean effects were also negative when evidence appeared at 30% and 50% depth. We retain this result as not proven rather than hiding it behind the overall 6/7 outcome.

### Retaining base-model capability

The retention suite contains 6,955 examples and 3,000,079 model tokens. It compares iter7008 with Role-B using bits per UTF-8 byte (BPB; lower is better):

| Bucket | iter7008 BPB | Role-B BPB | Relative change |
| --- | ---: | ---: | ---: |
| Code | 0.686505 | 0.739298 | −7.14% |
| English | 0.845356 | 0.894396 | −5.48% |
| Japanese / Korean | 0.953428 | 0.964779 | −1.18% |
| Math | 0.664294 | 0.701121 | −5.25% |
| Multilingual | 1.110032 | 1.224230 | −9.33% |
| zh-TW / zh | 1.126968 | 1.137099 | −0.89% |

None of the six buckets regressed relative to Role-B. This supports frozen likelihood retention; it does not cover every downstream benchmark, factual behavior, or safety property.

## Why not require all seven tasks?

At roughly 1.119B parameters, this release asks whether the model shows reproducible 1M distant-evidence effects across several task families without trading away its original language-modeling ability. Requiring every task, position, and surface form to succeed would test universal robustness, a broader claim than this release makes.

The 5/7 threshold was frozen before final training and was not adjusted after seeing the result. Finite exact-1M scores, task-level statistical effects, and BPB retention remained hard requirements. Free generation, 7/7, positive effects at every evidence depth, and 6/6 strict-8K operator cells remained research diagnostics. The final strict-8K result was 3/6, another indication that operator transfer is incomplete.

This calibration avoids two extremes: claiming million-token understanding from runtime alone, and requiring a billion-parameter base model to solve every long-context problem with universal robustness in one release. The failed cells remain visible.

## What the evidence does and does not support

The evidence supports the following statement:

> `final-global-barbet-iter7008-stable-1m-v11` is a causal base model with approximately 1.119B parameters and a native 1,048,576-token runtime. Across six frozen exact-1M likelihood task families, correct distant evidence produces a reproducible positive effect on the correct continuation. All six base-model BPB-retention buckets also pass.

This experiment does not establish:

- complete understanding of arbitrary million-token documents;
- reliable aggregation or uniform performance at every evidence depth;
- equivalence between teacher-forced likelihood and dependable free generation;
- instruction following, dialogue quality, factuality, or safety alignment;
- a native 2M context;
- overall capability comparable with large frontier foundation models.

These boundaries do not weaken the six positive task results. They identify the work that remains.

## Checkpoint and verifiable identities

The release checkpoint is `final-global-barbet-iter7008-stable-1m-v11`. At the time of publication, the Hugging Face repository remains access-controlled: [`OpenFormosa/barbet-1b-base`](https://huggingface.co/OpenFormosa/barbet-1b-base). Public code and model documentation are in [`OpenFormosa/Barbet`](https://github.com/OpenFormosa/Barbet).

| Artifact | Identity |
| --- | --- |
| Hugging Face revision | `bd8de3ec404752d61da9df78ab2d1f59928f7f44` |
| Checkpoint tree SHA256 | `0380aee774af7f1e81c8e4b99d016171b07490999a117f66653d4c520b580cf6` |
| `model.safetensors` SHA256 | `05376dde654c9beb8154e1e997d0765ce4e236e51d4de99f38ad2e20fd730000` |
| `config.json` SHA256 | `968e293a32e225a993e9a0e503ed4f41f0d3c69e7d7b03c85078497935b48d91` |

The release configuration is:

```json
{
  "max_position_embeddings": 1048576,
  "rope_theta": 10000000.0,
  "rope_scaling": null
}
```

The `configs/barbet_1b/` and `configs/barbet_1b_1m/` directories in the GitHub repository retain the original R2 legacy presets for reproducing earlier research. Iter7008 should be loaded with the `config.json` shipped alongside its Hugging Face weights.

The conclusion of Barbet's 1M effort is specific. Running a long sequence is only the starting point. Correct distant evidence must change the probability of the correct continuation, and continued pretraining must preserve the model's earlier language-modeling ability. Iter7008 closes that evidence chain for six task families. Aggregation remains the next unresolved capability.

</div>
