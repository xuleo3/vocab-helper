// ============================================================
// Speech：发音（系统朗读优先，失败/无声用有道网络发音兜底）
// 支持：连点灵敏、倍速、读完回调（供“连续朗读”用）
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
    try { if (fallbackAudio) { fallbackAudio.onended = null; fallbackAudio.pause(); fallbackAudio.currentTime = 0; } } catch (e) {}
  }

  function playFallback(text, opts) {
    opts = opts || {};
    try {
      if (fallbackAudio) { try { fallbackAudio.pause(); } catch (e) {} }
      fallbackAudio = new Audio('https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=2');
      fallbackAudio.preload = 'auto';
      if (opts.rate) { try { fallbackAudio.playbackRate = Math.max(0.5, Math.min(2, Number(opts.rate) || 1)); } catch (e) {} }
      if (opts.onend) fallbackAudio.onended = function () { try { opts.onend(); } catch (e) {} };
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
    stopAll();
    refreshVoices();

    const settings = Store.getState().settings || {};
    const rate = opts.rate != null ? opts.rate : (settings.ttsRate || 0.95);
    const lang = opts.lang || (settings.ttsLang === 'auto' ? 'en-US' : settings.ttsLang);
    const done = function () { if (mySeq === seq && typeof opts.onend === 'function') { try { opts.onend(); } catch (e) {} } };

    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      playFallback(text, { rate: rate, onend: done }); return;
    }

    let started = false, finished = false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = Math.max(0.5, Math.min(2, Number(rate) || 1));
    const v = pickVoice(settings.ttsLang);
    if (v) u.voice = v;
    u.onstart = function () { started = true; };
    u.onend = function () { finished = true; done(); };
    u.onerror = function () { if (mySeq === seq && !started) playFallback(text, { rate: rate, onend: done }); };

    try {
      speechSynthesis.speak(u);
      try { speechSynthesis.resume(); } catch (e) {}
    } catch (e) {
      playFallback(text, { rate: rate, onend: done }); return;
    }

    setTimeout(function () {
      if (mySeq !== seq || started || finished) return;
      try { speechSynthesis.cancel(); } catch (e) {}
      playFallback(text, { rate: rate, onend: done });
    }, 1800);
    setTimeout(function () {
      if (mySeq === seq && !finished) { try { speechSynthesis.resume(); } catch (e) {} }
    }, 600);
  }

  function speakWord(w, opts) {
    if (!w) return;
    opts = opts || {};
    speak(w.headword, {
      lang: w.examType === 'ielts' ? 'en-GB' : 'en-US',
      rate: opts.rate,
      onend: opts.onend
    });
  }

  function stop() { seq++; stopAll(); }

  return { speak, speakWord, stop: stop };
})();