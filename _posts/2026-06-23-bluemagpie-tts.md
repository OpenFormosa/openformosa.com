---
layout: post
title: "BlueMagpie-TTS: Taiwanese-accent, Chinese–English code-switching speech synthesis"
zh_title: "BlueMagpie-TTS：臺灣口音、中英混合的語音合成模型"
i18n_key: bluemagpie
description: "An open Taiwanese-accent text-to-speech model that handles Chinese–English code-switching — keep VoxCPM's acoustic stack, swap in the Barbet language model, and cut character error rate by about 58% on a hard test set."
zh_description: "BlueMagpie-TTS 是臺灣口音、中英混合的開源語音合成模型：保留 VoxCPM 聲學架構，換上 Barbet 文字語意模型，在難唸測試集上把字元錯誤率降低約 58%。"
date: 2026-06-23
category: research
tags: [tts, model, speech, bluemagpie]
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

**摘要**　BlueMagpie-TTS 是一個支援臺灣口音中文與中英混合的文字轉語音（TTS）模型，由 OpenFormosa 開源。它的核心設計只有一句話：保留一套預訓練的聲學架構（取自 VoxCPM），並把原本的文字語意語言模型換成 Barbet。Barbet 負責決定「要說什麼」——文字語意、韻律規劃、節奏與重音；聲學架構負責生成聲音的細節。模型內附李宏毅老師的語者向量作為預設聲音，已取得本人授權。在測試集上，字元錯誤率（CER）為 4.81%，詞錯誤率（WER）為 5.36%，相對原本參考模型分別降低約 58.0% 與 63.9%。

這篇文章會先讓你直接聽，再完整說明它是什麼、怎麼組起來、怎麼用，還有哪些地方仍然會出錯。

</div>

**本文重點**

- **保留聲學、替換腦袋**——整套保留 VoxCPM 的預訓練聲學架構，只把「決定說什麼」的文字語意模型換成 Barbet，兩者用橋接模組接起來。
- **為臺灣語境而生**——同時針對臺灣口音中文與中英夾雜（code-switching）兩個常被忽略的需求，讓一個模型自然處理在地腔調與語碼轉換。
- **可聽可驗證**——以「TTS 合成 → Breeze-ASR-25 還原 → 逐字比對」這套流程評估品質；本文的互動示範讓你親耳聽、親眼看辨識結果。
- **誠實的邊界**——它不是免審核的產品級系統，輸出仍可能出錯；參考音訊與語者向量都必須先取得授權，才能用於合成或散布。

## 先聽聽看

光說一個語音模型「好」沒什麼意義，總得讓人親耳聽聽看。下面這組句子來自一份 500 句「難唸」的中文測試集——刻意混入英文單字、縮寫、數字與專有名詞，正是臺灣日常語音應用最容易翻車的地方。

我們的評估方式會繞一圈回來：把文字交給 BlueMagpie-TTS 合成成語音，再把語音交給臺灣的 Breeze-ASR-25 語音辨識模型「聽寫」回文字，最後逐字比對。兩者差多少，就是字元錯誤率（CER）。

<figure class="post-figure">
<svg viewBox="0 0 720 200" role="img" aria-labelledby="rt-zh" xmlns="http://www.w3.org/2000/svg">
<title id="rt-zh">評估流程：TTS 合成後再用 ASR 還原比對</title>
<defs><marker id="m-rt-zh" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 z" fill="var(--muted)"/></marker></defs>
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">評估方法：合成語音後，再用 ASR 還原、逐字比對</text>
<rect x="8" y="44" width="104" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="60" y="70" text-anchor="middle" fill="var(--paper-ink)" font-size="13" font-weight="700">輸入文字</text>
<text x="60" y="87" text-anchor="middle" fill="var(--muted)" font-size="10">參考答案</text>
<line x1="114" y1="72" x2="132" y2="72" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-rt-zh)"/>
<rect x="134" y="44" width="150" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<rect x="134" y="44" width="6" height="56" fill="var(--blue)"/>
<text x="212" y="70" text-anchor="middle" fill="var(--blue)" font-size="13" font-weight="700">BlueMagpie-TTS</text>
<text x="212" y="87" text-anchor="middle" fill="var(--muted)" font-size="10">文字 → 語音</text>
<line x1="286" y1="72" x2="304" y2="72" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-rt-zh)"/>
<rect x="306" y="44" width="96" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="354" y="70" text-anchor="middle" fill="var(--paper-ink)" font-size="13" font-weight="700">合成語音</text>
<g stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round"><line x1="336" y1="84" x2="336" y2="90"/><line x1="346" y1="80" x2="346" y2="94"/><line x1="356" y1="83" x2="356" y2="91"/><line x1="366" y1="78" x2="366" y2="96"/><line x1="376" y1="85" x2="376" y2="89"/></g>
<line x1="404" y1="72" x2="422" y2="72" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-rt-zh)"/>
<rect x="424" y="44" width="150" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<rect x="424" y="44" width="6" height="56" fill="var(--green)"/>
<text x="502" y="70" text-anchor="middle" fill="var(--green)" font-size="13" font-weight="700">Breeze-ASR-25</text>
<text x="502" y="87" text-anchor="middle" fill="var(--muted)" font-size="10">語音 → 文字</text>
<line x1="576" y1="72" x2="594" y2="72" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-rt-zh)"/>
<rect x="596" y="44" width="116" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="654" y="70" text-anchor="middle" fill="var(--paper-ink)" font-size="13" font-weight="700">辨識文字</text>
<text x="654" y="87" text-anchor="middle" fill="var(--muted)" font-size="10">ASR 聽到的</text>
<path d="M654 100 V146 Q654 152 648 152 H66 Q60 152 60 146 V104" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#m-rt-zh)"/>
<text x="357" y="170" text-anchor="middle" fill="var(--paper-ink)" font-size="12" font-weight="700">逐字比對　＝　字元錯誤率（CER）</text>
</svg>
<figcaption><b>圖 1.</b> 評估流程。把同一段文字交給 BlueMagpie-TTS 合成，再交給 Breeze-ASR-25 還原成文字，逐字比對得到 CER。底下示範的每張卡片，展開後看到的就是這個流程裡 ASR 真正聽到的內容。</figcaption>
</figure>

<div class="tts-demo" data-tts-demo><div class="tts-demo__head"><span class="tts-demo__title">聽聽看：難唸測試句的實際輸出</span><span class="tts-demo__hint">點播放鍵聽模型怎麼唸；展開「ASR 聽到什麼？」可看 Breeze-ASR-25 把這段語音聽回成什麼文字。語者為李宏毅老師（已授權）。</span></div><ol class="tts-demo__list"><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">這個 <b>Transformer</b> 架構，其實就是現在所有聊天機器人的底層。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">ASR 聽到什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 辨識</span><span class="tts-card__asr-v">這個 transformer 架構其實就是現在所有聊天機器人的底層</span><span class="tts-card__badge is-ok">逐字相符</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0014.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">做完 <b>fine-tune</b>，我還跑了一輪 <b>ASR</b> 驗證確認字沒念錯。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">ASR 聽到什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 辨識</span><span class="tts-card__asr-v">做完 fine-tune 我還跑了一輪 ASR 驗證確認字沒念錯</span><span class="tts-card__badge is-ok">逐字相符</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0476.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">做語音合成研究，少不了一塊夠力的 <b>GPU</b> 跟一堆乾淨的語料。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">ASR 聽到什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 辨識</span><span class="tts-card__asr-v">做語音合成研究少不了一塊夠力的 GPU 跟一堆乾淨的語料</span><span class="tts-card__badge is-ok">逐字相符</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0301.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">我們把溫度調到 <b>0.85</b>，模型講話就從死板變得有人味了。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">ASR 聽到什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 辨識</span><span class="tts-card__asr-v">我們把溫度調到 0.85 模型講話就從死板變得有人味了</span><span class="tts-card__badge is-ok">逐字相符</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0002.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">大家都在喊 <b>AGI</b> 快來了，但連我自己都還搞不清楚我算不算。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">ASR 聽到什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 辨識</span><span class="tts-card__asr-v">大家都在喊 AGI 快來了但連我自己都還搞不清楚我算不算</span><span class="tts-card__badge is-ok">逐字相符</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0125.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">這套號稱能讓 <b>AI</b> 自己變強的方法，講穿了就是讓一個模型不斷去教另一個比較笨的模型，再回頭修自己。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">ASR 聽到什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 辨識</span><span class="tts-card__asr-v">這套號稱能讓 AI 自己變強的方法講穿了就是讓一個模型不斷去教另一個比較笨的模型再回頭修自己</span><span class="tts-card__badge is-ok">逐字相符</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0044.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>OpenAI</b> 我都直接念英文，可是 <b>TTS</b> 常把 open 跟 A I 黏在一起變成怪音。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">ASR 聽到什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 辨識</span><span class="tts-card__asr-v">OpenAI 我都直接念英文可是 TTS 常把 open 跟 AI 黏在一起變成怪音</span><span class="tts-card__badge is-ok">逐字相符</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0117.mp3' | relative_url }}"></audio></li></ol></div>

最後一句話本身就在講 TTS 怎麼把「open」跟「AI」黏在一起變成怪音——而模型把這句唸對了，Breeze-ASR-25 也乾淨地還原成「OpenAI」「TTS」「AI」。這正是中英夾雜要解決的問題。

**想自己玩玩看？** 打開[線上 Demo（Hugging Face Space）](https://huggingface.co/spaces/voidful/BlueMagpie-TTS-Demo)，丟一段中英夾雜的句子進去，就能即時聽到合成結果。

### 它仍然會出錯

搞清楚它不能做什麼，跟知道它能做什麼一樣重要。同一份難唸測試集裡，也有模型沒處理好的例子。下面這句的 `LLM` 被唸得不夠清楚，ASR 把它聽成了「LOL and」——這類英文縮寫的邊界，仍是目前的弱點之一。

<div class="tts-demo" data-tts-demo><div class="tts-demo__head"><span class="tts-demo__title">誠實的一例：縮寫邊界仍會翻車</span><span class="tts-demo__hint">展開可看到 ASR 還原時出現的差異。</span></div><ol class="tts-demo__list"><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">我把整篇逐字稿丟給 <b>LLM</b>，叫它幫我整理成三個重點。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">ASR 聽到什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 辨識</span><span class="tts-card__asr-v">把整篇逐字稿丟給 LOL and 叫他幫我整理成三個重點</span><span class="tts-card__badge is-warn">LLM 被聽成 LOL and</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0003.mp3' | relative_url }}"></audio></li></ol></div>

## 一、這是什麼

### 1.1 為什麼要做這個模型

臺灣的語音應用有兩個常被忽略的需求：臺灣口音，以及中英夾雜。

先說中英夾雜。一段話裡同時出現中文、英文單字、縮寫與專有名詞，這在臺灣是常態，但對語音合成是個難題。多數現成 TTS 模型在純中文或純英文上表現良好，但在語碼轉換（code-switching）的邊界上容易出錯。

再說口音。多數模型的中文偏向其他華語腔調，唸起來不像臺灣人說話。

BlueMagpie-TTS 同時針對這兩件事。它的目標很單純：讓一個模型自然地處理臺灣口音的中文，以及中英夾雜的語音生成。

### 1.2 它能做什麼

模型支援三種使用情境，外加一個串流模式。

| 用途 | 一句話說明 |
| --- | --- |
| 一般語音合成 | 直接把文字唸出來 |
| 聲音複製 | 給一段參考音檔，輸出模仿該語者的音色 |
| 指定語者 | 用事先準備好的語者向量控制音色 |
| 串流輸出 | 邊合成邊回傳音訊區塊，適合即時播放 |

最常用的就是第一種：丟一段文字進去，拿到一段語音。其他都是看需要再用的進階控制。

### 1.3 它不能做什麼

搞清楚它不能做什麼，跟知道它能做什麼一樣重要。使用前先記住幾條底線。

第一，它不是免審核的產品級系統。生成語音可能出錯，未經人工審查時，不應直接用於真實世界的通知或對外播放。

第二，授權是硬規定。模型內附的李宏毅語者向量已取得授權，可直接當範例。但若要複製其他人的聲音，或使用其他語者向量，你必須先取得對方授權。語者向量表與合成出來的音檔，未經授權前都不要對外散布。

### 1.4 名字的由來

專案全名是 OpenFormosa Blue Magpie TTS。「藍鵲」取自臺灣藍鵲（學名 *Urocissa caerulea*）。選牠當識別有三層用意：臺灣藍鵲叫聲響亮、辨識度高，呼應 TTS 把文字變成聲音的核心；牠標誌性的長尾巴帶來流動延展的視覺意象；而 OpenFormosa（福爾摩沙）點出專案立足臺灣、面向臺灣華語的定位。

## 二、模型長什麼樣

### 2.1 核心想法

一般的 TTS 模型是一整塊：文字進去，語音出來，中間全部一起訓練。

BlueMagpie-TTS 走的是另一條路。它把一套已經訓練好、聲音品質不錯的「聲學架構」整個保留下來，只把負責「決定要說什麼」的那顆腦袋，換成 Barbet。

這樣做的好處很直接：Barbet 負責文字理解跟韻律規劃，聲學架構保留原本累積下來的發音細節，兩邊各司其職。

<figure class="post-figure">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="arch-zh" xmlns="http://www.w3.org/2000/svg">
<title id="arch-zh">BlueMagpie-TTS 架構：保留聲學、替換腦袋</title>
<defs><marker id="m-arch-zh" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 z" fill="var(--muted)"/></marker></defs>
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">保留聲學架構，只換掉「決定說什麼」的腦袋</text>
<path d="M108 114 v-9 h128 v9" fill="none" stroke="var(--blue)" stroke-width="1.5"/>
<text x="172" y="97" text-anchor="middle" fill="var(--blue)" font-size="12" font-weight="700">換掉的腦袋</text>
<path d="M372 114 v-9 h150 v9" fill="none" stroke="var(--green)" stroke-width="1.5"/>
<text x="447" y="97" text-anchor="middle" fill="var(--green)" font-size="12" font-weight="700">保留的聲學架構</text>
<rect x="10" y="130" width="74" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="47" y="160" text-anchor="middle" fill="var(--paper-ink)" font-size="14" font-weight="700">文字</text>
<text x="47" y="178" text-anchor="middle" fill="var(--muted)" font-size="10">輸入</text>
<line x1="86" y1="164" x2="106" y2="164" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-arch-zh)"/>
<rect x="108" y="130" width="128" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<rect x="108" y="130" width="6" height="68" fill="var(--blue)"/>
<text x="174" y="156" text-anchor="middle" fill="var(--blue)" font-size="14" font-weight="700">Barbet</text>
<text x="174" y="174" text-anchor="middle" fill="var(--muted)" font-size="10">文字語意 · 韻律規劃</text>
<text x="174" y="189" text-anchor="middle" fill="var(--muted)" font-size="10">決定「要說什麼」</text>
<line x1="238" y1="164" x2="256" y2="164" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-arch-zh)"/>
<rect x="258" y="130" width="92" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2" stroke-dasharray="5 4"/>
<text x="304" y="160" text-anchor="middle" fill="var(--paper-ink)" font-size="13" font-weight="700">橋接模組</text>
<text x="304" y="178" text-anchor="middle" fill="var(--muted)" font-size="10">格式翻譯</text>
<line x1="352" y1="164" x2="370" y2="164" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-arch-zh)"/>
<rect x="372" y="130" width="150" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<rect x="372" y="130" width="6" height="68" fill="var(--green)"/>
<text x="450" y="156" text-anchor="middle" fill="var(--green)" font-size="14" font-weight="700">VoxCPM 聲學模組</text>
<text x="450" y="174" text-anchor="middle" fill="var(--muted)" font-size="10">把規劃變成實際聲音</text>
<text x="450" y="189" text-anchor="middle" fill="var(--muted)" font-size="10">預訓練、整段保留</text>
<line x1="524" y1="164" x2="542" y2="164" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-arch-zh)"/>
<rect x="544" y="130" width="166" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="627" y="156" text-anchor="middle" fill="var(--paper-ink)" font-size="14" font-weight="700">語音波形</text>
<g stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round"><line x1="571" y1="169" x2="571" y2="191"/><line x1="584" y1="163" x2="584" y2="197"/><line x1="597" y1="173" x2="597" y2="187"/><line x1="610" y1="160" x2="610" y2="200"/><line x1="623" y1="167" x2="623" y2="193"/><line x1="636" y1="164" x2="636" y2="196"/><line x1="649" y1="171" x2="649" y2="189"/><line x1="662" y1="161" x2="662" y2="199"/><line x1="675" y1="169" x2="675" y2="191"/><line x1="688" y1="174" x2="688" y2="186"/></g>
<text x="360" y="230" text-anchor="middle" fill="var(--muted)" font-size="11">資料流：文字 → Barbet → 橋接模組 → VoxCPM 聲學模組 → 語音波形</text>
</svg>
<figcaption><b>圖 2.</b> 核心設計。深藍色的 Barbet 是被「換上」的文字語意腦袋，負責決定要說什麼與怎麼說；綠色的 VoxCPM 聲學模組整段保留，負責把規劃變成實際聲音。中間的橋接模組把兩邊不相容的格式翻譯接通。</figcaption>
</figure>

### 2.2 兩個現成的零件

BlueMagpie-TTS 不是從零造輪子，而是把兩個現成的零件兜在一起。

Barbet 是文字語意的語言模型，來自 [OpenFormosa/Barbet](https://github.com/OpenFormosa/Barbet)。安裝本專案時，它會自動從 GitHub 一起裝進來。

聲學模組取自 [VoxCPM2](https://github.com/OpenBMB/VoxCPM)（OpenBMB，採 Apache-2.0 授權），已經內含在專案裡（位於 `bluemagpie/_vendor/`），不需另外安裝。

兩者的內部格式並不相容。橋接模組的工作，就是把一邊的輸出翻譯成另一邊看得懂的形式，讓兩邊接得起來。

## 三、安裝

先把專案 clone 下來，再以可編輯模式安裝。相依的 Barbet 套件會自動一起裝。

```bash
git clone https://github.com/OpenFormosa/BlueMagpie-TTS
cd BlueMagpie-TTS
pip install -e .
```

如果要把合成出來的音檔存成 `.wav`，再另外裝 `soundfile`：

```bash
pip install soundfile
```

## 四、怎麼用

這一節是重點。以下示範如何載入模型、合成語音、複製聲音、指定語者與串流輸出。

### 4.1 載入模型

從 Hugging Face 下載並載入：

```python
import os
from huggingface_hub import snapshot_download
from transformers import PreTrainedTokenizerFast
from bluemagpie import BlueMagpieModel

model_dir = snapshot_download("OpenFormosa/BlueMagpie-TTS", token=True)
# 直接從 tokenizer.json 載入 tokenizer，相容較新版 transformers（5.x）
tokenizer = PreTrainedTokenizerFast(tokenizer_file=os.path.join(model_dir, "tokenizer.json"))
model = BlueMagpieModel.from_local(model_dir, tokenizer=tokenizer, training=False, device="cuda")
```

如果你已經有一份本機模型檔案，把 `model_dir` 指向那個目錄就行，其他都一樣。`device` 可填 `"cuda"` 或 `"cpu"`，不指定時會自動選擇。推論時記得固定用 `training=False`。

### 4.2 基本合成：文字轉語音

最基本的用法：給一段文字，拿到一段語音。`target_text` 可以直接混寫中文與英文，模型會自己處理切換。

```python
import soundfile as sf

audio = model.generate(
    target_text="這是 AI TTS code switching 測試。",
    cfg_value=2.8,
    inference_timesteps=9,
    max_len=2000,
    retry_badcase=True,
)
sf.write("output.wav", audio.squeeze().cpu().numpy(), model.sample_rate)
```

這裡用的是建議參數（`cfg_value=2.8`、`inference_timesteps=9`）。程式碼的原始預設值其實是 2.0 與 10，但建議用前者，原因看下面的參數表就知道。

### 4.3 聲音複製：以參考音檔模仿語者

給一段 `reference_wav_path`，輸出就會模仿該段音檔的語者音色。

```python
audio = model.generate(
    target_text="今天的會議改到下午三點。",
    reference_wav_path="speaker.wav",
    cfg_value=2.8,
    inference_timesteps=9,
)
```

再次提醒：只能使用你有權合成的聲音。

### 4.4 指定語者：以語者向量控制音色

模型自帶李宏毅老師的語者向量作為範例，已取得本人授權，存放在模型目錄的 `checkpoints/hung_yi_lee_speaker_centroids.pt`。先載入向量表，依語者 ID `hung_yi_lee` 取出向量，再透過 `speaker_centroid` 指定音色。

```python
import os
import torch

centroids = torch.load(
    os.path.join(model_dir, "checkpoints", "hung_yi_lee_speaker_centroids.pt"),
    map_location="cpu",
    weights_only=True,
)
speaker_centroid = centroids["centroids"][centroids["speaker_ids"].index("hung_yi_lee")]

audio = model.generate(
    target_text="今天天氣真好。",
    speaker_centroid=speaker_centroid,   # 也可以傳入你自己已取得授權的語者向量
    cfg_value=2.8,
    inference_timesteps=9,
)
```

### 4.5 串流輸出

需要邊合成邊播放時，改用 `generate_streaming`。它是一個產生器，一段一段地回傳音訊區塊。

```python
chunks = []
for chunk in model.generate_streaming(target_text="今天天氣真好。"):
    chunks.append(chunk)
    # 這裡可以即時播放或寫出 chunk
```

注意：串流模式下不支援自動重試（`retry_badcase`）。

### 4.6 四種輸入模式

上面的功能其實都是同一個 `generate` 介面的不同參數組合。下表整理四種模式。

| 模式 | 需要的參數 | 用途 |
| --- | --- | --- |
| 一般合成 | `target_text` | 直接把文字唸出來 |
| 語音接續 | `target_text`、`prompt_text`、`prompt_wav_path` | 從一段已有的語音與其文字接著往下唸 |
| 參考音檔 | `target_text`、`reference_wav_path` | 模仿參考音檔的語者音色 |
| 參考音檔＋接續 | 以上參數合併使用 | 同時指定音色並接續語音 |

### 4.7 常用參數怎麼調

搞懂這幾個參數，你就能在「穩定」跟「自然」之間抓到平衡。

| 參數 | 預設值 | 建議值 | 說明 |
| --- | --- | --- | --- |
| `target_text` | （必填） | | 要合成的文字 |
| `prompt_text` | `""` | | 提示文字，搭配 `prompt_wav_path` 做語音接續 |
| `prompt_wav_path` | `""` | | 提示音檔路徑，用於語音接續 |
| `reference_wav_path` | `""` | | 參考音檔路徑，用於聲音複製 |
| `speaker_centroid` | `None` | | 語者向量，用於指定音色 |
| `cfg_value` | `2.0` | `2.8` | 引導強度。越大越貼合條件，但太高會較不自然 |
| `inference_timesteps` | `10` | `9` | 取樣步數。越多品質越好，但速度越慢 |
| `min_len` / `max_len` | `2` / `2000` | | 輸出長度的下限與上限 |
| `retry_badcase` | `False` | `True` | 偵測到異常輸出時自動重試（串流模式不支援） |

「建議值」這一欄是官方調校後的推薦設定，也記錄在 `config.json` 的 `generation_defaults` 裡。這組值是用 500 句難唸的中文句子（也就是本文一開始示範的那批），搭配臺灣的 Breeze-ASR-25 語音辨識模型、以正規化 CER 調出來的最佳組合。

### 4.8 一些實用提醒

長文建議切成句子大小的片段，逐句合成後再把波形接起來，需要的話在接縫處加一點淡入淡出。若要更連貫，可在合成下一段時，傳入上一段的一小段已授權片段作為提示。

沒有 GPU 也能跑。把 `device` 設成 `"cpu"` 就行，速度是慢一點，但短句合成也只要幾十秒。輸出是 48 kHz 單聲道。

如果你不傳入 `tokenizer`、改用自動載入，在 transformers 5.x 可能會載入失敗，或在呼叫 `generate()` 時才報「No tokenizer attached」。照上面範例直接從 `tokenizer.json` 載入再傳進去，就能避開這個問題。

## 五、效果如何

在內部測試集上，BlueMagpie-TTS 的表現如下。數字越低越好。

| 系統 | CER | WER |
| --- | --- | --- |
| BlueMagpie-TTS | 4.81% | 5.36% |
| 原本參考模型 | 11.45% | 14.83% |

<figure class="post-figure">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="cer-zh" xmlns="http://www.w3.org/2000/svg">
<title id="cer-zh">CER／WER 與參考模型比較</title>
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">字元／詞錯誤率（%，越低越好）</text>
<g stroke="var(--line)" stroke-width="1"><line x1="210" y1="56" x2="210" y2="214"/><line x1="330" y1="56" x2="330" y2="214"/><line x1="450" y1="56" x2="450" y2="214"/><line x1="570" y1="56" x2="570" y2="214"/><line x1="690" y1="56" x2="690" y2="214"/></g>
<g fill="var(--muted)" font-size="11" text-anchor="middle"><text x="210" y="232">0</text><text x="330" y="232">4</text><text x="450" y="232">8</text><text x="570" y="232">12</text><text x="690" y="232">16</text></g>
<line x1="120" y1="137" x2="700" y2="137" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4"/>
<rect x="210" y="70" width="144.3" height="26" rx="2" fill="var(--blue)"/>
<rect x="210" y="104" width="343.5" height="26" rx="2" fill="var(--muted)"/>
<rect x="210" y="150" width="160.8" height="26" rx="2" fill="var(--blue)"/>
<rect x="210" y="184" width="444.9" height="26" rx="2" fill="var(--muted)"/>
<g fill="var(--paper-ink)" font-size="12" text-anchor="end"><text x="200" y="88">BlueMagpie · CER</text><text x="200" y="122">參考模型 · CER</text><text x="200" y="168">BlueMagpie · WER</text><text x="200" y="202">參考模型 · WER</text></g>
<g font-size="12.5" font-weight="700"><text x="362" y="88" fill="var(--blue)">4.81</text><text x="561" y="122" fill="var(--paper-ink)">11.45</text><text x="378" y="168" fill="var(--blue)">5.36</text><text x="662" y="202" fill="var(--paper-ink)">14.83</text></g>
<g font-size="11.5" font-weight="700" fill="var(--green)"><text x="408" y="88">↓ 58.0% vs 參考模型</text><text x="424" y="168">↓ 63.9% vs 參考模型</text></g>
</svg>
<figcaption><b>圖 3.</b> 以「TTS → ASR 還原」這套流程量到的錯誤率。BlueMagpie-TTS 的 CER 4.81%、WER 5.36%，相對原本參考模型（11.45% / 14.83%）分別降低約 58.0% 與 63.9%。數字越低代表合成語音越能被正確聽寫回原文。</figcaption>
</figure>

相對原本的參考模型，字元錯誤率降低約 58.0%，詞錯誤率降低約 63.9%。

生成速度方面，每秒合成語音時長的中位數為 4.748 秒、最大為 5.288 秒（即時率，數值越大代表越快）。

最後再強調一次：以上數字都來自內部測試集，不是公開基準成績，只用於內部判斷模型好壞。

## 附錄：檔案、授權與連結

### 模型包含的檔案

| 檔案 | 內容 |
| --- | --- |
| `pytorch_model.bin` | BlueMagpie 模型權重 |
| `audiovae.pth` | AudioVAE 權重 |
| `config.json` | 架構與執行設定 |
| `tokenizer.json`、`tokenizer_config.json` | tokenizer 檔案 |
| `checkpoints/hung_yi_lee_speaker_centroids.pt` | 預設的李宏毅語者向量表 |
| `USAGE.md` | 進階使用說明 |

### 授權

程式碼採 Apache-2.0 授權。模型權重採 other 授權，附帶使用限制，重點是參考音訊與語者向量都必須先取得授權與同意，才能用於合成或散布。

### 連結

- 線上 Demo：<https://huggingface.co/spaces/voidful/BlueMagpie-TTS-Demo>
- 模型：<https://huggingface.co/OpenFormosa/BlueMagpie-TTS>
- 程式碼：<https://github.com/OpenFormosa/BlueMagpie-TTS>
- 文字模型 Barbet：<https://github.com/OpenFormosa/Barbet>
- 聲學模組 VoxCPM：<https://github.com/OpenBMB/VoxCPM>

## 結語

BlueMagpie-TTS 的設計可以用一句話記住：保留好用的聲學架構（VoxCPM），只換掉決定「說什麼」的腦袋（Barbet）。前者保留發音品質，後者帶來臺灣口音與中英夾雜的處理能力，兩者用橋接模組接起來。對使用者來說，重點只有兩件事：丟文字進去就能合成，需要指定聲音時給一段授權的參考音檔或語者向量。其餘都是看需要再用的進階控制。

</div>

<div class="post-lang-en" markdown="1">

<div class="post-abstract" markdown="1">

**Abstract**　BlueMagpie-TTS is a text-to-speech (TTS) model for Taiwanese-accent Chinese and Chinese–English code-switching, open-sourced by OpenFormosa. Its core design is a single sentence: keep a pretrained acoustic stack (taken from VoxCPM), and replace the original text-semantic language model with Barbet. Barbet decides *what to say* — text semantics, prosody planning, rhythm, and stress; the acoustic stack generates the fine-grained sound. The model ships with Prof. Hung-yi Lee's speaker vector as the default voice, used with his permission. On the test set, character error rate (CER) is 4.81% and word error rate (WER) is 5.36% — about 58.0% and 63.9% lower than the original reference model.

This article lets you listen first, then explains what it is, how it is assembled, how to use it, and where it still makes mistakes.

</div>

**Key points**

- **Keep the acoustics, swap the brain** — retain VoxCPM's pretrained acoustic stack as a whole, and replace only the text-semantic model that "decides what to say" with Barbet, joined by a bridge module.
- **Built for the Taiwanese context** — it targets two often-overlooked needs at once, Taiwanese-accent Chinese and Chinese–English mixing (code-switching), so a single model handles local accent and code-switching naturally.
- **Listenable and verifiable** — quality is measured by a closed loop: synthesize with TTS → transcribe back with Breeze-ASR-25 → compare character by character. The interactive demo below lets you hear it and see the transcription yourself.
- **Honest boundaries** — it is not a review-free, production-grade system; output can still be wrong, and reference audio and speaker vectors must be authorized before they can be used for synthesis or distribution.

## Listen first

Calling a speech model "good" means nothing — you have to hear it. The sentences below come from a 500-sentence set of "hard" Chinese sentences, deliberately seeded with English words, abbreviations, numbers, and proper nouns: exactly where everyday Taiwanese speech applications tend to break.

Our evaluation is a closed loop: hand the text to BlueMagpie-TTS to synthesize speech, hand the speech to Taiwan's Breeze-ASR-25 speech-recognition model to transcribe it back to text, and compare character by character. How far the two differ is the character error rate (CER).

<figure class="post-figure">
<svg viewBox="0 0 720 200" role="img" aria-labelledby="rt-en" xmlns="http://www.w3.org/2000/svg">
<title id="rt-en">Evaluation loop: synthesize, then transcribe back and compare</title>
<defs><marker id="m-rt-en" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 z" fill="var(--muted)"/></marker></defs>
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">How we evaluate: synthesize, then transcribe back and compare, character by character</text>
<rect x="8" y="44" width="104" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="60" y="70" text-anchor="middle" fill="var(--paper-ink)" font-size="13" font-weight="700">Input text</text>
<text x="60" y="87" text-anchor="middle" fill="var(--muted)" font-size="10">reference</text>
<line x1="114" y1="72" x2="132" y2="72" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-rt-en)"/>
<rect x="134" y="44" width="150" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<rect x="134" y="44" width="6" height="56" fill="var(--blue)"/>
<text x="212" y="70" text-anchor="middle" fill="var(--blue)" font-size="13" font-weight="700">BlueMagpie-TTS</text>
<text x="212" y="87" text-anchor="middle" fill="var(--muted)" font-size="10">text → speech</text>
<line x1="286" y1="72" x2="304" y2="72" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-rt-en)"/>
<rect x="306" y="44" width="96" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="354" y="70" text-anchor="middle" fill="var(--paper-ink)" font-size="13" font-weight="700">speech</text>
<g stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round"><line x1="336" y1="84" x2="336" y2="90"/><line x1="346" y1="80" x2="346" y2="94"/><line x1="356" y1="83" x2="356" y2="91"/><line x1="366" y1="78" x2="366" y2="96"/><line x1="376" y1="85" x2="376" y2="89"/></g>
<line x1="404" y1="72" x2="422" y2="72" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-rt-en)"/>
<rect x="424" y="44" width="150" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<rect x="424" y="44" width="6" height="56" fill="var(--green)"/>
<text x="502" y="70" text-anchor="middle" fill="var(--green)" font-size="13" font-weight="700">Breeze-ASR-25</text>
<text x="502" y="87" text-anchor="middle" fill="var(--muted)" font-size="10">speech → text</text>
<line x1="576" y1="72" x2="594" y2="72" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-rt-en)"/>
<rect x="596" y="44" width="116" height="56" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="654" y="70" text-anchor="middle" fill="var(--paper-ink)" font-size="13" font-weight="700">transcript</text>
<text x="654" y="87" text-anchor="middle" fill="var(--muted)" font-size="10">what ASR heard</text>
<path d="M654 100 V146 Q654 152 648 152 H66 Q60 152 60 146 V104" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#m-rt-en)"/>
<text x="357" y="170" text-anchor="middle" fill="var(--paper-ink)" font-size="12" font-weight="700">character-by-character comparison　=　CER</text>
</svg>
<figcaption><b>Figure 1.</b> The evaluation loop. The same text is synthesized by BlueMagpie-TTS, transcribed back by Breeze-ASR-25, and compared character by character to get CER. Each card below, when expanded, shows exactly what ASR heard in this loop.</figcaption>
</figure>

<div class="tts-demo" data-tts-demo><div class="tts-demo__head"><span class="tts-demo__title">Listen: real output on hard sentences</span><span class="tts-demo__hint">Press play to hear how the model reads each line; expand "What did ASR hear?" to see what Breeze-ASR-25 transcribes the audio back into. Speaker: Prof. Hung-yi Lee (used with permission).</span></div><ol class="tts-demo__list"><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">這個 <b>Transformer</b> 架構，其實就是現在所有聊天機器人的底層。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did ASR hear?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 heard</span><span class="tts-card__asr-v">這個 transformer 架構其實就是現在所有聊天機器人的底層</span><span class="tts-card__badge is-ok">Exact match</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0014.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">做完 <b>fine-tune</b>，我還跑了一輪 <b>ASR</b> 驗證確認字沒念錯。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did ASR hear?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 heard</span><span class="tts-card__asr-v">做完 fine-tune 我還跑了一輪 ASR 驗證確認字沒念錯</span><span class="tts-card__badge is-ok">Exact match</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0476.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">做語音合成研究，少不了一塊夠力的 <b>GPU</b> 跟一堆乾淨的語料。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did ASR hear?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 heard</span><span class="tts-card__asr-v">做語音合成研究少不了一塊夠力的 GPU 跟一堆乾淨的語料</span><span class="tts-card__badge is-ok">Exact match</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0301.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">我們把溫度調到 <b>0.85</b>，模型講話就從死板變得有人味了。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did ASR hear?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 heard</span><span class="tts-card__asr-v">我們把溫度調到 0.85 模型講話就從死板變得有人味了</span><span class="tts-card__badge is-ok">Exact match</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0002.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">大家都在喊 <b>AGI</b> 快來了，但連我自己都還搞不清楚我算不算。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did ASR hear?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 heard</span><span class="tts-card__asr-v">大家都在喊 AGI 快來了但連我自己都還搞不清楚我算不算</span><span class="tts-card__badge is-ok">Exact match</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0125.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">這套號稱能讓 <b>AI</b> 自己變強的方法，講穿了就是讓一個模型不斷去教另一個比較笨的模型，再回頭修自己。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did ASR hear?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 heard</span><span class="tts-card__asr-v">這套號稱能讓 AI 自己變強的方法講穿了就是讓一個模型不斷去教另一個比較笨的模型再回頭修自己</span><span class="tts-card__badge is-ok">Exact match</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0044.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>OpenAI</b> 我都直接念英文，可是 <b>TTS</b> 常把 open 跟 A I 黏在一起變成怪音。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did ASR hear?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 heard</span><span class="tts-card__asr-v">OpenAI 我都直接念英文可是 TTS 常把 open 跟 AI 黏在一起變成怪音</span><span class="tts-card__badge is-ok">Exact match</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0117.mp3' | relative_url }}"></audio></li></ol></div>

The last sentence is itself *about* how TTS tends to slur "open" and "AI" into one strange sound — and the model reads it correctly, with Breeze-ASR-25 cleanly recovering "OpenAI", "TTS", and "AI". That is exactly the code-switching problem this model is meant to solve.

**Want to try it yourself?** Open the [live demo (Hugging Face Space)](https://huggingface.co/spaces/voidful/BlueMagpie-TTS-Demo), drop in a Chinese–English mixed sentence, and hear the result in real time.

### It still makes mistakes

Defining the boundaries matters as much as defining the uses. The same hard test set also contains cases the model does not handle well. In the line below, `LLM` is not pronounced cleanly enough, and ASR hears it as "LOL and" — the boundaries of English abbreviations like this are still one of the model's weak spots.

<div class="tts-demo" data-tts-demo><div class="tts-demo__head"><span class="tts-demo__title">An honest case: abbreviation boundaries still slip</span><span class="tts-demo__hint">Expand to see the discrepancy that appears when ASR transcribes it back.</span></div><ol class="tts-demo__list"><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text">我把整篇逐字稿丟給 <b>LLM</b>，叫它幫我整理成三個重點。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did ASR hear?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">Breeze-ASR-25 heard</span><span class="tts-card__asr-v">把整篇逐字稿丟給 LOL and 叫他幫我整理成三個重點</span><span class="tts-card__badge is-warn">LLM heard as "LOL and"</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/bluemagpie/zhhard_0003.mp3' | relative_url }}"></audio></li></ol></div>

## 1. What this is

### 1.1 Why build this model

Speech applications in Taiwan have two often-overlooked needs: a Taiwanese accent, and Chinese–English mixing.

Take code-switching first. A single utterance can contain Chinese, English words, abbreviations, and proper nouns at once — this is the norm in Taiwan, but a hard problem for speech synthesis. Most off-the-shelf TTS models do well on pure Chinese or pure English, but stumble at the boundaries of code-switching.

Now the accent. Most models' Chinese leans toward other Mandarin accents, and does not sound the way people in Taiwan speak.

BlueMagpie-TTS targets both at once. Its goal is simple: let a single model naturally handle Taiwanese-accent Chinese and Chinese–English mixed speech generation.

### 1.2 What it can do

The model supports three usage scenarios, plus a streaming mode.

| Use | One-line description |
| --- | --- |
| General synthesis | Read the text out loud directly |
| Voice cloning | Given a reference clip, output a voice that imitates that speaker |
| Specified speaker | Control the timbre with a prepared speaker vector |
| Streaming output | Return audio chunks as they are synthesized, for real-time playback |

The most common is the first: feed in some text, get back speech. Everything else is optional advanced control.

### 1.3 What it cannot do

Defining the scope is as important as defining the use. Keep a few bottom lines in mind before using it.

First, it is not a review-free, production-grade system. Generated speech can be wrong, and without human review it should not be used directly for real-world notifications or public playback.

Second, authorization is a hard rule. The bundled Hung-yi Lee speaker vector is authorized and can be used directly as an example. But to clone anyone else's voice, or to use any other speaker vector, you must first obtain that person's permission. Speaker-vector tables and the synthesized audio must not be distributed publicly without authorization.

### 1.4 Where the name comes from

The full project name is OpenFormosa Blue Magpie TTS. "Blue Magpie" is taken from the Taiwan Blue Magpie (*Urocissa caerulea*). Choosing it as the mark has three layers of meaning: the Taiwan Blue Magpie has a loud, highly recognizable call, echoing the heart of TTS — turning text into sound; its signature long tail brings a visual sense of flow and extension; and OpenFormosa (Formosa) points to the project's footing in Taiwan and its focus on Taiwanese Mandarin.

## 2. What the model looks like

### 2.1 The core idea

A typical TTS model is one solid block: text goes in, speech comes out, and everything in between is trained together.

BlueMagpie-TTS takes a different path. It keeps an already-trained acoustic stack with good audio quality intact as a whole, and swaps out only the brain responsible for "deciding what to say," replacing it with Barbet.

The benefit is direct. Barbet brings text understanding and prosody planning; the acoustic stack retains the pronunciation detail it has already accumulated. Each does its own job.

<figure class="post-figure">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="arch-en" xmlns="http://www.w3.org/2000/svg">
<title id="arch-en">BlueMagpie-TTS architecture: keep the acoustics, swap the brain</title>
<defs><marker id="m-arch-en" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 z" fill="var(--muted)"/></marker></defs>
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">Keep the acoustic stack; swap only the brain that "decides what to say"</text>
<path d="M108 114 v-9 h128 v9" fill="none" stroke="var(--blue)" stroke-width="1.5"/>
<text x="172" y="97" text-anchor="middle" fill="var(--blue)" font-size="12" font-weight="700">swapped brain</text>
<path d="M372 114 v-9 h150 v9" fill="none" stroke="var(--green)" stroke-width="1.5"/>
<text x="447" y="97" text-anchor="middle" fill="var(--green)" font-size="12" font-weight="700">kept acoustic stack</text>
<rect x="10" y="130" width="74" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="47" y="160" text-anchor="middle" fill="var(--paper-ink)" font-size="14" font-weight="700">Text</text>
<text x="47" y="178" text-anchor="middle" fill="var(--muted)" font-size="10">input</text>
<line x1="86" y1="164" x2="106" y2="164" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-arch-en)"/>
<rect x="108" y="130" width="128" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<rect x="108" y="130" width="6" height="68" fill="var(--blue)"/>
<text x="174" y="156" text-anchor="middle" fill="var(--blue)" font-size="14" font-weight="700">Barbet</text>
<text x="174" y="174" text-anchor="middle" fill="var(--muted)" font-size="10">semantics · prosody</text>
<text x="174" y="189" text-anchor="middle" fill="var(--muted)" font-size="10">decides what to say</text>
<line x1="238" y1="164" x2="256" y2="164" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-arch-en)"/>
<rect x="258" y="130" width="92" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2" stroke-dasharray="5 4"/>
<text x="304" y="160" text-anchor="middle" fill="var(--paper-ink)" font-size="13" font-weight="700">Bridge</text>
<text x="304" y="178" text-anchor="middle" fill="var(--muted)" font-size="10">format glue</text>
<line x1="352" y1="164" x2="370" y2="164" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-arch-en)"/>
<rect x="372" y="130" width="150" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<rect x="372" y="130" width="6" height="68" fill="var(--green)"/>
<text x="450" y="156" text-anchor="middle" fill="var(--green)" font-size="14" font-weight="700">VoxCPM acoustic</text>
<text x="450" y="174" text-anchor="middle" fill="var(--muted)" font-size="10">turns plan into sound</text>
<text x="450" y="189" text-anchor="middle" fill="var(--muted)" font-size="10">pretrained, kept whole</text>
<line x1="524" y1="164" x2="542" y2="164" stroke="var(--muted)" stroke-width="1.5" marker-end="url(#m-arch-en)"/>
<rect x="544" y="130" width="166" height="68" rx="4" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>
<text x="627" y="156" text-anchor="middle" fill="var(--paper-ink)" font-size="14" font-weight="700">Waveform</text>
<g stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round"><line x1="571" y1="169" x2="571" y2="191"/><line x1="584" y1="163" x2="584" y2="197"/><line x1="597" y1="173" x2="597" y2="187"/><line x1="610" y1="160" x2="610" y2="200"/><line x1="623" y1="167" x2="623" y2="193"/><line x1="636" y1="164" x2="636" y2="196"/><line x1="649" y1="171" x2="649" y2="189"/><line x1="662" y1="161" x2="662" y2="199"/><line x1="675" y1="169" x2="675" y2="191"/><line x1="688" y1="174" x2="688" y2="186"/></g>
<text x="360" y="230" text-anchor="middle" fill="var(--muted)" font-size="11">Data flow: text → Barbet → bridge → VoxCPM acoustic → waveform</text>
</svg>
<figcaption><b>Figure 2.</b> The core design. The blue Barbet is the text-semantic brain that is "swapped in" — it decides what to say and how; the green VoxCPM acoustic stack is kept whole and turns the plan into actual sound. The bridge module in the middle translates between the two incompatible formats.</figcaption>
</figure>

### 2.2 Two off-the-shelf parts

BlueMagpie-TTS does not reinvent the wheel; it combines two off-the-shelf parts.

Barbet is the text-semantic language model, from [OpenFormosa/Barbet](https://github.com/OpenFormosa/Barbet). It is installed automatically from GitHub when you install this project.

The acoustic module is taken from [VoxCPM2](https://github.com/OpenBMB/VoxCPM) (OpenBMB, Apache-2.0). It is already bundled in the project (under `bluemagpie/_vendor/`) and needs no separate installation.

The two have incompatible internal formats. The bridge module's job is to translate one side's output into a form the other understands, so the interfaces connect.

## 3. Installation

Clone the project, then install in editable mode. The dependent Barbet package is installed automatically.

```bash
git clone https://github.com/OpenFormosa/BlueMagpie-TTS
cd BlueMagpie-TTS
pip install -e .
```

To save the synthesized audio as `.wav`, also install `soundfile`:

```bash
pip install soundfile
```

## 4. How to use it

This section is the heart of it. Below is how to load the model, synthesize speech, clone a voice, specify a speaker, and stream output.

### 4.1 Load the model

Download from Hugging Face and load:

```python
import os
from huggingface_hub import snapshot_download
from transformers import PreTrainedTokenizerFast
from bluemagpie import BlueMagpieModel

model_dir = snapshot_download("OpenFormosa/BlueMagpie-TTS", token=True)
# Load the tokenizer straight from tokenizer.json; compatible with newer transformers (5.x)
tokenizer = PreTrainedTokenizerFast(tokenizer_file=os.path.join(model_dir, "tokenizer.json"))
model = BlueMagpieModel.from_local(model_dir, tokenizer=tokenizer, training=False, device="cuda")
```

If you already have a local copy of the model files, point `model_dir` at that directory; everything else is the same. `device` can be `"cuda"` or `"cpu"`, and is chosen automatically if unset. Always use `training=False` for inference.

### 4.2 Basic synthesis: text to speech

The most basic use: give some text, get back speech. `target_text` can mix Chinese and English directly — the model handles the switching itself.

```python
import soundfile as sf

audio = model.generate(
    target_text="這是 AI TTS code switching 測試。",
    cfg_value=2.8,
    inference_timesteps=9,
    max_len=2000,
    retry_badcase=True,
)
sf.write("output.wav", audio.squeeze().cpu().numpy(), model.sample_rate)
```

This uses the recommended parameters (`cfg_value=2.8`, `inference_timesteps=9`). The code's original defaults are actually 2.0 and 10, but the former is recommended; see the parameter table below for why.

### 4.3 Voice cloning: imitate a speaker from a reference clip

Given a `reference_wav_path`, the output imitates the speaker timbre of that clip.

```python
audio = model.generate(
    target_text="今天的會議改到下午三點。",
    reference_wav_path="speaker.wav",
    cfg_value=2.8,
    inference_timesteps=9,
)
```

A reminder, again: only use voices you have the right to synthesize.

### 4.4 Specified speaker: control timbre with a speaker vector

The model ships with Prof. Hung-yi Lee's speaker vector as an example, used with his permission, stored at `checkpoints/hung_yi_lee_speaker_centroids.pt` in the model directory. Load the vector table, pull the vector for speaker ID `hung_yi_lee`, and pass it via `speaker_centroid` to set the timbre.

```python
import os
import torch

centroids = torch.load(
    os.path.join(model_dir, "checkpoints", "hung_yi_lee_speaker_centroids.pt"),
    map_location="cpu",
    weights_only=True,
)
speaker_centroid = centroids["centroids"][centroids["speaker_ids"].index("hung_yi_lee")]

audio = model.generate(
    target_text="今天天氣真好。",
    speaker_centroid=speaker_centroid,   # or pass your own authorized speaker vector
    cfg_value=2.8,
    inference_timesteps=9,
)
```

### 4.5 Streaming output

When you need to play while synthesizing, use `generate_streaming`. It is a generator that returns audio chunks one at a time.

```python
chunks = []
for chunk in model.generate_streaming(target_text="今天天氣真好。"):
    chunks.append(chunk)
    # play or write out the chunk in real time here
```

Note: automatic retry (`retry_badcase`) is not supported in streaming mode.

### 4.6 Four input modes

The features above are really different parameter combinations of the same `generate` interface. The table summarizes the four modes.

| Mode | Required parameters | Use |
| --- | --- | --- |
| General synthesis | `target_text` | Read the text out loud directly |
| Speech continuation | `target_text`, `prompt_text`, `prompt_wav_path` | Continue from an existing clip and its text |
| Reference clip | `target_text`, `reference_wav_path` | Imitate the speaker timbre of a reference clip |
| Reference + continuation | The above combined | Set the timbre and continue the speech at once |

### 4.7 Tuning the common parameters

Understand these few parameters and you can strike a balance between "stable" and "natural."

| Parameter | Default | Recommended | Description |
| --- | --- | --- | --- |
| `target_text` | (required) | | The text to synthesize |
| `prompt_text` | `""` | | Prompt text, paired with `prompt_wav_path` for continuation |
| `prompt_wav_path` | `""` | | Prompt-clip path, for speech continuation |
| `reference_wav_path` | `""` | | Reference-clip path, for voice cloning |
| `speaker_centroid` | `None` | | Speaker vector, for specifying timbre |
| `cfg_value` | `2.0` | `2.8` | Guidance strength. Higher follows the condition more closely, but too high is less natural |
| `inference_timesteps` | `10` | `9` | Sampling steps. More gives better quality but is slower |
| `min_len` / `max_len` | `2` / `2000` | | Lower and upper bounds on output length |
| `retry_badcase` | `False` | `True` | Auto-retry when an anomalous output is detected (not supported in streaming) |

The "Recommended" column is the officially tuned setting, also recorded in `generation_defaults` in `config.json`. This set was found using 500 hard Chinese sentences (the same batch demonstrated at the top of this article), together with Taiwan's Breeze-ASR-25 speech-recognition model, optimizing normalized CER.

### 4.8 A few practical tips

For long text, split it into sentence-sized pieces, synthesize each, then concatenate the waveforms — adding a little fade in/out at the seams if needed. For more continuity, pass a short authorized clip from the previous segment as a prompt when synthesizing the next.

It runs without a GPU. Set `device` to `"cpu"`; it is slower, but short sentences synthesize in tens of seconds. Output is 48 kHz mono.

If you do not pass a `tokenizer` and rely on auto-loading, it may fail to load under transformers 5.x, or only error with "No tokenizer attached" when you call `generate()`. Load straight from `tokenizer.json` and pass it in, as in the example above, to avoid this.

## 5. How well it works

On the internal test set, BlueMagpie-TTS performs as follows. Lower is better.

| System | CER | WER |
| --- | --- | --- |
| BlueMagpie-TTS | 4.81% | 5.36% |
| Original reference model | 11.45% | 14.83% |

<figure class="post-figure">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="cer-en" xmlns="http://www.w3.org/2000/svg">
<title id="cer-en">CER / WER vs. the reference model</title>
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">Character / word error rate (%, lower is better)</text>
<g stroke="var(--line)" stroke-width="1"><line x1="210" y1="56" x2="210" y2="214"/><line x1="330" y1="56" x2="330" y2="214"/><line x1="450" y1="56" x2="450" y2="214"/><line x1="570" y1="56" x2="570" y2="214"/><line x1="690" y1="56" x2="690" y2="214"/></g>
<g fill="var(--muted)" font-size="11" text-anchor="middle"><text x="210" y="232">0</text><text x="330" y="232">4</text><text x="450" y="232">8</text><text x="570" y="232">12</text><text x="690" y="232">16</text></g>
<line x1="120" y1="137" x2="700" y2="137" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4"/>
<rect x="210" y="70" width="144.3" height="26" rx="2" fill="var(--blue)"/>
<rect x="210" y="104" width="343.5" height="26" rx="2" fill="var(--muted)"/>
<rect x="210" y="150" width="160.8" height="26" rx="2" fill="var(--blue)"/>
<rect x="210" y="184" width="444.9" height="26" rx="2" fill="var(--muted)"/>
<g fill="var(--paper-ink)" font-size="12" text-anchor="end"><text x="200" y="88">BlueMagpie · CER</text><text x="200" y="122">reference · CER</text><text x="200" y="168">BlueMagpie · WER</text><text x="200" y="202">reference · WER</text></g>
<g font-size="12.5" font-weight="700"><text x="362" y="88" fill="var(--blue)">4.81</text><text x="561" y="122" fill="var(--paper-ink)">11.45</text><text x="378" y="168" fill="var(--blue)">5.36</text><text x="662" y="202" fill="var(--paper-ink)">14.83</text></g>
<g font-size="11.5" font-weight="700" fill="var(--green)"><text x="408" y="88">↓ 58.0% vs reference</text><text x="424" y="168">↓ 63.9% vs reference</text></g>
</svg>
<figcaption><b>Figure 3.</b> Error rates measured by the "TTS → ASR transcribe-back" loop. BlueMagpie-TTS reaches CER 4.81% and WER 5.36%, about 58.0% and 63.9% lower than the original reference model (11.45% / 14.83%). Lower means the synthesized speech is transcribed back to the original text more accurately.</figcaption>
</figure>

Relative to the original reference model, character error rate drops by about 58.0% and word error rate by about 63.9%.

On generation speed, the median real-time factor is 4.748 and the maximum 5.288 (seconds of audio produced per second of compute; higher is faster).

One last emphasis: all the numbers above come from an internal test set, not a public benchmark, and are used only for internal judgment of model quality.

## Appendix: files, license, and links

### Files included in the model

| File | Contents |
| --- | --- |
| `pytorch_model.bin` | BlueMagpie model weights |
| `audiovae.pth` | AudioVAE weights |
| `config.json` | Architecture and runtime settings |
| `tokenizer.json`, `tokenizer_config.json` | Tokenizer files |
| `checkpoints/hung_yi_lee_speaker_centroids.pt` | The default Hung-yi Lee speaker-vector table |
| `USAGE.md` | Advanced usage notes |

### License

The code is Apache-2.0. The model weights are under an "other" license with usage restrictions; the key point is that reference audio and speaker vectors must be authorized and consented to before they can be used for synthesis or distribution.

### Links

- Live demo: <https://huggingface.co/spaces/voidful/BlueMagpie-TTS-Demo>
- Model: <https://huggingface.co/OpenFormosa/BlueMagpie-TTS>
- Code: <https://github.com/OpenFormosa/BlueMagpie-TTS>
- Text model, Barbet: <https://github.com/OpenFormosa/Barbet>
- Acoustic module, VoxCPM: <https://github.com/OpenBMB/VoxCPM>

## Conclusion

BlueMagpie-TTS's design fits in one sentence: keep the acoustic stack that works (VoxCPM), and swap out only the brain that decides "what to say" (Barbet). The former preserves pronunciation quality; the latter brings the ability to handle Taiwanese accent and Chinese–English mixing; the two are joined by a bridge module. For users, only two things matter: feed in text to synthesize, and give an authorized reference clip or speaker vector when you need a specific voice. Everything else is optional advanced control.

</div>
