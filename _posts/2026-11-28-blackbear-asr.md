---
layout: post
title: "BlackBear-ASR: one open speech recognizer for Taiwanese Mandarin and Taiwanese"
zh_title: "BlackBear-ASR：一個模型，聽懂國語，也聽懂臺語"
i18n_key: blackbear_asr
description: "BlackBear-ASR is OpenFormosa's open speech recognition model for Taiwanese Mandarin and Taiwanese. It writes live captions as you speak and follows plain-text instructions."
zh_description: "BlackBear-ASR 是 OpenFormosa 社群的開源語音辨識模型：國語、臺語都聽得懂，可以一邊聽一邊出字，也能照文字指示調整輸出。"
keywords: "BlackBear-ASR, 臺語語音辨識, 台語語音辨識, Taiwanese ASR, Taigi speech recognition, 臺灣國語 ASR, 即時字幕, 開源語音辨識, Barbet, OpenFormosa"
date: 2026-11-28 18:00:00 +0800
category: research
tags: [asr, model, speech, blackbear]
model_name: BlackBear-ASR
og_image: /assets/img/og-blackbear-asr.png
og_image_alt: "BlackBear-ASR：聽得懂臺灣國語和臺語的開源語音辨識模型"
seo_video:
  url: /assets/video/blackbear-asr-showcase.mp4
  duration: PT1M18S
  name: "BlackBear-ASR 一分鐘示範"
seo_software:
  name: BlackBear-ASR
  code_repository: https://github.com/OpenFormosa/blackbear-asr
  model_url: https://huggingface.co/OpenFormosa/blackbear-asr
  programming_language: Python
  same_as:
    - https://huggingface.co/OpenFormosa/blackbear-asr
    - https://github.com/OpenFormosa/blackbear-asr
published: true
---

<div class="post-lang-zh" markdown="1">

<div class="post-abstract" markdown="1">

**摘要**　BlackBear-ASR 是 OpenFormosa 社群開源的語音辨識模型。它把臺灣國語和臺語的說話聲音轉成文字，可以一邊聽一邊出字，也能照你的文字指示調整輸出。模型由兩部分組成：一個從零訓練、2.2 億參數的串流聲學編碼器，負責「聽」；以及 OpenFormosa 的 Barbet 語言模型，負責「寫」。在 12 個系統的同場比較中，它是唯一國語、臺語都排進前三的模型。它也有明顯的弱點：很吵的環境、朗讀式國語、整句英語和日語。這篇文章先讓你看、讓你聽，再說明它怎麼運作、做得好和不好的地方。

</div>

**本文重點**

- **一個模型，兩種語言**：國語錯誤率 5.28（第 3），臺語 15.62（第 3），臺語夾英文 19.16（第 1）。
- **一邊聽一邊寫**：每 0.64 秒更新一次字幕，確定的字平均 1.28 秒後出現，之後不再修改。
- **聽得懂指令**：給專有名詞清單、幫別的辨識器改稿、問錄音裡有沒有某個詞，都是同一個模型。
- **弱點寫在前面**：噪音和人聲一樣大時，錯誤率從 5.20 升到 14.31，退步比所有對照系統都多。

<figure class="post-figure asr-flow" data-asr-flow data-scenes='[[&quot;請將這段語音逐字轉寫成文字。&quot;, &quot;穩定供水，一直是臺灣面臨的挑戰&quot;], [&quot;請將這段臺語語音寫成文字。&quot;, &quot;青翠的草地讓人看了很舒服。&quot;], [&quot;可能出現的詞：明細。&quot;, &quot;電子明細真的很煩&quot;], [&quot;這段音訊有沒有提到「好山好水」？&quot;, &quot;有&quot;], [&quot;說話者的音高大約多少？&quot;, &quot;音高偏高，基頻約 205 Hz。&quot;], [&quot;請將這段語音逐字轉寫成文字。&quot;, &quot;（沒有語音）&quot;]]' role="img" aria-label="BlackBear-ASR 運作流程動畫"><div class="asr-flow__row"><div class="asr-flow__stage asr-flow__wave"><span class="asr-flow__k">聲音</span><div class="asr-flow__bars" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="asr-flow__chunks" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><span class="asr-flow__note">每 0.64 秒切一塊</span></div><div class="asr-flow__arrow" aria-hidden="true"><span></span></div><div class="asr-flow__stage asr-flow__box asr-flow__ear"><span class="asr-flow__k">耳朵</span><b>串流聲學編碼器</b><span class="asr-flow__note">2.2 億參數，只聽已經發生的聲音</span><div class="asr-flow__notes" aria-hidden="true"><span></span><span></span><span></span></div></div><div class="asr-flow__arrow" aria-hidden="true"><span></span></div><div class="asr-flow__stage asr-flow__box asr-flow__pen"><span class="asr-flow__k">筆</span><b>Barbet 語言模型</b><span class="asr-flow__note">11.2 億參數，照指令寫字</span><span class="asr-flow__chip" data-flow-instr>請將這段語音逐字轉寫成文字。</span></div><div class="asr-flow__arrow" aria-hidden="true"><span></span></div><div class="asr-flow__stage asr-flow__out"><span class="asr-flow__k">輸出</span><p class="asr-flow__text" data-flow-out>穩定供水，一直是臺灣面臨的挑戰</p></div></div><figcaption><b>BlackBear-ASR 的分工。</b>「耳朵」每 0.64 秒把聲音整理成筆記，「筆」讀筆記，再照你的指令寫出結果。動畫裡的指令和輸出都是模型的實際例子。</figcaption></figure>

## 先看一分鐘

<figure class="post-figure asr-video">
<video controls preload="metadata" playsinline aria-label="BlackBear-ASR 一分鐘示範" src="{{ '/assets/video/blackbear-asr-showcase.mp4' | relative_url }}"></video>
<figcaption>一分鐘看完 BlackBear-ASR 能做的事。片中文字皆為模型實際輸出，示範句經過挑選；示範音檔來自 Common Voice（CC0）。</figcaption>
</figure>

## 再聽聽看

下面每一段都是同一個 BlackBear-ASR，只換了一句指令。

<div class="tts-demo" data-tts-demo><div class="tts-demo__head"><span class="tts-demo__title">聽聽看：每段錄音和模型的實際輸出</span><span class="tts-demo__hint">按播放鍵聽錄音，再展開「模型寫出什麼？」看 BlackBear-ASR 的輸出。示範錄音取自 Common Voice（CC0），「沒有語音」是我們自己產生的雜訊。輸出都是模型實際寫出的文字。</span></div><ol class="tts-demo__list"><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>國語轉寫</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">穩定供水，一直是臺灣面臨的挑戰</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-transcribe.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>臺語寫成中文字幕</b>　請將這段臺語語音寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">青翠的草地讓人看了很舒服。<br><small>（Common Voice 的臺語原文：青翠的草埔，予人看著真爽快）</small></span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/nan-transcribe.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>專有名詞</b>　可能出現的詞：明細。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">沒給專有名詞：電子遊戲真的很煩<br>給了「明細」：<b>電子明細</b>真的很煩</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-hotwords.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>問問題</b>　這段音訊有沒有提到「好山好水」？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">有</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-keyword.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>問情緒</b>　說話者的情緒是什麼？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">中性偏正面，帶有欣賞與些許的興奮感。<br><small>（情緒描述沒有經過評測，請當作參考）</small></span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-emotion.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>音高</b>　說話者的音高大約多少？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">音高偏高，基頻約 205 Hz。</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-pitch.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>兩人同時講</b>　這段音訊有幾位說話者？有沒有人同時說話？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">兩位說話者，有重疊說話。<br><small>（直接轉寫時，兩個人的話會混在一起，這是目前的限制）</small></span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-overlap.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>沒有語音</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">（沒有語音）</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/nospeech.mp3' | relative_url }}"></audio></li></ol></div>

### 換一句指令，結果就不同

同一段錄音，給不給專有名詞，寫出來的字就不一樣。按播放聽聽看，再切換上面的按鈕。

<figure class="post-figure asr-toggle" data-asr-toggle data-states='[[&quot;請將這段語音逐字轉寫成文字。&quot;, &quot;電子&lt;mark&gt;遊戲&lt;/mark&gt;真的很煩&quot;], [&quot;請將這段語音逐字轉寫成文字。可能出現的詞：明細。&quot;, &quot;電子&lt;mark&gt;明細&lt;/mark&gt;真的很煩&quot;]]'><div class="asr-toggle__head"><button type="button" class="tts-card__play" data-toggle-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="asr-toggle__seg" role="group"><button type="button" data-v="0" aria-pressed="true">不給專有名詞</button><button type="button" data-v="1" aria-pressed="false">給「明細」</button></div></div><p class="asr-toggle__instr" data-toggle-instr>請將這段語音逐字轉寫成文字。</p><p class="asr-toggle__out" data-toggle-out>電子<mark>遊戲</mark>真的很煩</p><audio preload="none" src="{{ '/assets/audio/blackbear/zh-hotwords.mp3' | relative_url }}"></audio><figcaption>錄音取自 Common Voice（CC0）。兩個結果都是模型的實際輸出。</figcaption></figure>

## 它怎麼運作

想像兩個人合作做聽打。

「耳朵」是串流聲學編碼器。它每 0.64 秒把聽到的聲音整理成一小段「聲音筆記」。它只聽已經發生的聲音，不偷看後面，所以可以即時工作。

「筆」是 Barbet 語言模型。它讀這些聲音筆記，再依照你的文字指示寫出結果：要不要標點、哪些專有名詞要寫對、要不要回答問題。

為什麼要這樣分工？因為「筆」看得懂文字。新的用途只要換一句指令，不需要另外訓練一個模型。

### 看它一邊聽一邊寫

按下播放，字幕會跟著聲音出現。深色的字已經確定，不會再改；淺色的字是模型這一刻的猜測，還可能改變。播完後，模型會把整段重新寫一次，作為最後結果。這些都是模型真實的輸出。

<figure class="post-figure asr-replay" data-asr-replay data-final-label="最後結果"><div class="asr-replay__tabs" role="tablist"><button type="button" role="tab" data-clip="zh-transcribe" aria-selected="true">國語</button><button type="button" role="tab" data-clip="nan-transcribe" aria-selected="false">臺語</button></div><div class="asr-replay__screen" aria-live="polite"><p class="asr-replay__line"><span class="asr-stream__c" data-replay-c></span><span class="asr-stream__p" data-replay-p></span></p></div><div class="asr-replay__ctrl"><button type="button" class="tts-card__play asr-replay__play" data-replay-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="asr-stream__ticks" data-replay-ticks aria-hidden="true"></div><span class="asr-replay__time" data-replay-time>0.0 s</span></div><p class="asr-stream__legend"><span class="is-c">已確定</span><span class="is-p">暫定（可能會改）</span></p><audio preload="none" data-clip="zh-transcribe" src="{{ '/assets/audio/blackbear/zh-transcribe.mp3' | relative_url }}"></audio><audio preload="none" data-clip="nan-transcribe" src="{{ '/assets/audio/blackbear/nan-transcribe.mp3' | relative_url }}"></audio><script type="application/json" data-replay-events>{{ site.data.blackbear_stream | jsonify }}</script><figcaption>每 0.64 秒更新一次。相鄰兩次結果開頭相同的部分才會確定。錄音取自 Common Voice（CC0），文字是 BlackBear-ASR 實際的串流輸出。</figcaption></figure>

## 自己試試看

上傳一段錄音，或直接用麥克風錄，選擇國語或臺語，再選一個功能。錄音只用來產生這次的結果，不會被保存。

<figure class="post-figure asr-try" data-asr-try><div class="asr-try__frame"><div class="asr-try__loading" role="status" aria-live="polite"><span class="asr-try__spinner" aria-hidden="true"></span><p class="asr-try__msg">正在載入線上試用⋯</p><p class="asr-try__slow">模型可能在休眠，第一次喚醒約需 30 秒到 1 分鐘。等太久可以<a href="https://huggingface.co/spaces/voidful/blackbear-asr-demo" target="_blank" rel="noopener">在新分頁打開試用</a>。</p></div><iframe onload="this.closest('[data-asr-try]').classList.add('is-loaded')" src="https://voidful-blackbear-asr-demo.hf.space" title="BlackBear-ASR 線上試用" loading="lazy" allow="microphone; clipboard-write" referrerpolicy="no-referrer"></iframe></div><figcaption>線上試用放在 Hugging Face。第一次使用可能要等一下讓模型載入。看不到畫面時，請<a href="https://huggingface.co/spaces/voidful/blackbear-asr-demo">在新分頁打開</a>。</figcaption></figure>

## 做得好的地方

我們把 BlackBear-ASR 和 11 個公開或本土模型放在同一批錄音上比較。數字是錯誤率：每 100 個字錯幾個，越低越好。

<figure class="post-figure">
<div class="asr-chart" role="img" aria-label="錯誤率 %（越低越好）：國語、臺語都要聽得懂">
<p class="asr-chart__title">錯誤率 %（越低越好）：國語、臺語都要聽得懂</p>
<p class="asr-chart__group">臺灣國語（自建，1,000 句）</p>
<div class="asr-chart__row is-ours"><span class="asr-chart__name">BlackBear-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:7.5%"></span><span class="asr-chart__val">5.28</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Qwen3-ASR-1.7B</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:7.0%"></span><span class="asr-chart__val">4.89</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MiMo-V2.5-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:6.9%"></span><span class="asr-chart__val">4.85</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Breeze-ASR-25</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:9.9%"></span><span class="asr-chart__val">6.95</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Breeze-ASR-26</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:13.2%"></span><span class="asr-chart__val">9.25</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MINNASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:11.5%"></span><span class="asr-chart__val">8.03</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Whisper large-v3</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:10.8%"></span><span class="asr-chart__val">7.53</span></span></div>
<p class="asr-chart__group">臺語寫成中文（自建，1,000 句）</p>
<div class="asr-chart__row is-ours"><span class="asr-chart__name">BlackBear-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:22.3%"></span><span class="asr-chart__val">15.62</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Qwen3-ASR-1.7B</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:87.4%"></span><span class="asr-chart__val">61.19</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MiMo-V2.5-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:80.5%"></span><span class="asr-chart__val">56.37</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Breeze-ASR-25</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:65.3%"></span><span class="asr-chart__val">45.72</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Breeze-ASR-26</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:11.8%"></span><span class="asr-chart__val">8.29</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MINNASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:11.2%"></span><span class="asr-chart__val">7.81</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Whisper large-v3</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:73.1%"></span><span class="asr-chart__val">51.15</span></span></div>
</div>
<figcaption><b>國語做得最好的系統，臺語錯誤率都超過 55；臺語做得最好的系統，國語錯誤率是 8 到 9。</b>BlackBear-ASR 兩項都排第 3。圖中列出 12 個系統中的 7 個。自建測試集的參考答案經其他辨識器交叉核對，對參與核對的系統（Qwen3-ASR、Breeze-ASR）較有利。</figcaption>
</figure>

同一個模型，換一句指令就能做下面這些事。每一項都註明測試集和筆數。

| 用途 | 結果 | 測試條件 |
|---|---|---|
| 臺語夾英文 | 錯誤率 **19.16**，第 1；第 2 名 44.01 | 429 句 |
| 國語夾英文、夾日文 | 錯誤率 28.74、29.28 | 各 300 句 |
| 沒有語音時不亂寫 | **100 %** 回答「（沒有語音）」；其他系統最好 83.1 % | 480 段環境音 |
| 先給專有名詞清單 | 罕見詞寫對 87.2 % → **98.3 %** | 自建國語 239 段、461 個罕見詞 |
| 幫別的辨識器改稿 | Whisper large-v3 草稿 7.47 → **4.33** | 自建國語 250 段 |
| 問有沒有提到某個詞 | 答對 **99.2 %** | 自建國語，有／沒有各 250 題 |
| 問是什麼語言 | 國語 100 %、臺語 100 % | 自建國語 250 段、臺語 150 段 |
| 問聲音高低 | 和實測音高的相關係數 0.971 | 自建國語 245 段 |
| 不要加標點 | 99.6 % 沒有標點 | 自建國語 250 段 |
| 輸出 JSON | 100 % 可以被程式讀取 | 自建國語 250 段 |
| 即時字幕 | 延遲 1.28 秒；錯誤率 6.52（講完再辨識是 3.64） | Common Voice 國語開發集 100 段 |
| 兩人同時講話 | 可以分成兩行；主講者錯誤率 6.83 | 150 段兩人重疊錄音 |
| 問情緒 | 會回答，但沒有量化驗證，只能當參考 | — |
{: .asr-table}

## 還不夠好的地方

我們把弱點寫得和優點一樣清楚，方便你判斷適不適合你的用途。

<figure class="post-figure">
<div class="asr-chart" role="img" aria-label="加入噪音後的錯誤率 %（自建國語，300 句）">
<p class="asr-chart__title">加入噪音後的錯誤率 %（自建國語，300 句）</p>
<p class="asr-chart__group">安靜</p>
<div class="asr-chart__row is-ours"><span class="asr-chart__name">BlackBear-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:32.5%"></span><span class="asr-chart__val">5.2</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Qwen3-ASR-1.7B</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:30.7%"></span><span class="asr-chart__val">4.91</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MiMo-V2.5-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:30.6%"></span><span class="asr-chart__val">4.89</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Whisper large-v3</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:46.0%"></span><span class="asr-chart__val">7.36</span></span></div>
<p class="asr-chart__group">噪音和人聲一樣大（0 dB）</p>
<div class="asr-chart__row is-ours"><span class="asr-chart__name">BlackBear-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:89.4%"></span><span class="asr-chart__val">14.31</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Qwen3-ASR-1.7B</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:46.0%"></span><span class="asr-chart__val">7.36</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MiMo-V2.5-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:51.4%"></span><span class="asr-chart__val">8.22</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Whisper large-v3</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:71.1%"></span><span class="asr-chart__val">11.38</span></span></div>
</div>
<figcaption><b>BlackBear-ASR 在安靜環境和最好的系統差不多，但加了噪音退步最多。</b>從 5.20 升到 14.31，增加 9.11；對照系統增加 2.5 到 5.1。</figcaption>
</figure>

| 情況 | 表現 | 建議 |
|---|---|---|
| 朗讀式國語 | Common Voice 9.17（第 8）、FormosaSpeech 11.85（第 9） | 朗讀稿、有聲書可考慮其他系統 |
| 整句英語、日語 | 錯誤率 49.03、44.42（各 500 句） | 請用其他系統 |
| 客語 | 錯誤率 55.91（500 句），實驗功能 | 暫不建議 |
| 自動判斷語言、歌詞 | 實驗功能，這一版沒有量測歌詞 | 暫不建議 |
| 兩人同時講話 | 第二位的錯誤明顯較多 | 重要場合請人工校對 |
| 臺語的寫法 | 輸出是中文字幕，不是臺語漢字或臺羅 | 需要臺語正字時請另外轉換 |
{: .asr-table}

## 開始使用

只想試試看：打開[線上試用](https://huggingface.co/spaces/voidful/blackbear-asr-demo)，上傳一段錄音。

想在自己的電腦上用，三行就夠：

```python
from blackbear_ice.api import BlackBearASR
asr = BlackBearASR.from_pretrained("OpenFormosa/blackbear-asr")
print(asr.transcribe("audio.wav", language="nan"))
```

[GitHub](https://github.com/OpenFormosa/blackbear-asr) 上有五篇教學：安裝、基本使用、指令控制、即時字幕與批次、用自己的錄音微調。程式碼和權重都以 Apache 2.0 授權。從 [Hugging Face](https://huggingface.co/OpenFormosa/blackbear-asr) 下載權重前，需要先填寫申請表並同意[可接受使用政策]({{ '/acceptable-use/' | relative_url }})，送出後會自動核准。

## 常見問題

### 有沒有開源、聽得懂臺語（台語）的語音辨識模型？

有。BlackBear-ASR 是開源的語音辨識模型，同一個模型就能辨識臺灣國語和臺語。在 12 個系統的同場比較中，它的國語錯誤率 5.28、臺語 15.62，兩項都排第 3；臺語夾英文 19.16，排第 1。

### 可以商用嗎？

可以。程式碼和權重都以 Apache 2.0 授權。從 Hugging Face 下載權重前，要先填申請表並同意可接受使用政策，送出後自動核准。

### 可以做即時字幕嗎？

可以。模型每 0.64 秒更新一次字幕，確定的字平均 1.28 秒後出現，之後不再修改。即時模式的錯誤率是 6.52，講完再辨識是 3.64。

### 臺語會寫成什麼字？

臺語會寫成中文字幕，不是臺語漢字或臺羅拼音。需要臺語正字時，請另外轉換。

### 什麼情況下不建議用？

很吵的環境、朗讀式國語、整句英語或日語、客語。噪音和人聲一樣大時，錯誤率從 5.20 升到 14.31。

## 數字怎麼來的

所有系統用同一批錄音、同一套計分方式，各自使用官方預設的解碼設定。比對前，雙方都統一轉成繁體、去掉標點、數字轉成中文。國語和臺語測試集是我們自己整理的，錄音沒有出現在訓練資料中。Common Voice、FormosaSpeech、ML2021 是公開資料，任何人都可以重現。模型版本是 R12，每一項只跑一次。

## 致謝

BlackBear-ASR 屬於 OpenFormosa 社群。感謝 Taipei-1、臺大語音實驗室（NTU Speech Lab）與 NTU SPML Lab 的支持，也謝謝每一位貢獻者。歡迎到 [Discord]({{ '/community/' | relative_url }}) 回報問題、分享使用情境，一起改進它。

</div>

<div class="post-lang-en" markdown="1">

<div class="post-abstract" markdown="1">

**Abstract**　BlackBear-ASR is an open speech recognition model from the OpenFormosa community. It transcribes Taiwanese Mandarin and Taiwanese, writes live captions as you speak, and follows plain-text instructions. A streaming acoustic encoder trained from scratch (220M parameters) listens; OpenFormosa's Barbet language model writes. Among 12 systems, it is the only one in the top three for both Mandarin and Taiwanese. It also has clear weaknesses: heavy noise, read-aloud Mandarin, and full English or Japanese sentences.

</div>

<figure class="post-figure asr-flow" data-asr-flow data-scenes='[[&quot;請將這段語音逐字轉寫成文字。&quot;, &quot;穩定供水，一直是臺灣面臨的挑戰&quot;], [&quot;請將這段臺語語音寫成文字。&quot;, &quot;青翠的草地讓人看了很舒服。&quot;], [&quot;可能出現的詞：明細。&quot;, &quot;電子明細真的很煩&quot;], [&quot;這段音訊有沒有提到「好山好水」？&quot;, &quot;有&quot;], [&quot;說話者的音高大約多少？&quot;, &quot;音高偏高，基頻約 205 Hz。&quot;], [&quot;請將這段語音逐字轉寫成文字。&quot;, &quot;（沒有語音）&quot;]]' role="img" aria-label="Animation of how BlackBear-ASR works"><div class="asr-flow__row"><div class="asr-flow__stage asr-flow__wave"><span class="asr-flow__k">Audio</span><div class="asr-flow__bars" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="asr-flow__chunks" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><span class="asr-flow__note">one chunk every 0.64 s</span></div><div class="asr-flow__arrow" aria-hidden="true"><span></span></div><div class="asr-flow__stage asr-flow__box asr-flow__ear"><span class="asr-flow__k">Ear</span><b>Streaming acoustic encoder</b><span class="asr-flow__note">220M parameters, never looks ahead</span><div class="asr-flow__notes" aria-hidden="true"><span></span><span></span><span></span></div></div><div class="asr-flow__arrow" aria-hidden="true"><span></span></div><div class="asr-flow__stage asr-flow__box asr-flow__pen"><span class="asr-flow__k">Pen</span><b>Barbet language model</b><span class="asr-flow__note">1.12B parameters, follows your instruction</span><span class="asr-flow__chip" data-flow-instr>請將這段語音逐字轉寫成文字。</span></div><div class="asr-flow__arrow" aria-hidden="true"><span></span></div><div class="asr-flow__stage asr-flow__out"><span class="asr-flow__k">Output</span><p class="asr-flow__text" data-flow-out>穩定供水，一直是臺灣面臨的挑戰</p></div></div><figcaption><b>How BlackBear-ASR splits the work.</b> The ear turns every 0.64 s of audio into notes; the pen reads them and writes what your instruction asks for. Instructions and outputs are real model examples.</figcaption></figure>

## Watch

<figure class="post-figure asr-video">
<video controls preload="metadata" playsinline aria-label="BlackBear-ASR 一分鐘示範" src="{{ '/assets/video/blackbear-asr-showcase.mp4' | relative_url }}"></video>
<figcaption>BlackBear-ASR in one minute. All on-screen text is real model output from selected clips; demo audio is from Common Voice (CC0).</figcaption>
</figure>

## Listen

<div class="tts-demo" data-tts-demo><div class="tts-demo__head"><span class="tts-demo__title">Listen: recordings and real model output</span><span class="tts-demo__hint">Play a clip, then expand to see what BlackBear-ASR wrote. Demo clips: Common Voice (CC0); the no-speech clip is noise we generated. Every output is what the model actually wrote.</span></div><ol class="tts-demo__list"><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Mandarin</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">穩定供水，一直是臺灣面臨的挑戰<br><small>(A stable water supply has always been a challenge for Taiwan.)</small></span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-transcribe.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Taiwanese to Mandarin captions</b>　請將這段臺語語音寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">青翠的草地讓人看了很舒服。<br><small>(Common Voice Taiwanese text: 青翠的草埔，予人看著真爽快. "The green grass is pleasant to look at.")</small></span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/nan-transcribe.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Hotwords</b>　可能出現的詞：明細。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">Without hotwords: 電子遊戲真的很煩<br>With 「明細」: <b>電子明細</b>真的很煩</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-hotwords.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Keyword question</b>　這段音訊有沒有提到「好山好水」？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">有 (yes)</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-keyword.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Emotion</b>　說話者的情緒是什麼？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">中性偏正面，帶有欣賞與些許的興奮感。<br><small>(Neutral to positive, appreciative, a little excited. Emotion answers are not evaluated; treat them as hints.)</small></span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-emotion.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Pitch</b>　說話者的音高大約多少？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">音高偏高，基頻約 205 Hz。<br><small>(High pitch, about 205 Hz.)</small></span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-pitch.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Two speakers</b>　這段音訊有幾位說話者？有沒有人同時說話？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">兩位說話者，有重疊說話。<br><small>(Two speakers, overlapping. Plain transcription mixes the two voices; this is a current limitation.)</small></span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-overlap.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>No speech</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">（沒有語音）<br><small>(no speech)</small></span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/nospeech.mp3' | relative_url }}"></audio></li></ol></div>

### One instruction changes the output

Same recording, with and without a hotword. Play the clip and switch the buttons.

<figure class="post-figure asr-toggle" data-asr-toggle data-states='[[&quot;請將這段語音逐字轉寫成文字。&quot;, &quot;電子&lt;mark&gt;遊戲&lt;/mark&gt;真的很煩&quot;], [&quot;請將這段語音逐字轉寫成文字。可能出現的詞：明細。&quot;, &quot;電子&lt;mark&gt;明細&lt;/mark&gt;真的很煩&quot;]]'><div class="asr-toggle__head"><button type="button" class="tts-card__play" data-toggle-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="asr-toggle__seg" role="group"><button type="button" data-v="0" aria-pressed="true">No hotword</button><button type="button" data-v="1" aria-pressed="false">Hotword 「明細」</button></div></div><p class="asr-toggle__instr" data-toggle-instr>請將這段語音逐字轉寫成文字。</p><p class="asr-toggle__out" data-toggle-out>電子<mark>遊戲</mark>真的很煩</p><audio preload="none" src="{{ '/assets/audio/blackbear/zh-hotwords.mp3' | relative_url }}"></audio><figcaption>Audio: Common Voice (CC0). Both results are real model output.</figcaption></figure>

## How it works

The encoder turns every 0.64 s of audio into a short summary and never looks ahead, so it runs live. Barbet reads those summaries together with your instruction and writes the result. A new use needs a new instruction, not a new model.

### Watch it write while it listens

Press play. Dark text is committed and never revised; light text is the model's current guess. When the clip ends, the model rewrites the whole clip once as the final result. All of it is real model output.

<figure class="post-figure asr-replay" data-asr-replay data-final-label="Final"><div class="asr-replay__tabs" role="tablist"><button type="button" role="tab" data-clip="zh-transcribe" aria-selected="true">Mandarin</button><button type="button" role="tab" data-clip="nan-transcribe" aria-selected="false">Taiwanese</button></div><div class="asr-replay__screen" aria-live="polite"><p class="asr-replay__line"><span class="asr-stream__c" data-replay-c></span><span class="asr-stream__p" data-replay-p></span></p></div><div class="asr-replay__ctrl"><button type="button" class="tts-card__play asr-replay__play" data-replay-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="asr-stream__ticks" data-replay-ticks aria-hidden="true"></div><span class="asr-replay__time" data-replay-time>0.0 s</span></div><p class="asr-stream__legend"><span class="is-c">Committed</span><span class="is-p">Tentative (may change)</span></p><audio preload="none" data-clip="zh-transcribe" src="{{ '/assets/audio/blackbear/zh-transcribe.mp3' | relative_url }}"></audio><audio preload="none" data-clip="nan-transcribe" src="{{ '/assets/audio/blackbear/nan-transcribe.mp3' | relative_url }}"></audio><script type="application/json" data-replay-events>{{ site.data.blackbear_stream | jsonify }}</script><figcaption>Updates every 0.64 s. Text two consecutive updates agree on is committed. Audio: Common Voice (CC0). Text: real BlackBear-ASR streaming output.</figcaption></figure>

## Try it yourself

Upload a clip or record one with your microphone, pick Mandarin or Taiwanese, then pick a task. Your recording is used only for this result and is not stored.

<figure class="post-figure asr-try" data-asr-try><div class="asr-try__frame"><div class="asr-try__loading" role="status" aria-live="polite"><span class="asr-try__spinner" aria-hidden="true"></span><p class="asr-try__msg">Loading the online demo…</p><p class="asr-try__slow">The model may be asleep; the first wake-up takes about 30 seconds to a minute. If it takes too long, <a href="https://huggingface.co/spaces/voidful/blackbear-asr-demo" target="_blank" rel="noopener">open the demo in a new tab</a>.</p></div><iframe onload="this.closest('[data-asr-try]').classList.add('is-loaded')" src="https://voidful-blackbear-asr-demo.hf.space" title="BlackBear-ASR online demo" loading="lazy" allow="microphone; clipboard-write" referrerpolicy="no-referrer"></iframe></div><figcaption>The demo runs on Hugging Face; the first request may take a moment while the model loads. If it does not show, <a href="https://huggingface.co/spaces/voidful/blackbear-asr-demo">open it in a new tab</a>.</figcaption></figure>

## Results

<figure class="post-figure">
<div class="asr-chart" role="img" aria-label="Error rate % (lower is better): Mandarin and Taiwanese">
<p class="asr-chart__title">Error rate % (lower is better): Mandarin and Taiwanese</p>
<p class="asr-chart__group">Taiwanese Mandarin (in-house, 1,000)</p>
<div class="asr-chart__row is-ours"><span class="asr-chart__name">BlackBear-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:7.5%"></span><span class="asr-chart__val">5.28</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Qwen3-ASR-1.7B</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:7.0%"></span><span class="asr-chart__val">4.89</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MiMo-V2.5-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:6.9%"></span><span class="asr-chart__val">4.85</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Breeze-ASR-25</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:9.9%"></span><span class="asr-chart__val">6.95</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Breeze-ASR-26</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:13.2%"></span><span class="asr-chart__val">9.25</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MINNASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:11.5%"></span><span class="asr-chart__val">8.03</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Whisper large-v3</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:10.8%"></span><span class="asr-chart__val">7.53</span></span></div>
<p class="asr-chart__group">Taiwanese → Mandarin captions (in-house, 1,000)</p>
<div class="asr-chart__row is-ours"><span class="asr-chart__name">BlackBear-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:22.3%"></span><span class="asr-chart__val">15.62</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Qwen3-ASR-1.7B</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:87.4%"></span><span class="asr-chart__val">61.19</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MiMo-V2.5-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:80.5%"></span><span class="asr-chart__val">56.37</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Breeze-ASR-25</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:65.3%"></span><span class="asr-chart__val">45.72</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Breeze-ASR-26</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:11.8%"></span><span class="asr-chart__val">8.29</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MINNASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:11.2%"></span><span class="asr-chart__val">7.81</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Whisper large-v3</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:73.1%"></span><span class="asr-chart__val">51.15</span></span></div>
</div>
<figcaption><b>The best Mandarin systems score above 55 on Taiwanese; the best Taiwanese systems score 8 to 9 on Mandarin.</b> BlackBear-ASR ranks third on both. In-house references were cross-checked with other recognizers, which favors those systems (Qwen3-ASR, Breeze-ASR).</figcaption>
</figure>

| Use | Result | Test set |
|---|---|---|
| Taiwanese with English words | **19.16**, 1st; runner-up 44.01 | 429 utterances |
| No speech | **100 %** answer "no speech"; best other 83.1 % | 480 clips |
| Hotword list | rare words correct 87.2 % → **98.3 %** | in-house Mandarin, 239 clips, 461 words |
| Correcting a Whisper draft | 7.47 → **4.33** | in-house Mandarin, 250 clips |
| Keyword question | **99.2 %** correct | 250 yes + 250 no |
| Live captions | 1.28 s latency; 6.52 vs 3.64 offline | Common Voice zh-TW dev, 100 clips |
| No punctuation / JSON | 99.6 % / 100 % valid | in-house Mandarin, 250 clips |
{: .asr-table}

## Limitations

<figure class="post-figure">
<div class="asr-chart" role="img" aria-label="Error rate % with added noise (in-house Mandarin, 300)">
<p class="asr-chart__title">Error rate % with added noise (in-house Mandarin, 300)</p>
<p class="asr-chart__group">Clean</p>
<div class="asr-chart__row is-ours"><span class="asr-chart__name">BlackBear-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:32.5%"></span><span class="asr-chart__val">5.2</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Qwen3-ASR-1.7B</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:30.7%"></span><span class="asr-chart__val">4.91</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MiMo-V2.5-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:30.6%"></span><span class="asr-chart__val">4.89</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Whisper large-v3</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:46.0%"></span><span class="asr-chart__val">7.36</span></span></div>
<p class="asr-chart__group">Noise as loud as speech (0 dB)</p>
<div class="asr-chart__row is-ours"><span class="asr-chart__name">BlackBear-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:89.4%"></span><span class="asr-chart__val">14.31</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Qwen3-ASR-1.7B</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:46.0%"></span><span class="asr-chart__val">7.36</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">MiMo-V2.5-ASR</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:51.4%"></span><span class="asr-chart__val">8.22</span></span></div>
<div class="asr-chart__row"><span class="asr-chart__name">Whisper large-v3</span><span class="asr-chart__track"><span class="asr-chart__bar" style="--v:71.1%"></span><span class="asr-chart__val">11.38</span></span></div>
</div>
<figcaption><b>Noise hurts BlackBear-ASR more than any other system:</b> 5.20 → 14.31 at 0 dB.</figcaption>
</figure>

Read-aloud Mandarin ranks 8th (Common Voice 9.17) and 9th (FormosaSpeech 11.85). Full English and Japanese sentences (49.03, 44.42) and Hakka (55.91) are not usable yet. Taiwanese output is written as Mandarin captions, not Taiwanese characters or romanization.

## Get started

Code and weights are Apache 2.0. Downloading the weights from Hugging Face requires a short access form, approved automatically. Five step-by-step tutorials are on GitHub.

## FAQ

### Is there an open speech recognition model for Taiwanese (Taigi)?

Yes. BlackBear-ASR is one open model for both Taiwanese Mandarin and Taiwanese. Among 12 systems on the same recordings, it ranks 3rd on Mandarin (5.28) and 3rd on Taiwanese (15.62), and 1st on Taiwanese mixed with English (19.16).

### Can I use it commercially?

Yes. Code and weights are Apache 2.0. Downloading the weights requires a short access form and agreeing to the Acceptable Use Policy; requests are approved automatically.

### Does it do live captions?

Yes. Captions update every 0.64 s, and committed text appears after 1.28 s on average. Streaming error rate is 6.52, versus 3.64 offline.

### What script does it use for Taiwanese?

Taiwanese speech is written as Mandarin captions, not Taiwanese characters or romanization.

### When should I not use it?

Very noisy audio, read-aloud Mandarin, full English or Japanese sentences, and Hakka. At 0 dB noise, its error rate rises from 5.20 to 14.31.

Thanks to Taipei-1, NTU Speech Lab and NTU SPML Lab for their support, and to every contributor.

</div>
