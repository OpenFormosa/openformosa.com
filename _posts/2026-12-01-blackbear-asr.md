---
layout: post
title: "BlackBear-ASR: one open speech recognizer for Taiwanese Mandarin and Taiwanese"
zh_title: "BlackBear-ASR：一個模型，聽懂國語，也聽懂臺語"
i18n_key: blackbear_asr
description: "BlackBear-ASR is OpenFormosa's open speech recognition model for Taiwanese Mandarin and Taiwanese. It writes live captions as you speak and follows plain-text instructions."
zh_description: "BlackBear-ASR 是 OpenFormosa 社群的開源語音辨識模型：國語、臺語都聽得懂，可以一邊聽一邊出字，也能照文字指示調整輸出。"
keywords: "BlackBear-ASR, 臺語語音辨識, 臺灣國語 ASR, 即時字幕, 開源語音辨識, Barbet, OpenFormosa"
date: 2026-12-01
category: research
tags: [asr, model, speech, blackbear]
published: false
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

## 先看一分鐘

<figure class="post-figure asr-video">
<video controls preload="metadata" playsinline src="{{ '/assets/video/blackbear-asr-showcase-r12.mp4' | relative_url }}"></video>
<figcaption>一分鐘看完 BlackBear-ASR 能做的事。片中文字皆為模型實際輸出，示範句經過挑選；示範音檔來自 Common Voice（CC0）。</figcaption>
</figure>

## 再聽聽看

下面每一段都是同一個 BlackBear-ASR，只換了一句指令。

<div class="tts-demo" data-tts-demo><div class="tts-demo__head"><span class="tts-demo__title">聽聽看：每段錄音和模型的實際輸出</span><span class="tts-demo__hint">按播放鍵聽錄音，再展開「模型寫出什麼？」看 BlackBear-ASR 的輸出。示範錄音取自 Common Voice（CC0）。</span></div><ol class="tts-demo__list"><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>國語轉寫</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">〔待填：R12 實際輸出〕</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-transcribe.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>臺語轉寫</b>　請將這段臺語語音寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">〔待填：R12 實際輸出〕</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/nan-transcribe.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>專有名詞</b>　可能出現的詞：（示範清單）。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">〔待填：R12 實際輸出〕</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-hotwords.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>問問題</b>　這段音訊有沒有提到「老師」？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">〔待填：R12 實際輸出〕</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-keyword.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>問情緒</b>　說話者的情緒如何？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">〔待填：R12 實際輸出〕</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-emotion.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>音高</b>　說話者的音高大約多少？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">〔待填：R12 實際輸出〕</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-pitch.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>兩人同時講</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">〔待填：R12 實際輸出〕</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-overlap.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="播放"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>沒有語音</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">模型寫出什麼？</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR 輸出</span><span class="tts-card__asr-v">〔待填：R12 實際輸出〕</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/nospeech.mp3' | relative_url }}"></audio></li></ol></div>

## 它怎麼運作

想像兩個人合作做聽打。

「耳朵」是串流聲學編碼器。它每 0.64 秒把聽到的聲音整理成一小段「聲音筆記」。它只聽已經發生的聲音，不偷看後面，所以可以即時工作。

「筆」是 Barbet 語言模型。它讀這些聲音筆記，再依照你的文字指示寫出結果：要不要標點、哪些專有名詞要寫對、要不要回答問題。

為什麼要這樣分工？因為「筆」看得懂文字。新的用途只要換一句指令，不需要另外訓練一個模型。

<figure class="post-figure asr-stream" data-asr-stream>
<p class="asr-stream__line" aria-hidden="true"><span class="asr-stream__c">今仔日天氣真好，</span><span class="asr-stream__p">我們等一下去夜市</span></p>
<div class="asr-stream__ticks" aria-hidden="true"></div>
<p class="asr-stream__legend"><span class="is-c">已確定</span><span class="is-p">暫定</span></p>
<figcaption>示意動畫：每 0.64 秒更新一次。相鄰兩次結果開頭相同的部分才會確定，之後不再修改。文字是示意，不是模型輸出；實際輸出請看上面的影片。</figcaption>
</figure>

## 做得好的地方

我們把 BlackBear-ASR 和 11 個公開或本土模型放在同一批錄音上比較。數字是錯誤率：每 100 個字錯幾個，越低越好。

<figure class="post-figure">
<svg viewBox="0 0 720 508" role="img" aria-label="錯誤率 %（越低越好）：國語、臺語都要聽得懂" xmlns="http://www.w3.org/2000/svg" class="asr-bars">
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">錯誤率 %（越低越好）：國語、臺語都要聽得懂</text>
<line x1="150.0" y1="44" x2="150.0" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="150.0" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">0</text>
<line x1="222.9" y1="44" x2="222.9" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="222.9" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">10</text>
<line x1="295.7" y1="44" x2="295.7" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="295.7" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">20</text>
<line x1="368.6" y1="44" x2="368.6" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="368.6" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">30</text>
<line x1="441.4" y1="44" x2="441.4" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="441.4" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">40</text>
<line x1="514.3" y1="44" x2="514.3" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="514.3" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">50</text>
<line x1="587.1" y1="44" x2="587.1" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="587.1" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">60</text>
<line x1="660.0" y1="44" x2="660.0" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="660.0" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">70</text>
<text x="0" y="60" fill="var(--paper-ink)" font-size="13" font-weight="700">臺灣國語（自建，1,000 句）</text>
<text x="140" y="85" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="700">BlackBear-ASR</text>
<rect class="asr-bar" x="150" y="74" width="38.5" height="14" rx="2" fill="var(--red)" opacity="1"/>
<text x="194.5" y="85" fill="var(--paper-ink)" font-size="12" font-weight="700">5.28</text>
<text x="140" y="111" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Qwen3-ASR-1.7B</text>
<rect class="asr-bar" x="150" y="100" width="35.6" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="191.6" y="111" fill="var(--paper-ink)" font-size="12" font-weight="400">4.89</text>
<text x="140" y="137" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MiMo-V2.5-ASR</text>
<rect class="asr-bar" x="150" y="126" width="35.3" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="191.3" y="137" fill="var(--paper-ink)" font-size="12" font-weight="400">4.85</text>
<text x="140" y="163" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Breeze-ASR-25</text>
<rect class="asr-bar" x="150" y="152" width="50.6" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="206.6" y="163" fill="var(--paper-ink)" font-size="12" font-weight="400">6.95</text>
<text x="140" y="189" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Breeze-ASR-26</text>
<rect class="asr-bar" x="150" y="178" width="67.4" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="223.4" y="189" fill="var(--paper-ink)" font-size="12" font-weight="400">9.25</text>
<text x="140" y="215" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MINNASR</text>
<rect class="asr-bar" x="150" y="204" width="58.5" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="214.5" y="215" fill="var(--paper-ink)" font-size="12" font-weight="400">8.03</text>
<text x="140" y="241" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Whisper large-v3</text>
<rect class="asr-bar" x="150" y="230" width="54.9" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="210.9" y="241" fill="var(--paper-ink)" font-size="12" font-weight="400">7.53</text>
<text x="0" y="278" fill="var(--paper-ink)" font-size="13" font-weight="700">臺語寫成中文（自建，1,000 句）</text>
<text x="140" y="303" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="700">BlackBear-ASR</text>
<rect class="asr-bar" x="150" y="292" width="113.8" height="14" rx="2" fill="var(--red)" opacity="1"/>
<text x="269.8" y="303" fill="var(--paper-ink)" font-size="12" font-weight="700">15.62</text>
<text x="140" y="329" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Qwen3-ASR-1.7B</text>
<rect class="asr-bar" x="150" y="318" width="445.8" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="601.8" y="329" fill="var(--paper-ink)" font-size="12" font-weight="400">61.19</text>
<text x="140" y="355" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MiMo-V2.5-ASR</text>
<rect class="asr-bar" x="150" y="344" width="410.7" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="566.7" y="355" fill="var(--paper-ink)" font-size="12" font-weight="400">56.37</text>
<text x="140" y="381" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Breeze-ASR-25</text>
<rect class="asr-bar" x="150" y="370" width="333.1" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="489.1" y="381" fill="var(--paper-ink)" font-size="12" font-weight="400">45.72</text>
<text x="140" y="407" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Breeze-ASR-26</text>
<rect class="asr-bar" x="150" y="396" width="60.4" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="216.4" y="407" fill="var(--paper-ink)" font-size="12" font-weight="400">8.29</text>
<text x="140" y="433" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MINNASR</text>
<rect class="asr-bar" x="150" y="422" width="56.9" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="212.9" y="433" fill="var(--paper-ink)" font-size="12" font-weight="400">7.81</text>
<text x="140" y="459" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Whisper large-v3</text>
<rect class="asr-bar" x="150" y="448" width="372.7" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="528.7" y="459" fill="var(--paper-ink)" font-size="12" font-weight="400">51.15</text>
</svg>
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

## 還不夠好的地方

我們把弱點寫得和優點一樣清楚，方便你判斷適不適合你的用途。

<figure class="post-figure">
<svg viewBox="0 0 720 352" role="img" aria-label="加入噪音後的錯誤率 %（自建國語，300 句）" xmlns="http://www.w3.org/2000/svg" class="asr-bars">
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">加入噪音後的錯誤率 %（自建國語，300 句）</text>
<line x1="150.0" y1="44" x2="150.0" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="150.0" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">0</text>
<line x1="277.5" y1="44" x2="277.5" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="277.5" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">4</text>
<line x1="405.0" y1="44" x2="405.0" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="405.0" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">8</text>
<line x1="532.5" y1="44" x2="532.5" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="532.5" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">12</text>
<line x1="660.0" y1="44" x2="660.0" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="660.0" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">16</text>
<text x="0" y="60" fill="var(--paper-ink)" font-size="13" font-weight="700">安靜</text>
<text x="140" y="85" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="700">BlackBear-ASR</text>
<rect class="asr-bar" x="150" y="74" width="165.8" height="14" rx="2" fill="var(--red)" opacity="1"/>
<text x="321.8" y="85" fill="var(--paper-ink)" font-size="12" font-weight="700">5.2</text>
<text x="140" y="111" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Qwen3-ASR-1.7B</text>
<rect class="asr-bar" x="150" y="100" width="156.5" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="312.5" y="111" fill="var(--paper-ink)" font-size="12" font-weight="400">4.91</text>
<text x="140" y="137" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MiMo-V2.5-ASR</text>
<rect class="asr-bar" x="150" y="126" width="155.9" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="311.9" y="137" fill="var(--paper-ink)" font-size="12" font-weight="400">4.89</text>
<text x="140" y="163" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Whisper large-v3</text>
<rect class="asr-bar" x="150" y="152" width="234.6" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="390.6" y="163" fill="var(--paper-ink)" font-size="12" font-weight="400">7.36</text>
<text x="0" y="200" fill="var(--paper-ink)" font-size="13" font-weight="700">噪音和人聲一樣大（0 dB）</text>
<text x="140" y="225" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="700">BlackBear-ASR</text>
<rect class="asr-bar" x="150" y="214" width="456.1" height="14" rx="2" fill="var(--red)" opacity="1"/>
<text x="612.1" y="225" fill="var(--paper-ink)" font-size="12" font-weight="700">14.31</text>
<text x="140" y="251" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Qwen3-ASR-1.7B</text>
<rect class="asr-bar" x="150" y="240" width="234.6" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="390.6" y="251" fill="var(--paper-ink)" font-size="12" font-weight="400">7.36</text>
<text x="140" y="277" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MiMo-V2.5-ASR</text>
<rect class="asr-bar" x="150" y="266" width="262.0" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="418.0" y="277" fill="var(--paper-ink)" font-size="12" font-weight="400">8.22</text>
<text x="140" y="303" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Whisper large-v3</text>
<rect class="asr-bar" x="150" y="292" width="362.7" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="518.7" y="303" fill="var(--paper-ink)" font-size="12" font-weight="400">11.38</text>
</svg>
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

## 開始使用

只想試試看：打開[線上試用](#)〔待補網址〕，上傳一段錄音。

想在自己的電腦上用，三行就夠：

```python
from blackbear_ice.api import BlackBearASR
asr = BlackBearASR.from_pretrained("OpenFormosa/blackbear-asr")
print(asr.transcribe("audio.wav", language="nan"))
```

[GitHub](https://github.com/OpenFormosa/blackbear-asr) 上有五篇教學：安裝、基本使用、指令控制、即時字幕與批次、用自己的錄音微調。程式碼和權重都以 Apache 2.0 授權。從 [Hugging Face](https://huggingface.co/OpenFormosa/blackbear-asr) 下載權重前，需要先填寫申請表並同意[可接受使用政策]({{ '/acceptable-use/' | relative_url }})，送出後會自動核准。

## 數字怎麼來的

所有系統用同一批錄音、同一套計分方式，各自使用官方預設的解碼設定。比對前，雙方都統一轉成繁體、去掉標點、數字轉成中文。國語和臺語測試集是我們自己整理的，錄音沒有出現在訓練資料中。Common Voice、FormosaSpeech、ML2021 是公開資料，任何人都可以重現。模型版本是 R12，每一項只跑一次。

## 致謝

BlackBear-ASR 屬於 OpenFormosa 社群。感謝 Taipei-1、臺大語音實驗室（NTU Speech Lab）與 NTU SPML Lab 的支持，也謝謝每一位貢獻者。歡迎到 [Discord]({{ '/community/' | relative_url }}) 回報問題、分享使用情境，一起改進它。

</div>

<div class="post-lang-en" markdown="1">

<div class="post-abstract" markdown="1">

**Abstract**　BlackBear-ASR is an open speech recognition model from the OpenFormosa community. It transcribes Taiwanese Mandarin and Taiwanese, writes live captions as you speak, and follows plain-text instructions. A streaming acoustic encoder trained from scratch (220M parameters) listens; OpenFormosa's Barbet language model writes. Among 12 systems, it is the only one in the top three for both Mandarin and Taiwanese. It also has clear weaknesses: heavy noise, read-aloud Mandarin, and full English or Japanese sentences.

</div>

## Watch

<figure class="post-figure asr-video">
<video controls preload="metadata" playsinline src="{{ '/assets/video/blackbear-asr-showcase-r12.mp4' | relative_url }}"></video>
<figcaption>BlackBear-ASR in one minute. All on-screen text is real model output from selected clips; demo audio is from Common Voice (CC0).</figcaption>
</figure>

## Listen

<div class="tts-demo" data-tts-demo><div class="tts-demo__head"><span class="tts-demo__title">Listen: recordings and real model output</span><span class="tts-demo__hint">Play a clip, then expand to see what BlackBear-ASR wrote. Demo clips: Common Voice (CC0).</span></div><ol class="tts-demo__list"><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Mandarin</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">[to fill: actual R12 output]</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-transcribe.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Taiwanese</b>　請將這段臺語語音寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">[to fill: actual R12 output]</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/nan-transcribe.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Hotwords</b>　可能出現的詞：（demo list）。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">[to fill: actual R12 output]</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-hotwords.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Keyword question</b>　這段音訊有沒有提到「老師」？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">[to fill: actual R12 output]</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-keyword.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Emotion</b>　說話者的情緒如何？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">[to fill: actual R12 output]</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-emotion.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Pitch</b>　說話者的音高大約多少？</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">[to fill: actual R12 output]</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-pitch.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>Two speakers</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">[to fill: actual R12 output]</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/zh-overlap.mp3' | relative_url }}"></audio></li><li class="tts-card" data-tts-card><button type="button" class="tts-card__play" data-tts-play aria-label="Play"><span class="tts-card__icon" aria-hidden="true"></span></button><div class="tts-card__main"><p class="tts-card__text"><b>No speech</b>　請將這段語音逐字轉寫成文字。</p><div class="tts-card__track" data-tts-track><span class="tts-card__fill" data-tts-fill></span></div><div class="tts-card__foot"><span class="tts-card__time" data-tts-time>0:00</span><button type="button" class="tts-card__reveal" data-tts-reveal aria-expanded="false">What did the model write?</button></div><div class="tts-card__asr" data-tts-asr hidden><span class="tts-card__asr-k">BlackBear-ASR output</span><span class="tts-card__asr-v">[to fill: actual R12 output]</span></div></div><audio preload="none" data-tts-audio src="{{ '/assets/audio/blackbear/nospeech.mp3' | relative_url }}"></audio></li></ol></div>

## How it works

The encoder turns every 0.64 s of audio into a short summary and never looks ahead, so it runs live. Barbet reads those summaries together with your instruction and writes the result. A new use needs a new instruction, not a new model.

<figure class="post-figure asr-stream" data-asr-stream>
<p class="asr-stream__line" aria-hidden="true"><span class="asr-stream__c">今仔日天氣真好，</span><span class="asr-stream__p">我們等一下去夜市</span></p>
<div class="asr-stream__ticks" aria-hidden="true"></div>
<p class="asr-stream__legend"><span class="is-c">Committed</span><span class="is-p">Tentative</span></p>
<figcaption>Illustration: the caption updates every 0.64 s. Text that two consecutive updates agree on is committed and never revised. The sentence is illustrative, not model output.</figcaption>
</figure>

## Results

<figure class="post-figure">
<svg viewBox="0 0 720 508" role="img" aria-label="Error rate % (lower is better): Mandarin and Taiwanese" xmlns="http://www.w3.org/2000/svg" class="asr-bars">
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">Error rate % (lower is better): Mandarin and Taiwanese</text>
<line x1="150.0" y1="44" x2="150.0" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="150.0" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">0</text>
<line x1="222.9" y1="44" x2="222.9" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="222.9" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">10</text>
<line x1="295.7" y1="44" x2="295.7" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="295.7" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">20</text>
<line x1="368.6" y1="44" x2="368.6" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="368.6" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">30</text>
<line x1="441.4" y1="44" x2="441.4" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="441.4" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">40</text>
<line x1="514.3" y1="44" x2="514.3" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="514.3" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">50</text>
<line x1="587.1" y1="44" x2="587.1" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="587.1" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">60</text>
<line x1="660.0" y1="44" x2="660.0" y2="470" stroke="var(--line)" stroke-width="1"/>
<text x="660.0" y="492" text-anchor="middle" fill="var(--muted)" font-size="11">70</text>
<text x="0" y="60" fill="var(--paper-ink)" font-size="13" font-weight="700">Taiwanese Mandarin (in-house, 1,000)</text>
<text x="140" y="85" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="700">BlackBear-ASR</text>
<rect class="asr-bar" x="150" y="74" width="38.5" height="14" rx="2" fill="var(--red)" opacity="1"/>
<text x="194.5" y="85" fill="var(--paper-ink)" font-size="12" font-weight="700">5.28</text>
<text x="140" y="111" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Qwen3-ASR-1.7B</text>
<rect class="asr-bar" x="150" y="100" width="35.6" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="191.6" y="111" fill="var(--paper-ink)" font-size="12" font-weight="400">4.89</text>
<text x="140" y="137" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MiMo-V2.5-ASR</text>
<rect class="asr-bar" x="150" y="126" width="35.3" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="191.3" y="137" fill="var(--paper-ink)" font-size="12" font-weight="400">4.85</text>
<text x="140" y="163" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Breeze-ASR-25</text>
<rect class="asr-bar" x="150" y="152" width="50.6" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="206.6" y="163" fill="var(--paper-ink)" font-size="12" font-weight="400">6.95</text>
<text x="140" y="189" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Breeze-ASR-26</text>
<rect class="asr-bar" x="150" y="178" width="67.4" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="223.4" y="189" fill="var(--paper-ink)" font-size="12" font-weight="400">9.25</text>
<text x="140" y="215" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MINNASR</text>
<rect class="asr-bar" x="150" y="204" width="58.5" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="214.5" y="215" fill="var(--paper-ink)" font-size="12" font-weight="400">8.03</text>
<text x="140" y="241" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Whisper large-v3</text>
<rect class="asr-bar" x="150" y="230" width="54.9" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="210.9" y="241" fill="var(--paper-ink)" font-size="12" font-weight="400">7.53</text>
<text x="0" y="278" fill="var(--paper-ink)" font-size="13" font-weight="700">Taiwanese → Mandarin captions (in-house, 1,000)</text>
<text x="140" y="303" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="700">BlackBear-ASR</text>
<rect class="asr-bar" x="150" y="292" width="113.8" height="14" rx="2" fill="var(--red)" opacity="1"/>
<text x="269.8" y="303" fill="var(--paper-ink)" font-size="12" font-weight="700">15.62</text>
<text x="140" y="329" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Qwen3-ASR-1.7B</text>
<rect class="asr-bar" x="150" y="318" width="445.8" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="601.8" y="329" fill="var(--paper-ink)" font-size="12" font-weight="400">61.19</text>
<text x="140" y="355" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MiMo-V2.5-ASR</text>
<rect class="asr-bar" x="150" y="344" width="410.7" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="566.7" y="355" fill="var(--paper-ink)" font-size="12" font-weight="400">56.37</text>
<text x="140" y="381" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Breeze-ASR-25</text>
<rect class="asr-bar" x="150" y="370" width="333.1" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="489.1" y="381" fill="var(--paper-ink)" font-size="12" font-weight="400">45.72</text>
<text x="140" y="407" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Breeze-ASR-26</text>
<rect class="asr-bar" x="150" y="396" width="60.4" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="216.4" y="407" fill="var(--paper-ink)" font-size="12" font-weight="400">8.29</text>
<text x="140" y="433" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MINNASR</text>
<rect class="asr-bar" x="150" y="422" width="56.9" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="212.9" y="433" fill="var(--paper-ink)" font-size="12" font-weight="400">7.81</text>
<text x="140" y="459" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Whisper large-v3</text>
<rect class="asr-bar" x="150" y="448" width="372.7" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="528.7" y="459" fill="var(--paper-ink)" font-size="12" font-weight="400">51.15</text>
</svg>
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

## Limitations

<figure class="post-figure">
<svg viewBox="0 0 720 352" role="img" aria-label="Error rate % with added noise (in-house Mandarin, 300)" xmlns="http://www.w3.org/2000/svg" class="asr-bars">
<text x="0" y="20" fill="var(--paper-ink)" font-size="15" font-weight="700">Error rate % with added noise (in-house Mandarin, 300)</text>
<line x1="150.0" y1="44" x2="150.0" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="150.0" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">0</text>
<line x1="277.5" y1="44" x2="277.5" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="277.5" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">4</text>
<line x1="405.0" y1="44" x2="405.0" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="405.0" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">8</text>
<line x1="532.5" y1="44" x2="532.5" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="532.5" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">12</text>
<line x1="660.0" y1="44" x2="660.0" y2="314" stroke="var(--line)" stroke-width="1"/>
<text x="660.0" y="336" text-anchor="middle" fill="var(--muted)" font-size="11">16</text>
<text x="0" y="60" fill="var(--paper-ink)" font-size="13" font-weight="700">Clean</text>
<text x="140" y="85" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="700">BlackBear-ASR</text>
<rect class="asr-bar" x="150" y="74" width="165.8" height="14" rx="2" fill="var(--red)" opacity="1"/>
<text x="321.8" y="85" fill="var(--paper-ink)" font-size="12" font-weight="700">5.2</text>
<text x="140" y="111" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Qwen3-ASR-1.7B</text>
<rect class="asr-bar" x="150" y="100" width="156.5" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="312.5" y="111" fill="var(--paper-ink)" font-size="12" font-weight="400">4.91</text>
<text x="140" y="137" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MiMo-V2.5-ASR</text>
<rect class="asr-bar" x="150" y="126" width="155.9" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="311.9" y="137" fill="var(--paper-ink)" font-size="12" font-weight="400">4.89</text>
<text x="140" y="163" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Whisper large-v3</text>
<rect class="asr-bar" x="150" y="152" width="234.6" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="390.6" y="163" fill="var(--paper-ink)" font-size="12" font-weight="400">7.36</text>
<text x="0" y="200" fill="var(--paper-ink)" font-size="13" font-weight="700">Noise as loud as speech (0 dB)</text>
<text x="140" y="225" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="700">BlackBear-ASR</text>
<rect class="asr-bar" x="150" y="214" width="456.1" height="14" rx="2" fill="var(--red)" opacity="1"/>
<text x="612.1" y="225" fill="var(--paper-ink)" font-size="12" font-weight="700">14.31</text>
<text x="140" y="251" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Qwen3-ASR-1.7B</text>
<rect class="asr-bar" x="150" y="240" width="234.6" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="390.6" y="251" fill="var(--paper-ink)" font-size="12" font-weight="400">7.36</text>
<text x="140" y="277" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">MiMo-V2.5-ASR</text>
<rect class="asr-bar" x="150" y="266" width="262.0" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="418.0" y="277" fill="var(--paper-ink)" font-size="12" font-weight="400">8.22</text>
<text x="140" y="303" text-anchor="end" fill="var(--paper-ink)" font-size="12" font-weight="400">Whisper large-v3</text>
<rect class="asr-bar" x="150" y="292" width="362.7" height="14" rx="2" fill="var(--muted)" opacity="0.55"/>
<text x="518.7" y="303" fill="var(--paper-ink)" font-size="12" font-weight="400">11.38</text>
</svg>
<figcaption><b>Noise hurts BlackBear-ASR more than any other system:</b> 5.20 → 14.31 at 0 dB.</figcaption>
</figure>

Read-aloud Mandarin ranks 8th (Common Voice 9.17) and 9th (FormosaSpeech 11.85). Full English and Japanese sentences (49.03, 44.42) and Hakka (55.91) are not usable yet. Taiwanese output is written as Mandarin captions, not Taiwanese characters or romanization.

## Get started

Code and weights are Apache 2.0. Downloading the weights from Hugging Face requires a short access form, approved automatically. Five step-by-step tutorials are on GitHub.

Thanks to Taipei-1, NTU Speech Lab and NTU SPML Lab for their support, and to every contributor.

</div>
