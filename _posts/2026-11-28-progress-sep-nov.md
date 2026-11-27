---
layout: post
title: "Progress report, September to November 2026"
zh_title: "2026 年 9 到 11 月進度報告"
i18n_key: progress_2026_q4
description: "BlueMagpie-TTS V1 now runs faster than real time on Apple Silicon, the Barbet Harness Library ships an installable inference harness, and OpenFormosa opens up as a community project."
zh_description: "BlueMagpie-TTS V1 在 Apple Silicon 上比即時更快、Barbet Harness Library 推出可安裝的推論工具，OpenFormosa 也正式轉為社群專案。"
keywords: "OpenFormosa 進度, BlueMagpie-TTS MLX, Apple Silicon TTS, Barbet Harness Library, barbet-infer, 台灣開源 AI 社群"
date: 2026-11-28
category: update
tags: [docs, tts, pretrain]
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

過去三個月有三件事。第一，BlueMagpie-TTS V1 在 Mac 上可以比即時更快地合成語音，這是社群貢獻者完成的。第二，Barbet Harness Library 不只是一組工作手冊，現在也能直接安裝、直接跑。第三，OpenFormosa 從一個人的專案，轉為人人都能參與的社群專案。接下來幾週，我們會依序釋出 ASR、OCR 與新一代 TTS。

</div>

## 1. BlueMagpie-TTS V1：在 Mac 上比即時更快

**為什麼重要。** 很多人手上只有一台筆電。如果合成一句話要等十幾秒，就很難拿來實際使用。

**做了什麼。** 社群貢獻者 [@dsif2012](https://github.com/dsif2012) 把整條推論路徑改寫成 Apple 的 MLX 框架。改寫範圍包括 Barbet 語言模型、聲學模組與音訊解碼器。每個模組都和原本的 PyTorch 版本逐一比對數值，確認輸出一致。

**結果。** 在 Apple M 系列晶片、fp32 精度下，合成 1 秒語音約需 0.77 秒運算（RTF 0.77）。也就是說，聲音產生的速度比播放還快。同一台機器上，這比 PyTorch 的 MPS 後端快約 1.45 倍，比 CPU 快約 3.27 倍。數字來自 repo 內的 `scripts/bench_rtf.py`，不同機器會有差異。

這次貢獻也加入了串流輸出、批次生成、語速控制，以及 int4／int8 的嵌入量化選項。安裝方式只多一個選項：

```bash
pip install -e .[mlx]
```

使用說明見 [BlueMagpie-TTS README](https://github.com/OpenFormosa/BlueMagpie-TTS#apple-silicon-mlx-加速選用)。

## 2. Barbet Harness Library：從手冊到可以執行的框架

**原本的問題。** 小模型常常知道答案，卻沒有照步驟做，或忘了檢查自己的輸出。

**做法。** 我們把「遇到某類任務該怎麼做」寫成 64 份工作手冊（skills）。每份手冊寫清楚什麼時候適用、步驟、出錯怎麼辦、怎麼驗收。這個 repo 原本叫 Barbet Skill Library。10 月起，它也附上執行這些手冊的推論工具 `barbet-infer`，所以我們把名字改為 **Barbet Harness Library**：手冊加上執行框架，才是完整的 harness。

```bash
pip install -e '.[vllm]'
barbet-infer run --family mini \
  --prompt '每箱 12 瓶，買 3 箱共有多少瓶？' --contract number
```

**實驗結果。** 我們固定模型權重，只改變模型看到的手冊與工具。測試是事先封存的 646 題，跑 3 個 seed、比較 10 組設定。受測的 1B 模型（MiniCPM5-1B）四領域主指標從 38.02% 提升到 50.39%（+12.37 個百分點，配對 95% 信賴區間 +9.90 至 +14.97）。

**這個結果不代表什麼。** 主評分包含輸出格式是否正確，所以有一部分提升來自格式更守規矩。數學題的事後診斷也沒有看到數值推理變好。同一套 harness 下，9B 模型（Qwen3.5-9B）是 76.24%，小模型仍有明顯差距。部分手冊由模型生成，只經過有限的審查，還不是人工逐一驗證的版本。

完整說明見 [Barbet Harness Library](https://github.com/OpenFormosa/barbet-harness-library)。

## 3. Barbet 1B：原生 1M 上下文

8 月底，我們釋出了原生支援 1,048,576 tokens 上下文的 Barbet 1B Base。訓練方式與檢查方法寫在〈[Barbet 怎麼練到 1M]({{ '/blog/2026/08/30/barbet-1b-native-1m/' | relative_url }})〉。網站上所有 Barbet 的介紹，現在都統一寫原生 1M。

## 4. OpenFormosa 轉為社群專案

**為什麼。** 一個只靠少數人維護的專案，很難長久。我們希望每一位回報問題、改文件、送 PR 的人，都是 OpenFormosa 的一份子。

**這三個月的變化：**

- **一頁看懂所有專案。** [所有專案]({{ '/projects/' | relative_url }})頁面把每個 repo 分成四類，並提供兩種讀法：想直接用的人看成果，研究人員看技術細節與每個數字的測試條件。
- **授權統一。** 程式碼、文件與網站內容改採 Apache 2.0。Barbet 與今年新釋出的模型權重，也採 Apache 2.0。BlueMagpie-TTS V1 因內附的預設語者向量限非商用，維持原本的授權。
- **治理與政策公開。** [社群與治理]({{ '/community/' | relative_url }})說明怎麼參與、怎麼做決定。[隱私權]({{ '/privacy/' | relative_url }})、[使用規範]({{ '/acceptable-use/' | relative_url }})與[服務條款]({{ '/terms/' | relative_url }})也都已上線。
- **聯絡管道。** 一般與媒體聯絡請寄 hello@openformosa.com，安全問題請寄 security@openformosa.com。日常討論在 [Discord](https://discord.gg/N4YnrjjcW7)。
- **咱來學台語。** 7 月上線的[台語學習網站](https://openformosa.github.io/OpenTaigi/)，把教育部公開教材整理成手機也好用的互動課程。它現在列在專案頁的「應用」類別。

## 5. 接下來

接下來幾週，我們會一週釋出一個模型，順序是：

1. **BlackBear-ASR**：語音辨識。
2. **SikaDeer-OCR**：文件辨識。
3. **BlueMagpie-TTS V2**：新一代語音合成，不再內附預設語者向量。

每個模型釋出時，都會附上一般人看得懂的使用報告、使用說明與 demo。進度會即時更新在[所有專案]({{ '/projects/' | relative_url }})頁。

**想一起做？** 最容易的入口是 Barbet Harness Library：提議一份新手冊，或修改一份既有的手冊。也歡迎回報 BlueMagpie 唸錯的句子，或到 Discord 告訴我們你想用在哪裡。

## 致謝

感謝至今的社群貢獻者，包括 [@dsif2012](https://github.com/dsif2012)（BlueMagpie MLX 加速）、[@leo2783](https://github.com/leo2783)（Barbet 文件）與 [@hlb](https://github.com/hlb)（網站文案）。也感謝 Taipei-1、臺大語音實驗室（NTU Speech Lab）與 NTU SPML Lab 的支持。

</div>

<div class="post-lang-en" markdown="1">

<div class="post-abstract" markdown="1">

Three things happened over the past three months. First, BlueMagpie-TTS V1 now synthesizes speech faster than real time on a Mac, thanks to a community contributor. Second, the Barbet Harness Library is no longer only a set of guides: you can now install it and run it. Third, OpenFormosa has moved from a one-person project to a community project anyone can join. Over the next few weeks we will release ASR, OCR, and a new TTS, in that order.

</div>

## 1. BlueMagpie-TTS V1: faster than real time on a Mac

**Why it matters.** Many people only have a laptop. If one sentence takes more than ten seconds to synthesize, the model is hard to use in practice.

**What changed.** Community contributor [@dsif2012](https://github.com/dsif2012) rewrote the full inference path in Apple's MLX framework. The rewrite covers the Barbet language model, the acoustic modules, and the audio decoder. Each module was checked numerically against the original PyTorch version.

**Result.** On Apple M-series chips at fp32, one second of speech takes about 0.77 seconds of compute (RTF 0.77). Speech is produced faster than it plays. On the same machine this is about 1.45× faster than the PyTorch MPS backend and about 3.27× faster than CPU. The numbers come from `scripts/bench_rtf.py` in the repository and vary by machine.

The contribution also adds streaming output, batched generation, pace control, and optional int4/int8 embedding quantization. Installation needs one extra option:

```bash
pip install -e .[mlx]
```

See the [BlueMagpie-TTS usage guide](https://github.com/OpenFormosa/BlueMagpie-TTS/blob/main/USAGE.md).

## 2. Barbet Harness Library: from guides to a runnable harness

**The problem.** Small models often know the answer but skip steps or forget to check their own output.

**The approach.** We wrote 64 work guides (skills) for common types of tasks. Each guide says when it applies, the steps, what to do on failure, and how to verify the result. The repository was called the Barbet Skill Library. Since October it also ships `barbet-infer`, an inference tool that runs these guides. We therefore renamed it the **Barbet Harness Library**: guides plus the runtime that applies them make a complete harness.

```bash
pip install -e '.[vllm]'
barbet-infer run --family mini \
  --prompt '每箱 12 瓶，買 3 箱共有多少瓶？' --contract number
```

**Result.** We froze the model weights and changed only the guides and tools the model sees. The test set of 646 questions was sealed in advance, with 3 seeds and 10 configurations. The tested 1B model (MiniCPM5-1B) improved its four-domain main metric from 38.02% to 50.39% (+12.37 points, paired 95% CI +9.90 to +14.97).

**What the result does not show.** The main score includes output-format compliance, so part of the gain comes from better-formed answers. A post-hoc math diagnosis also shows no gain in numeric reasoning. A 9B model (Qwen3.5-9B) with the same harness scores 76.24%, so the small model still lags clearly. Some guides were generated by a model with limited review and are not yet human-verified.

Details are in the [Barbet Harness Library](https://github.com/OpenFormosa/barbet-harness-library).

## 3. Barbet 1B: native 1M context

At the end of August we released Barbet 1B Base with a native context of 1,048,576 tokens. The training and checks are described in [How we trained Barbet for a 1M-token context]({{ '/blog/2026/08/30/barbet-1b-native-1m/' | relative_url }}). Every description of Barbet on this site now states native 1M.

## 4. OpenFormosa becomes a community project

**Why.** A project maintained by a few people cannot last. We want everyone who reports a bug, fixes a doc, or opens a PR to be part of OpenFormosa.

**What changed:**

- **One page for every project.** The [Projects]({{ '/projects/' | relative_url }}) page groups every repository into four categories with two reading routes: results for people who want to use things, and technical details with the test condition behind each number for researchers.
- **One license.** Code, docs, and site content now use Apache 2.0. The weights of Barbet and of the models we release this year also use Apache 2.0. BlueMagpie-TTS V1 keeps its original license because its bundled default speaker vector is non-commercial only.
- **Open governance and policies.** [Community and governance]({{ '/community/' | relative_url }}) explains how to take part and how decisions are made. The [privacy]({{ '/privacy/' | relative_url }}), [acceptable use]({{ '/acceptable-use/' | relative_url }}), and [terms]({{ '/terms/' | relative_url }}) pages are live.
- **Contact.** Write to hello@openformosa.com for general and press questions, and security@openformosa.com for security issues. Day-to-day discussion happens on [Discord](https://discord.gg/N4YnrjjcW7).
- **Learn Taigi.** The [Taigi learning site](https://openformosa.github.io/OpenTaigi/), launched in July, turns the Ministry of Education's open course material into interactive lessons that work on phones. It is now listed under Applications on the Projects page.

## 5. What's next

Over the next few weeks we will release one model per week, in this order:

1. **BlackBear-ASR**: speech recognition.
2. **SikaDeer-OCR**: document reading.
3. **BlueMagpie-TTS V2**: the next TTS, without a bundled default speaker vector.

Each release will come with a plain-language usage report, a guide, and a demo. Status is kept up to date on the [Projects]({{ '/projects/' | relative_url }}) page.

**Want to help?** The easiest place to start is the Barbet Harness Library: propose a new guide or improve an existing one. You can also report sentences BlueMagpie gets wrong, or tell us on Discord what you want to use these models for.

## Acknowledgments

Thanks to our community contributors so far, including [@dsif2012](https://github.com/dsif2012) (BlueMagpie MLX acceleration), [@leo2783](https://github.com/leo2783) (Barbet docs), and [@hlb](https://github.com/hlb) (site copy). We also thank Taipei-1, NTU Speech Lab, and NTU SPML Lab for their support.

</div>
