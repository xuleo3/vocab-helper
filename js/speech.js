// ============================================================
// Speech：发音（优先浏览器系统朗读，失败/无声时用「有道网络发音」兜底）
// 手机上若没有英文语音引擎，会自动走网络发音（国内可访问、免费）
// ============================================================
const Speech = (function () {
  let voices = [];
  let ready = false;

  function loadVoices() {
    if (typeof speechSynthesis === 'undefined') return;
    try {
      voices = speechSynthesis.getVoices();
    } catch (e) { voices = []; }
    ready = voices.length > 0;
  }
  if (typeof speechSynthesis !== 'undefined') {
    loadVoices();
    try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
  }

  function pickVoice(lang) {
    if (!voices.length) loadVoices();
    const target = lang === 'auto' ? null : lang;
    if (!target) {
      const enUS = voices.find(v => /^en[-_]US/i.test(v.lang));
      if (enUS) return enUS;
      const enGB = voices.find(v => /^en[-_]GB/i.test(v.lang));
      if (enGB) return enGB;
      return voices.find(v => /^en/i.test(v.lang)) || null;
    }
    return voices.find(v => v.lang === target) || voices.find(v => v.lang && v.lang.toLowerCase().startsWith(target.toLowerCase())) || null;
  }

  function hasEnglishVoice() {
    return voices.some(v => /^en/i.test(v.lang || ''));
  }

  // 网络词典发音兜底（有道词典，国内可访问、免费）
  function playFallback(text) {
    try {
      const url = 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=2';
      const a = new Audio(url);
      a.play().catch(function () {
        if (window.UI) UI.toast('发音失败：请检查网络或系统语音', 'error');
      });
    } catch (e) {
      if (window.UI) UI.toast('发音失败：请检查网络或系统语音', 'error');
    }
  }

  function speak(text, opts) {
    opts = opts || {};
    const trySystem = typeof speechSynthesis !== 'undefined' && hasEnglishVoice();
    if (trySystem) {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const settings = Store.getState().settings;
        u.lang = opts.lang || (settings.ttsLang === 'auto' ? 'en-US' : settings.ttsLang);
        u.rate = opts.rate != null ? opts.rate : settings.ttsRate;
        const v = pickVoice(settings.ttsLang);
        if (v) u.voice = v;
        let fellBack = false;
        const done = function () { fellBack = true; };
        const fail = function () {
          if (!fellBack) { fellBack = true; try { speechSynthesis.cancel(); } catch (e) {} playFallback(text); }
        };
        u.onend = done;
        u.onerror = fail;
        // 4 秒还没读完（可能无声/引擎异常）→ 兜底网络发音
        setTimeout(function () {
          if (!fellBack) {
            fellBack = true;
            try { speechSynthesis.cancel(); } catch (e) {}
            playFallback(text);
          }
        }, 4000);
        speechSynthesis.speak(u);
        return;
      } catch (e) { /* 落到网络发音 */ }
    }
    playFallback(text);
  }

  function speakWord(w) {
    if (!w) return;
    speak(w.headword, { lang: w.examType === 'ielts' ? 'en-GB' : 'en-US' });
  }

  return { speak, speakWord };
})();
