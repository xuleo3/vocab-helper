// ============================================================
// Speech：发音（优先浏览器系统朗读，失败/无声时用有道网络发音兜底）
// 重点：连点灵敏（先取消上一次）、手机手势可用、失败尽快兜底
// ============================================================
const Speech = (function () {
  let voices = [];
  let fallbackAudio = null;
  let seq = 0;

  function refreshVoices() {
    if (typeof speechSynthesis === 'undefined') { voices = []; return; }
    try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
  }
  if (typeof speechSynthesis !== 'undefined') {
    refreshVoices();
    try { speechSynthesis.onvoiceschanged = refreshVoices; } catch (e) {}
  }

  function pickVoice(lang) {
    if (!voices.length) refreshVoices();
    const target = lang === 'auto' ? null : lang;
    if (!target) {
      return voices.find(v => /^en[-_]US/i.test(v.lang)) ||
             voices.find(v => /^en[-_]GB/i.test(v.lang)) ||
             voices.find(v => /^en/i.test(v.lang)) || null;
    }
    return voices.find(v => v.lang === target) ||
           voices.find(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(target.toLowerCase())) || null;
  }

  function stopAll() {
    try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) {}
    try { if (fallbackAudio) { fallbackAudio.pause(); fallbackAudio.currentTime = 0; } } catch (e) {}
  }

  // 网络发音兜底（有道，国内可访问）
  function playFallback(text) {
    try {
      if (fallbackAudio) { try { fallbackAudio.pause(); } catch (e) {} }
      fallbackAudio = new Audio('https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=2');
      fallbackAudio.preload = 'auto';
      const p = fallbackAudio.play();
      if (p && p.catch) p.catch(function () { if (window.UI) UI.toast('发音失败：请检查网络或系统语音', 'error'); });
    } catch (e) {
      if (window.UI) UI.toast('发音失败：请检查网络或系统语音', 'error');
    }
  }

  function speak(text, opts) {
    text = String(text || '').trim();
    if (!text) return;
    opts = opts || {};
    const mySeq = ++seq;
    stopAll(); // 连点时先停掉上一次，立刻重新发音
    refreshVoices();

    const settings = Store.getState().settings || {};
    const lang = opts.lang || (settings.ttsLang === 'auto' ? 'en-US' : settings.ttsLang);
    const rate = opts.rate != null ? opts.rate : (settings.ttsRate || 0.95);

    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      playFallback(text); return;
    }

    let started = false, finished = false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(settings.ttsLang);
    if (v) u.voice = v;
    u.onstart = function () { started = true; };
    u.onend = function () { finished = true; };
    u.onerror = function () { if (mySeq === seq && !started) playFallback(text); };

    try {
      speechSynthesis.speak(u);
      try { speechSynthesis.resume(); } catch (e) {}
    } catch (e) {
      playFallback(text); return;
    }

    // 部分手机系统语音"哑火"：1.8 秒还没开始就立即走网络发音（已开始则不打扰）
    setTimeout(function () {
      if (mySeq !== seq || started || finished) return;
      try { speechSynthesis.cancel(); } catch (e) {}
      playFallback(text);
    }, 1800);
    // 安卓偶发 paused，稍后恢复一次
    setTimeout(function () {
      if (mySeq === seq && !finished) { try { speechSynthesis.resume(); } catch (e) {} }
    }, 600);
  }

  function speakWord(w) {
    if (!w) return;
    speak(w.headword, { lang: w.examType === 'ielts' ? 'en-GB' : 'en-US' });
  }

  return { speak, speakWord, stop: stopAll };
})();