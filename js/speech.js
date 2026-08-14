// ============================================================
// Speech：浏览器语音合成（发音）
// ============================================================
const Speech = (function () {
  let voices = [];
  let ready = false;

  function loadVoices() {
    if (typeof speechSynthesis === 'undefined') return;
    voices = speechSynthesis.getVoices();
    ready = voices.length > 0;
  }
  if (typeof speechSynthesis !== 'undefined') {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
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

  function speak(text, opts) {
    opts = opts || {};
    if (typeof speechSynthesis === 'undefined') { if (window.UI) UI.toast('当前浏览器不支持语音', 'error'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const settings = Store.getState().settings;
    u.lang = opts.lang || (settings.ttsLang === 'auto' ? 'en-US' : settings.ttsLang);
    u.rate = opts.rate != null ? opts.rate : settings.ttsRate;
    const v = pickVoice(settings.ttsLang);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  function speakWord(w) {
    if (!w) return;
    speak(w.headword, { lang: w.examType === 'ielts' ? 'en-GB' : 'en-US' });
  }

  return { speak, speakWord };
})();
