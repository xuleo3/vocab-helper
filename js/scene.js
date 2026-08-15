// ============================================================
// Scene：生活场景 · 看图认词（完全独立板块）
// 独立 localStorage key：vocab_scene_v1，不读写六级/雅思/王陆数据
// 测试：看 emoji 图片 → 写出英文单词；错题本分级 / 重要 / 常错 与主站逻辑一致
// ============================================================

const SceneStore = (function () {
  const LS_KEY = 'vocab_scene_v1';
  const FREQ_THRESHOLD = 2;
  let state = null;

  function defaultState() {
    return {
      books: [],
      words: {},
      errorBooks: [],
      important: { words: {} },
      frequent: { words: {} },
      mastered: {},
      wordStats: {},
      testSessions: {},
      stats: { testsTaken: 0, answered: 0, correct: 0 },
      pexelsKey: '',
      sceneVersion: 0
    };
  }

  function uid() { return 'sc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
  function save() { persist(); }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) state = Object.assign(defaultState(), JSON.parse(raw));
      else state = defaultState();
    } catch (e) { state = defaultState(); }
    const d = defaultState();
    state.books = state.books || [];
    state.words = state.words || {};
    state.errorBooks = state.errorBooks || [];
    state.important = state.important || { words: {} };
    state.important.words = state.important.words || {};
    state.frequent = state.frequent || { words: {} };
    state.frequent.words = state.frequent.words || {};
    state.mastered = state.mastered || {};
    state.wordStats = state.wordStats || {};
    state.testSessions = state.testSessions || {};
    state.stats = Object.assign(d.stats, state.stats || {});
    state.pexelsKey = state.pexelsKey || '';
    initData();
    return state;
  }

  function initData() {
    const ver = window.SCENE_VERSION || 0;
    if (state.sceneVersion === ver && state.books.length) return;
    const scenes = window.SCENE_BOOKS || [];
    const books = [];
    const words = {};
    scenes.forEach(function (sc) {
      const wordIds = [];
      (sc.words || []).forEach(function (w, wi) {
        const wid = sc.id + '_' + wi;
        words[wid] = { id: wid, en: w[0], zh: w[1], emoji: w[2], pos: w[3] || '', phonetic: '', sceneId: sc.id, sceneName: sc.name };
        wordIds.push(wid);
      });
      books.push({ id: sc.id, name: sc.name, icon: sc.icon, photo: sc.photo || '', wordIds: wordIds });
    });
    state.books = books;
    state.words = words;
    state.sceneVersion = ver;
    persist();
  }

  function getState() { return state; }
  function getPexelsKey() { return state.pexelsKey || ''; }
  function setPexelsKey(k) { state.pexelsKey = String(k || '').trim(); save(); }
  function getScenes() { return state.books; }
  function getScene(id) { return state.books.find(function (b) { return b.id === id; }) || null; }
  function getWord(id) { return state.words[id] || null; }
  function getSceneWords(sceneId) {
    const sc = getScene(sceneId);
    return sc ? sc.wordIds.map(function (id) { return state.words[id]; }).filter(Boolean) : [];
  }
  function progress(sceneId) {
    const words = getSceneWords(sceneId);
    const learned = words.filter(function (w) { return state.mastered[w.id]; }).length;
    return { total: words.length, learned: learned, pct: words.length ? Math.round(learned / words.length * 100) : 0 };
  }
  function overallStats() {
    const total = state.books.reduce(function (s, b) { return s + b.wordIds.length; }, 0);
    return {
      total: total,
      mastered: Object.keys(state.mastered).length,
      errorBooks: state.errorBooks.filter(function (b) { return Object.keys(b.words).length > 0; }).length,
      frequent: Object.keys(state.frequent.words).length,
      important: Object.keys(state.important.words).length,
      answered: state.stats.answered,
      correct: state.stats.correct,
      acc: state.stats.answered ? Math.round(state.stats.correct / state.stats.answered * 100) : 0,
      testsTaken: state.stats.testsTaken
    };
  }  function childrenOf(ebId) { return state.errorBooks.filter(function (b) { return b.parentId === ebId; }); }
  function getErrorBook(id) { return state.errorBooks.find(function (b) { return b.id === id; }) || null; }
  function getErrorBookWords(eb) {
    if (!eb) return [];
    return Object.keys(eb.words).map(function (id) { return state.words[id]; }).filter(Boolean);
  }
  function childRound(parent) {
    const base = (parent && parent.round ? parent.round : 0) + 1;
    const existing = childrenOf(parent.id).reduce(function (m, c) { return Math.max(m, c.round || 1); }, 0) + 1;
    return Math.max(base, existing);
  }
  function errorBookName(scene, kind, parent) {
    const nm = scene ? scene.name : '生活场景';
    if (kind === 'r1') return nm + ' · 第1次错题本';
    if (kind === 'r2') return nm + ' · 第2次错题本';
    if (kind === 'sub' && parent) return parent.name + ' · 第' + childRound(parent) + '轮';
    return nm + ' · 错题本';
  }
  function ensureErrorBook(o) {
    let eb = state.errorBooks.find(function (b) { return b.sceneId === o.sceneId && b.kind === o.kind && (b.parentId || null) === (o.parentId || null); });
    if (!eb) {
      const scene = getScene(o.sceneId);
      const parent = o.parentId ? getErrorBook(o.parentId) : null;
      eb = {
        id: uid(), sceneId: o.sceneId, parentId: o.parentId || null, kind: o.kind,
        name: errorBookName(scene, o.kind, parent),
        round: o.kind === 'sub' ? (parent ? childRound(parent) : 1) : (o.kind === 'r1' ? 1 : 2),
        words: {}, createdAt: Date.now()
      };
      state.errorBooks.push(eb);
    }
    return eb;
  }
  function newSubErrorBook(parentId) {
    const parent = getErrorBook(parentId);
    const round = parent ? childRound(parent) : 1;
    const eb = {
      id: uid(), sceneId: parent ? parent.sceneId : null, parentId: parentId || null, kind: 'sub',
      name: (parent ? parent.name : '错题本') + ' · 第' + round + '轮', round: round, words: {}, createdAt: Date.now()
    };
    state.errorBooks.push(eb);
    save();
    return eb;
  }
  function recordWrongWord(o) {
    const w = getWord(o.wid); if (!w) return null;
    const eb = o.targetEbId ? getErrorBook(o.targetEbId) : ensureErrorBook({ sceneId: o.sceneId, kind: o.kind, parentId: o.parentId || null });
    const now = Date.now();
    if (eb) {
      const e = eb.words[o.wid] || (eb.words[o.wid] = { wrongCount: 0, firstAt: now, lastAt: now, mastered: false });
      e.wrongCount++; e.lastAt = now; e.mastered = false;
    }
    const ws = state.wordStats[o.wid] || (state.wordStats[o.wid] = { wrongCount: 0, firstAt: now, lastAt: now });
    ws.wrongCount++; ws.lastAt = now;
    if (ws.wrongCount >= FREQ_THRESHOLD && !state.frequent.words[o.wid]) {
      state.frequent.words[o.wid] = { wrongCount: ws.wrongCount, firstAt: ws.firstAt, lastAt: ws.lastAt, manual: false };
    }
    delete state.mastered[o.wid];
    save();
    return eb;
  }
  function markCorrectWord(wid, masterInSceneEbId) {
    const now = Date.now();
    state.mastered[wid] = now;
    if (masterInSceneEbId) {
      const p = getErrorBook(masterInSceneEbId);
      if (p && p.words[wid]) p.words[wid].mastered = true;
    }
    save();
  }
  function bumpWordStats(wid) {
    const now = Date.now();
    const ws = state.wordStats[wid] || (state.wordStats[wid] = { wrongCount: 0, firstAt: now, lastAt: now });
    ws.wrongCount++; ws.lastAt = now;
    delete state.mastered[wid];
    save();
  }
  function finishTestStats(answered, correct) {
    state.stats.testsTaken++;
    state.stats.answered += answered;
    state.stats.correct += correct;
    save();
  }
  function removeErrorWord(ebId, wid) { const eb = getErrorBook(ebId); if (eb) { delete eb.words[wid]; save(); } }
  function clearErrorBook(ebId) { const eb = getErrorBook(ebId); if (eb) { eb.words = {}; save(); } }  function toggleImportant(wid, on) {
    if (on) state.important.words[wid] = { addedAt: Date.now() };
    else delete state.important.words[wid];
    save();
  }
  function removeImportant(wid) { delete state.important.words[wid]; save(); }
  function getImportantWords() { return Object.keys(state.important.words).map(function (id) { return state.words[id]; }).filter(Boolean); }
  function toggleFrequent(wid, on) {
    const ws = state.wordStats[wid] || (state.wordStats[wid] = { wrongCount: 0, firstAt: Date.now(), lastAt: Date.now() });
    if (on) state.frequent.words[wid] = { wrongCount: ws.wrongCount, firstAt: ws.firstAt, lastAt: ws.lastAt, manual: true };
    else delete state.frequent.words[wid];
    save();
  }
  function removeFrequent(wid) { delete state.frequent.words[wid]; save(); }
  function getFrequentWords() { return Object.keys(state.frequent.words).map(function (id) { return state.words[id]; }).filter(Boolean); }
  function markMastered(wid, on) { if (on) state.mastered[wid] = Date.now(); else delete state.mastered[wid]; save(); }

  function sessionKey(scope) {
    if (!scope) return '';
    if (scope.preset === 'scene') return 'sc_' + scope.sceneId + '_' + scope.kind;
    if (scope.preset === 'error' || scope.preset === 'retest') return 'sceb_' + scope.parentEbId;
    if (scope.preset === 'frequent') return 'scfreq';
    if (scope.preset === 'important') return 'scimp';
    return '';
  }
  function saveTestSession(key, scope, answered) {
    state.testSessions[key] = { scope: scope, answered: answered || [], startedAt: Date.now(), updatedAt: Date.now() };
    save();
  }
  function getTestSession(key) { return state.testSessions[key] || null; }
  function clearTestSession(key) { if (key) { delete state.testSessions[key]; save(); } }

  function normalizeEn(s) { return (s || '').toLowerCase().replace(/[^a-z]/g, ''); }
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n; if (n === 0) return m;
    const dp = [];
    for (let i = 0; i <= m; i++) dp[i] = [i];
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }
  function evaluateAnswer(w, input) {
    const ni = normalizeEn(input);
    const ne = normalizeEn(w.en);
    let correct = false;
    if (ni) {
      if (ni === ne) correct = true;
      else if (ne.length >= 4 && lev(ni, ne) <= 1) correct = true;
    }
    return { correct: correct, input: (input || '').trim(), expected: w.en, typed: ni, expectedNorm: ne };
  }

  load();
  return {
    getState, getScenes, getScene, getWord, getSceneWords, progress, overallStats,
    getPexelsKey, setPexelsKey,
    childrenOf, getErrorBook, getErrorBookWords, ensureErrorBook, newSubErrorBook,
    recordWrongWord, markCorrectWord, bumpWordStats, finishTestStats,
    removeErrorWord, clearErrorBook,
    toggleImportant, removeImportant, getImportantWords,
    toggleFrequent, removeFrequent, getFrequentWords, markMastered,
    sessionKey, saveTestSession, getTestSession, clearTestSession,
    evaluateAnswer
  };
})();

const SceneViews = (function () {
  const esc = UI.esc;

  function starBtn(w) {
    const on = !!(SceneStore.getState().important.words[w.id]);
    return '<button class="btn btn-sm star-btn' + (on ? ' on' : '') + '" data-scene-action="scene-toggle-important" data-wid="' + esc(w.id) + '">' + (on ? '★ 已在重要本' : '☆ 加入重要本') + '</button>';
  }  function scenePhoto(src, emoji, cls) {
    return '<span class="wiki-img-wrap ' + (cls || '') + '"><span class="wiki-img-fallback">' + emoji + '</span><img class="wiki-img" src="' + esc(src) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"></span>';
  }

  function wordPhoto(en, emoji) {
    return '<div class="scene-flash-photo"><span class="scene-flash-emoji">' + emoji + '</span><img class="scene-word-photo" data-pexels="' + esc(en) + '" alt="" onerror="this.style.display=\'none\'"></div>';
  }

  function home() {
    const scenes = SceneStore.getScenes();
    const st = SceneStore.overallStats();
    let html = '<div class="page-head"><h1>🏞️ 生活场景 · 看图认词</h1><p class="muted">每个场景先「📖 学习」看图认识，再「🖼️ 测试」写英文单词。与六级 / 雅思 / 王陆完全独立，互不影响。</p></div>';
    html += '<div class="stat-grid">' + [
      { label: '场景', value: scenes.length, icon: '🗂️' },
      { label: '总词数', value: st.total, icon: '📖' },
      { label: '已掌握', value: st.mastered, icon: '✅' },
      { label: '错题本', value: st.errorBooks, icon: '📕' },
      { label: '重要单词', value: st.important, icon: '⭐' },
      { label: '经常错词', value: st.frequent, icon: '🔥' }
    ].map(function (c) {
      return '<div class="card stat-card"><div class="stat-icon">' + c.icon + '</div><div class="stat-body"><div class="stat-value">' + c.value + '</div><div class="stat-label">' + c.label + '</div></div></div>';
    }).join('') + '</div>';

    html += '<div class="section-title"><h2>选择场景</h2></div>';
    html += '<div class="scene-grid">' + scenes.map(function (sc) {
      const p = SceneStore.progress(sc.id);
      return '<div class="card scene-card">' +
        '<button class="scene-card-photo" data-scene-action="scene-learn" data-scene="' + esc(sc.id) + '">' + scenePhoto(sc.photo, sc.icon) + '</button>' +
        '<div class="scene-card-body">' +
        '<button class="scene-card-title" data-scene-action="scene-learn" data-scene="' + esc(sc.id) + '">' + esc(sc.name) + '</button>' +
        '<div class="muted small">' + p.learned + ' / ' + p.total + ' 词 · 已掌握 ' + p.pct + '%</div>' +
        '<div class="progress"><div class="progress-bar" style="width:' + p.pct + '%"></div></div>' +
        '<div class="book-card-actions">' +
        '<button class="btn btn-sm btn-primary" data-scene-action="scene-learn" data-scene="' + esc(sc.id) + '">📖 学习</button>' +
        '<button class="btn btn-sm" data-scene-action="scene-test" data-scene="' + esc(sc.id) + '">🖼️ 测试</button>' +
        '</div></div></div>';
    }).join('') + '</div>';

    html += '<div class="section-title"><h2>错题复习</h2></div>';
    html += '<div class="card"><div class="btn-row"><button class="btn btn-sm btn-primary" data-scene-action="scene-goto-errors">📕 生活场景错题本</button></div></div>';

    const pk = SceneStore.getPexelsKey();
    html += '<div class="section-title"><h2>⚙️ 单词真实配图（Pexels）</h2></div>';
    html += '<div class="card form-card">';
    html += '<p class="muted small">可选：填 Pexels API Key 后，学习卡片会显示单词的真实照片。key 只存在你本机浏览器，不会上传到网站。免费申请地址 pexels.com/api。</p>';
    html += '<div class="form-group"><label>Pexels API Key</label><input class="input" id="scenePexelsKey" value="' + esc(pk) + '" placeholder="粘贴你的 key"></div>';
    html += '<div class="btn-row"><button class="btn btn-primary" data-scene-action="scene-save-pexels">保存</button></div>';
    html += '</div>';
    return html;
  }

  function learn(params) {
    params = params || {};
    const sceneId = params.scene || '';
    const mode = params.mode || 'browse';
    if (!sceneId) return home();
    const sc = SceneStore.getScene(sceneId);
    if (!sc) return '<p class="muted">场景不存在。</p>';
    const words = SceneStore.getSceneWords(sceneId);
    let html = '<div class="page-head">';
    html += '<div class="page-head-row"><h1>' + esc(sc.name) + '</h1></div>';
    html += '<div class="scene-banner">' + scenePhoto(sc.photo, sc.icon) + '</div>';
    html += '<div class="btn-row">';
    html += '<button class="btn btn-sm" data-scene-action="scene-home">← 返回场景</button>';
    html += '<button class="btn btn-sm" data-scene-action="scene-mode" data-scene="' + esc(sceneId) + '" data-mode="browse"' + (mode === 'browse' ? ' disabled' : '') + '>列表浏览</button>';
    html += '<button class="btn btn-sm" data-scene-action="scene-mode" data-scene="' + esc(sceneId) + '" data-mode="card"' + (mode === 'card' ? ' disabled' : '') + '>卡片看图</button>';
    html += '<button class="btn btn-sm btn-primary" data-scene-action="scene-test" data-scene="' + esc(sceneId) + '">🖼️ 测试本场景</button>';
    html += '</div></div>';
    if (mode === 'card') return html + learnCard(sc, words);
    return html + learnBrowse(words);
  }

  function learnBrowse(words) {
    const st = SceneStore.getState();
    let html = '<div class="study-toolbar"><span class="muted small">共 ' + words.length + ' 词 · 点 🔊 发音，点 ⭐ 收进重要单词，点 ✅ 标记掌握</span></div>';
    html += '<div class="word-list">' + words.map(function (w) {
      const mastered = !!st.mastered[w.id];
      const imp = !!st.important.words[w.id];
      return '<div class="word-row scene-word-row">' +
        '<div class="scene-word-emoji">' + w.emoji + '</div>' +
        '<div class="word-row-main"><span class="word-h">' + esc(w.en) + '</span> ' + UI.posBadge(w.pos) + ' <span class="word-mean">' + esc(w.zh) + '</span></div>' +
        '<div class="word-row-side">' +
        (mastered ? '<span class="tag tag-green">已掌握</span>' : '') +
        '<button class="star-btn' + (imp ? ' on' : '') + '" data-scene-action="scene-toggle-important" data-wid="' + esc(w.id) + '" title="重要单词">' + (imp ? '★' : '☆') + '</button>' +
        '<button class="icon-btn" data-scene-action="scene-toggle-mastered" data-wid="' + esc(w.id) + '" title="标记/取消掌握">' + (mastered ? '✅' : '☑️') + '</button>' +
        '<button class="speak-btn" data-scene-action="scene-speak" data-en="' + esc(w.en) + '" title="发音">🔊</button>' +
        '</div></div>';
    }).join('') + '</div>';
    return html;
  }

  function learnCard(sc, words) {
    if (!words.length) return '<p class="muted">该场景还没有单词。</p>';
    const cs = SceneApp.cardState;
    if (cs.index >= words.length) cs.index = 0;
    const w = words[cs.index];
    const st = SceneStore.getState();
    const mastered = !!st.mastered[w.id];
    const inFreq = !!st.frequent.words[w.id];
    let html = '<div class="card-study">';
    html += '<div class="study-progress muted small">' + sc.icon + ' ' + esc(sc.name) + ' · ' + (cs.index + 1) + ' / ' + words.length + '</div>';
    html += '<div class="flashcard' + (cs.flipped ? ' flipped' : '') + '" id="sceneFlashcard">';
    html += '<div class="flash-inner">';
    html += '<div class="flash-front">' + wordPhoto(w.en, w.emoji) + '<div class="muted small">看图片，想英文</div></div>';
    html += '<div class="flash-back">';
    html += '<div class="flash-word">' + esc(w.en) + '</div>' + UI.posBadge(w.pos);
    html += '<div class="word-mean">' + esc(w.zh) + '</div>';
    html += '<button class="btn btn-sm" data-scene-action="scene-speak" data-en="' + esc(w.en) + '">🔊 发音</button>';
    html += '<div class="btn-row">' + starBtn(w) + '</div>';
    html += '</div></div></div>';
    html += '<div class="btn-row center">';
    html += '<button class="btn" data-scene-action="scene-card-prev">←</button>';
    html += '<button class="btn btn-primary" data-scene-action="scene-card-flip">翻面</button>';
    html += '<button class="btn" data-scene-action="scene-card-next">→</button>';
    html += '</div>';
    html += '<div class="btn-row center">';
    html += '<button class="btn btn-success' + (mastered ? ' on' : '') + '" data-scene-action="scene-card-know">认识 ✓</button>';
    html += '<button class="btn btn-danger' + (inFreq ? ' on' : '') + '" data-scene-action="scene-card-unknown">不认识 ✗</button>';
    html += '</div>';
    html += '<p class="muted small center">翻面显示英文并自动发音；点「认识」标记掌握并下一张；点「不认识」加入经常错词本。</p>';
    html += '</div>';
    return html;
  }  function test(params) {
    params = params || {};
    const preselect = params.scene || '';
    const scenes = SceneStore.getScenes();
    let html = '<div class="page-head"><h1>🖼️ 看图认词 · 测试</h1><p class="muted">看图片，写出英文单词（允许一个字母的小拼写错误）。答错自动进本场景错题本。</p></div>';
    html += '<div class="card form-card">';
    html += '<div class="form-group"><label>选择场景</label><select class="input" id="sceneTestScene">';
    html += '<option value="">请选择场景</option>';
    scenes.forEach(function (sc) { html += '<option value="' + esc(sc.id) + '"' + (sc.id === preselect ? ' selected' : '') + '>' + sc.icon + ' ' + esc(sc.name) + '</option>'; });
    html += '</select></div>';
    html += '<div class="form-group"><label>错题去向</label><div class="radio-row">';
    html += '<label class="radio"><input type="radio" name="sceneRoundKind" value="r1" checked> 第1次测试 → 第1次错题本</label>';
    html += '<label class="radio"><input type="radio" name="sceneRoundKind" value="r2"> 第2次完整测试 → 第2次错题本</label>';
    html += '</div><p class="muted small">第2次完整测试：把整场背完再测一遍，错词单独进第2次错题本。</p></div>';
    html += '<div id="sceneTestModeWrap"></div>';
    html += '</div>';
    html += '<div class="section-title"><h2>② 选项</h2></div>';
    html += '<div class="card form-card">';
    html += '<div class="form-group"><label class="check"><input type="checkbox" id="sceneOptShuffle" checked> 乱序出题</label></div>';
    html += '<div class="form-group"><label>单词数量</label><select class="input" id="sceneOptCount"><option value="all">全部</option><option value="20">20</option><option value="30">30</option><option value="50">50</option></select></div>';
    html += '<div class="btn-row"><button class="btn btn-primary btn-lg" data-scene-action="scene-start-test">开始测试 🚀</button></div>';
    html += '</div>';
    return html;
  }

  function quiz() {
    const q = SceneApp.quiz;
    if (!q) return '<p class="muted">没有进行中的测试。</p>';
    const w = q.words[q.idx];
    const qn = q.idx + 1, total = q.words.length;
    let html = '<div class="quiz-wrap">';
    html += '<div class="quiz-progress"><div class="progress"><div class="progress-bar" style="width:' + Math.round(qn / total * 100) + '%"></div></div><div class="muted small">🖼️ 看图认词 · 第 ' + qn + ' / ' + total + ' 题 · 已对 ' + q.correct + ' · 已错 ' + q.wrong + '</div></div>';
    html += '<div class="quiz-card card scene-quiz-card' + (q.revealed ? (q.lastCorrect ? ' quiz-correct' : ' quiz-wrong') : '') + '">';
    html += '<div class="scene-quiz-emoji">' + w.emoji + '</div>';
    if (!q.revealed) {
      if (q.hint) html += '<div class="muted small center">提示：首字母 ' + esc(w.en.charAt(0).toUpperCase()) + '，共 ' + w.en.length + ' 个字母</div>';
      html += '<textarea id="sceneQuizInput" class="input quiz-input" rows="2" placeholder="看图片，写出英文单词"></textarea>';
      html += '<div class="btn-row">';
      if (q.idx > 0) html += '<button class="btn" data-scene-action="scene-prev">← 上一题</button>';
      html += '<button class="btn" data-scene-action="scene-hint">💡 提示首字母</button>';
      html += '<button class="btn btn-primary btn-lg" data-scene-action="scene-submit">提交答案</button></div>';
      html += '<p class="muted small">快捷键：Enter 提交，再按 Enter 下一题</p>';
    } else {
      html += '<div class="quiz-verdict ' + (q.lastCorrect ? 'ok' : 'no') + '">' + (q.lastCorrect ? '答对 ✓' : '答错 ✗') + '</div>';
      if (q.lastInput) html += '<div class="quiz-your-answer">你的回答：' + esc(q.lastInput) + '</div>';
      html += '<div class="sense-list"><div class="sense-item' + (q.lastCorrect ? ' sense-hit' : ' sense-miss') + '">';
      html += '<div class="sense-mean"><span class="sense-mark">' + (q.lastCorrect ? '✓' : '✗') + '</span> <b>' + esc(w.en) + '</b> ' + UI.posBadge(w.pos) + '</div>';
      html += '<div class="muted small">' + esc(w.zh) + '</div>';
      html += '</div></div>';
      html += '<div class="btn-row">';
      html += '<button class="btn btn-sm" data-scene-action="scene-speak" data-en="' + esc(w.en) + '">🔊 发音</button>';
      html += starBtn(w);
      html += '</div>';
      html += '<div class="btn-row">';
      if (q.idx > 0) html += '<button class="btn" data-scene-action="scene-prev">← 上一题</button>';
      if (q.idx < total - 1) html += '<button class="btn btn-primary btn-lg" data-scene-action="scene-next">下一题 →</button>';
      else html += '<button class="btn btn-primary btn-lg" data-scene-action="scene-finish">查看测试结果 🎉</button>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }  function result() {
    const q = SceneApp.quiz;
    if (!q) return '<p class="muted">没有测试结果。</p>';
    const total = q.words.length;
    const acc = total ? Math.round(q.correct / total * 100) : 0;
    const wrongItems = q.results.filter(function (r) { return !r.correct; });
    let html = '<div class="page-head"><h1>测试结果</h1></div>';
    html += '<div class="result-hero card"><div class="result-score">' + acc + '%</div>';
    html += '<div class="result-line">答对 <b>' + q.correct + '</b> / ' + total + ' · 答错 <b>' + q.wrong + '</b> 词</div>';
    html += '<div class="result-line muted">错词已自动加入「' + esc(q.resultBookName) + '」</div></div>';
    if (wrongItems.length) {
      html += '<div class="section-title"><h2>错词复习（' + wrongItems.length + '）</h2></div>';
      html += '<div class="word-list">' + wrongItems.map(function (r) {
        const w = SceneStore.getWord(r.wid); if (!w) return '';
        return '<div class="word-row scene-word-row"><div class="scene-word-emoji">' + w.emoji + '</div>' +
          '<div class="word-row-main"><span class="word-h">' + esc(w.en) + '</span> <span class="word-mean">' + esc(w.zh) + '</span></div>' +
          '<div class="word-row-side"><button class="speak-btn" data-scene-action="scene-speak" data-en="' + esc(w.en) + '">🔊</button></div></div>';
      }).join('') + '</div>';
      html += '<div class="btn-row"><button class="btn btn-primary" data-scene-action="scene-retest-wrong">重测这 ' + wrongItems.length + ' 个错词</button></div>';
    } else {
      html += '<div class="card"><p class="muted">全部答对，太棒了！🎉</p></div>';
    }
    html += '<div class="btn-row"><button class="btn" data-scene-action="scene-home">返回场景</button><button class="btn" data-scene-action="scene-goto-errors">去看错题本</button></div>';
    return html;
  }

  function errors() {
    const st = SceneStore.getState();
    let html = '<div class="page-head"><h1>📕 生活场景错题本</h1><p class="muted">第一次测试的错词进「第1次错题本」；重测它再错的进子册，一轮轮缩小；整体二测单独成册；多次答错自动进「经常错词本」。</p></div>';

    const impCount = Object.keys(st.important.words).length;
    html += '<div class="section-title"><h2>⭐ 重要单词本（' + impCount + '）</h2></div>';
    if (!impCount) html += '<div class="card"><p class="muted">学习或测试时点 ⭐ 即可收进来。</p></div>';
    else html += '<div class="card error-book-card"><div class="eb-actions"><button class="btn btn-sm btn-primary" data-scene-action="scene-test-important">重测重要单词</button><button class="btn btn-sm" data-scene-action="scene-view-important">查看单词</button></div></div>';

    const freqCount = Object.keys(st.frequent.words).length;
    html += '<div class="section-title"><h2>🔥 经常错词本（' + freqCount + '）</h2></div>';
    if (!freqCount) html += '<div class="card"><p class="muted">暂无。累计答错 2 次以上的单词会自动收进来。</p></div>';
    else html += '<div class="card error-book-card"><div class="eb-actions"><button class="btn btn-sm btn-primary" data-scene-action="scene-test-frequent">重测经常错词</button><button class="btn btn-sm" data-scene-action="scene-view-frequent">查看单词</button></div></div>';

    SceneStore.getScenes().forEach(function (sc) {
      const roots = st.errorBooks.filter(function (e) { return e.sceneId === sc.id && !e.parentId; });
      const hasAny = st.errorBooks.some(function (e) { return e.sceneId === sc.id && Object.keys(e.words).length; });
      html += '<div class="section-title"><h2>' + sc.icon + ' ' + esc(sc.name) + ' 的错题本</h2></div>';
      if (!hasAny) { html += '<div class="card"><p class="muted">还没有错题。去测一轮，错词会自动进这里。</p></div>'; return; }
      function renderNode(eb, depth) {
        const cnt = Object.keys(eb.words).length;
        const masteredCnt = Object.keys(eb.words).filter(function (wid) { return eb.words[wid].mastered; }).length;
        if (!cnt && !depth) return '';
        let h = '<div class="card error-book-card" style="margin-left:' + (depth * 18) + 'px">';
        h += '<div class="eb-head"><div><span class="eb-name">' + esc(eb.name) + '</span>';
        h += '<span class="muted small">' + cnt + ' 词' + (masteredCnt ? ' · 已掌握 ' + masteredCnt : '') + ' · 第' + eb.round + '轮</span></div>';
        h += '<div class="eb-actions">';
        h += '<button class="btn btn-sm btn-primary" data-scene-action="scene-test-errorbook" data-eb="' + esc(eb.id) + '">重测</button>';
        h += '<button class="btn btn-sm" data-scene-action="scene-view-errorbook" data-eb="' + esc(eb.id) + '">单词</button>';
        h += '<button class="btn btn-sm btn-danger" data-scene-action="scene-clear-errorbook" data-eb="' + esc(eb.id) + '">清空</button>';
        h += '</div></div></div>';
        SceneStore.childrenOf(eb.id).forEach(function (ch) { h += renderNode(ch, depth + 1); });
        return h;
      }
      roots.forEach(function (r) { html += renderNode(r, 0); });
    });
    return html;
  }

  function listModal(title, words, mode, ebId) {
    let html = '<div class="modal-head"><h3>' + esc(title) + '</h3><button class="icon-btn" data-action="modal-close">✕</button></div>';
    html += '<div class="modal-body">';
    if (!words.length) html += '<p class="muted">暂无单词。</p>';
    html += '<div class="word-list">' + words.map(function (w) {
      let rm = '';
      if (mode === 'eb') rm = '<button class="btn btn-sm btn-danger" data-scene-action="scene-remove-error-word" data-eb="' + esc(ebId) + '" data-wid="' + esc(w.id) + '">移除</button>';
      else if (mode === 'important') rm = '<button class="btn btn-sm btn-danger" data-scene-action="scene-remove-important" data-wid="' + esc(w.id) + '">移除</button>';
      else if (mode === 'frequent') rm = '<button class="btn btn-sm btn-danger" data-scene-action="scene-remove-frequent" data-wid="' + esc(w.id) + '">移除</button>';
      return '<div class="word-row scene-word-row"><div class="scene-word-emoji">' + w.emoji + '</div>' +
        '<div class="word-row-main"><span class="word-h">' + esc(w.en) + '</span> <span class="word-mean">' + esc(w.zh) + '</span></div>' +
        '<div class="word-row-side"><button class="speak-btn" data-scene-action="scene-speak" data-en="' + esc(w.en) + '">🔊</button>' + rm + '</div></div>';
    }).join('') + '</div></div>';
    UI.modal(html, { size: 'lg' });
  }

  function ebWordsModal(ebId) {
    const eb = SceneStore.getErrorBook(ebId);
    if (!eb) return;
    listModal(eb.name, SceneStore.getErrorBookWords(eb), 'eb', ebId);
  }
  function importantModal() { listModal('⭐ 重要单词本', SceneStore.getImportantWords(), 'important'); }
  function frequentModal() { listModal('🔥 经常错词本', SceneStore.getFrequentWords(), 'frequent'); }

  return { home, learn, test, quiz, result, errors, ebWordsModal, importantModal, frequentModal };
})();const SceneApp = (function () {
  const current = { view: 'home', params: {} };
  let quiz = null;
  const cardState = { index: 0, flipped: false };

  function go(view, params) {
    current.view = view; current.params = params || {};
    App.render();
  }

  function html() {
    switch (current.view) {
      case 'learn': return SceneViews.learn(current.params);
      case 'test': return SceneViews.test(current.params);
      case 'quiz': return SceneViews.quiz();
      case 'result': return SceneViews.result();
      case 'errors': return SceneViews.errors();
      default: return SceneViews.home();
    }
  }



  function loadWordPhotos() {
    if (typeof fetch !== 'function') return;
    const key = SceneStore.getPexelsKey();
    if (!key) return;
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem('scene_pexels_cache') || '{}'); } catch (e) {}
    document.querySelectorAll('img.scene-word-photo[data-pexels]').forEach(function (img) {
      const q = img.getAttribute('data-pexels');
      if (!q) return;
      if (cache[q]) { img.onload = function () { img.style.display = ''; }; img.src = cache[q]; return; }
      const url = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(q) + '&per_page=1&orientation=square';
      fetch(url, { headers: { 'Authorization': key } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && j.photos && j.photos[0] && j.photos[0].src && j.photos[0].src.medium) {
          const src = j.photos[0].src.medium;
          cache[q] = src;
          try { localStorage.setItem('scene_pexels_cache', JSON.stringify(cache)); } catch (e) {}
          img.onload = function () { img.style.display = ''; };
          img.src = src;
        }
      }).catch(function () {});
    });
  }

  function afterRender() {
    updateTestMode();
    loadWordPhotos();
    const input = document.getElementById('sceneQuizInput');
    if (input && current.view === 'quiz' && quiz && !quiz.revealed) input.focus();
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function startQuiz(words, scope) {
    let list = (words || []).slice();
    if (scope.answeredIds && scope.answeredIds.length) {
      const done = new Set(scope.answeredIds);
      list = list.filter(function (w) { return !done.has(w.id); });
    }
    if (!list.length) { UI.toast('没有可测试的单词（这一轮已全部测过，可重新开始）', 'error'); return; }
    if (scope.shuffle) shuffle(list);
    if (scope.count && scope.count !== 'all' && list.length > parseInt(scope.count, 10)) list = list.slice(0, parseInt(scope.count, 10));
    scope.wordIds = list.map(function (w) { return w.id; });
    if (!scope.targetEbId) {
      if (scope.preset === 'scene') {
        const eb = SceneStore.ensureErrorBook({ sceneId: scope.sceneId, kind: scope.kind, parentId: scope.parentId || null });
        scope.targetEbId = eb.id; scope.masterIn = null; scope.ebName = eb.name;
      } else if (scope.preset === 'error' || scope.preset === 'retest') {
        const parent = SceneStore.getErrorBook(scope.parentEbId);
        if (parent) { const child = SceneStore.newSubErrorBook(parent.id); scope.targetEbId = child.id; scope.masterIn = parent.id; scope.ebName = child.name; }
      } else if (scope.preset === 'frequent') { scope.targetEbId = null; scope.masterIn = null; scope.ebName = '经常错词本'; }
      else if (scope.preset === 'important') { scope.targetEbId = null; scope.masterIn = null; scope.ebName = '重要单词本'; }
    }
    scope.resultEbId = scope.targetEbId || scope.parentEbId || null;
    if (!scope.sessionKey) scope.sessionKey = SceneStore.sessionKey(scope);
    if (!scope.answeredIds) scope.answeredIds = [];
    SceneStore.saveTestSession(scope.sessionKey, scope, scope.answeredIds);
    quiz = { words: list, idx: 0, results: [], correct: 0, wrong: 0, revealed: false, lastCorrect: false, lastInput: '', hint: false, scope: scope, resultBookName: '', startTime: Date.now() };
    go('quiz');
  }

  function startTest() {
    const sel = document.getElementById('sceneTestScene');
    const sceneId = sel ? sel.value : '';
    const sc = SceneStore.getScene(sceneId);
    if (!sc) { UI.toast('请选择一个场景', 'error'); return; }
    const kindEl = document.querySelector('input[name="sceneRoundKind"]:checked');
    const kind = kindEl ? kindEl.value : 'r1';
    const words = SceneStore.getSceneWords(sceneId);
    const scope = {
      preset: 'scene', sceneId: sceneId, kind: kind, parentId: null,
      shuffle: document.getElementById('sceneOptShuffle').checked,
      count: document.getElementById('sceneOptCount').value,
      scopeLabel: sc.icon + ' ' + sc.name
    };
    const key = SceneStore.sessionKey(scope);
    const modeEl = document.querySelector('input[name="sceneTestMode"]:checked');
    const mode = modeEl ? modeEl.value : 'fresh';
    const saved = SceneStore.getTestSession(key);
    let wordsQ = words;
    if (mode === 'continue' && saved) {
      scope.answeredIds = saved.answered || [];
      scope.targetEbId = saved.scope.targetEbId;
      scope.masterIn = saved.scope.masterIn;
      scope.ebName = saved.scope.ebName;
      scope.sessionKey = key;
      if (saved.scope.wordIds && saved.scope.wordIds.length) wordsQ = saved.scope.wordIds.map(SceneStore.getWord).filter(Boolean);
    } else {
      SceneStore.clearTestSession(key);
      scope.answeredIds = [];
    }
    startQuiz(wordsQ, scope);
  }

  function updateTestMode() {
    const wrap = document.getElementById('sceneTestModeWrap');
    if (!wrap) return;
    const sel = document.getElementById('sceneTestScene');
    const sceneId = sel ? sel.value : '';
    if (!sceneId) { wrap.innerHTML = ''; return; }
    const kindEl = document.querySelector('input[name="sceneRoundKind"]:checked');
    const kind = kindEl ? kindEl.value : 'r1';
    const scope = { preset: 'scene', sceneId: sceneId, kind: kind };
    const key = SceneStore.sessionKey(scope);
    const saved = SceneStore.getTestSession(key);
    const words = SceneStore.getSceneWords(sceneId);
    let total = words.length;
    const answered = (saved && saved.answered) ? saved.answered.length : 0;
    if (saved && saved.scope && saved.scope.wordIds && saved.scope.wordIds.length) total = saved.scope.wordIds.length;
    const remain = Math.max(0, total - answered);
    if (saved && answered > 0) {
      wrap.innerHTML = '<div class="form-group"><label>测试方式（上次测了 ' + answered + ' / ' + total + ' 词）</label><div class="radio-row">' +
        '<label class="radio"><input type="radio" name="sceneTestMode" value="continue" checked> 继续上次（剩余 ' + remain + ' 词）</label>' +
        '<label class="radio"><input type="radio" name="sceneTestMode" value="fresh"> 重新开始这一场景</label></div></div>';
    } else {
      wrap.innerHTML = '<div class="form-group"><label>测试方式</label><p class="muted small">开始新一轮测试；中途退出后下次可选择「继续上次」。</p></div>';
    }
  }  function submit() {
    if (!quiz || quiz.revealed) return;
    const w = quiz.words[quiz.idx];
    const input = document.getElementById('sceneQuizInput');
    const val = input ? input.value : '';
    const ev = SceneStore.evaluateAnswer(w, val);
    quiz.results[quiz.idx] = { wid: w.id, correct: ev.correct, input: ev.input };
    quiz.revealed = true; quiz.lastCorrect = ev.correct; quiz.lastInput = ev.input;
    if (ev.correct) quiz.correct++; else quiz.wrong++;
    const sc = quiz.scope;
    if (ev.correct) SceneStore.markCorrectWord(w.id, sc.masterIn);
    else {
      if (sc.preset === 'frequent') SceneStore.bumpWordStats(w.id);
      else if (sc.preset === 'important') SceneStore.recordWrongWord({ sceneId: w.sceneId, kind: 'r1', wid: w.id });
      else SceneStore.recordWrongWord({ sceneId: sc.sceneId, kind: sc.kind, parentId: sc.parentId || null, targetEbId: sc.targetEbId, wid: w.id });
    }
    if (sc.sessionKey) { if (!sc.answeredIds) sc.answeredIds = []; if (!sc.answeredIds.includes(w.id)) sc.answeredIds.push(w.id); SceneStore.saveTestSession(sc.sessionKey, sc, sc.answeredIds); }
    App.render();
  }
  function next() {
    if (!quiz) return;
    quiz.idx++;
    const r = quiz.results[quiz.idx];
    if (r) { quiz.revealed = true; quiz.lastCorrect = r.correct; quiz.lastInput = r.input; }
    else { quiz.revealed = false; quiz.hint = false; }
    App.render();
  }
  function prev() {
    if (!quiz || quiz.idx <= 0) return;
    quiz.idx--;
    const r = quiz.results[quiz.idx];
    if (r) { quiz.revealed = true; quiz.lastCorrect = r.correct; quiz.lastInput = r.input; }
    else { quiz.revealed = false; quiz.hint = false; }
    App.render();
  }
  function hint() { if (quiz && !quiz.revealed) { quiz.hint = true; App.render(); } }
  function finish() {
    if (!quiz) return;
    SceneStore.finishTestStats(quiz.words.length, quiz.correct);
    quiz.resultBookName = quiz.scope.ebName || '';
    if (quiz.scope.sessionKey) SceneStore.clearTestSession(quiz.scope.sessionKey);
    quiz.finished = true;
    go('result');
  }
  function retestWrong() {
    if (!quiz) return;
    const wids = quiz.results.filter(function (r) { return !r.correct; }).map(function (r) { return r.wid; });
    const words = wids.map(SceneStore.getWord).filter(Boolean);
    if (!words.length) { UI.toast('没有错词', 'error'); return; }
    startQuiz(words, { preset: 'retest', sceneId: quiz.scope.sceneId, kind: 'sub', parentEbId: quiz.scope.parentEbId || quiz.scope.resultEbId, shuffle: true, count: 'all', scopeLabel: '错词重测（' + words.length + '）' });
  }
  function testErrorBook(ebId) {
    const eb = SceneStore.getErrorBook(ebId);
    if (!eb) return;
    const words = SceneStore.getErrorBookWords(eb);
    if (!words.length) { UI.toast('该错题本没有单词', 'error'); return; }
    startQuiz(words, { preset: 'error', sceneId: eb.sceneId, kind: 'sub', parentEbId: eb.id, shuffle: true, count: 'all', scopeLabel: eb.name });
  }
  function testFrequent() {
    const words = SceneStore.getFrequentWords();
    if (!words.length) { UI.toast('经常错词本没有单词', 'error'); return; }
    startQuiz(words, { preset: 'frequent', shuffle: true, count: 'all', scopeLabel: '经常错词本' });
  }
  function testImportant() {
    const words = SceneStore.getImportantWords();
    if (!words.length) { UI.toast('重要单词本没有单词', 'error'); return; }
    startQuiz(words, { preset: 'important', shuffle: true, count: 'all', scopeLabel: '重要单词本' });
  }

  function cardReset() { cardState.index = 0; cardState.flipped = false; }
  function cardFlip() {
    cardState.flipped = !cardState.flipped;
    if (cardState.flipped) {
      const words = SceneStore.getSceneWords(current.params.scene);
      const w = words[cardState.index];
      if (w) Speech.speak(w.en);
    }
    App.render();
  }
  function cardMove(d) {
    const words = SceneStore.getSceneWords(current.params.scene);
    const next = cardState.index + d;
    if (next < 0 || next >= words.length) { UI.toast(next < 0 ? '已经是第一张' : '已经是最后一张'); return; }
    cardState.index = next; cardState.flipped = false;
    App.render();
  }
  function cardMark(know) {
    const words = SceneStore.getSceneWords(current.params.scene);
    const w = words[cardState.index];
    if (!w) return;
    if (know) {
      SceneStore.markMastered(w.id, true); UI.toast('已标记掌握');
      if (cardState.index < words.length - 1) { cardState.index++; cardState.flipped = false; App.render(); }
    } else {
      SceneStore.toggleFrequent(w.id, true); UI.toast('已加入经常错词本');
    }
  }

  function handle(el) {
    const a = el.dataset.sceneAction;
    switch (a) {
      case 'scene-home': cardReset(); go('home'); break;
      case 'scene-learn': cardReset(); go('learn', { scene: el.dataset.scene, mode: 'browse' }); break;
      case 'scene-mode': cardReset(); go('learn', { scene: el.dataset.scene, mode: el.dataset.mode }); break;
      case 'scene-test': go('test', { scene: el.dataset.scene }); break;
      case 'scene-goto-errors': go('errors'); break;
      case 'scene-save-pexels':
        (function () {
          const input = document.getElementById('scenePexelsKey');
          SceneStore.setPexelsKey(input ? input.value : '');
          UI.toast('已保存 Pexels Key ✓');
          App.render();
        })();
        break;
      case 'scene-start-test': startTest(); break;
      case 'scene-submit': submit(); break;
      case 'scene-next': next(); break;
      case 'scene-prev': prev(); break;
      case 'scene-hint': hint(); break;
      case 'scene-finish': finish(); break;
      case 'scene-retest-wrong': retestWrong(); break;
      case 'scene-speak': Speech.speak(el.dataset.en); break;
      case 'scene-toggle-important':
        (function () {
          const wid = el.dataset.wid;
          const on = !SceneStore.getState().important.words[wid];
          SceneStore.toggleImportant(wid, on);
          UI.toast(on ? '已加入重要单词本 ⭐' : '已移出重要单词本');
          if (el.classList && el.classList.contains('star-btn')) {
            if (el.textContent.indexOf('重要') >= 0) el.textContent = on ? '★ 已在重要本' : '☆ 加入重要本';
            else el.textContent = on ? '★' : '☆';
            el.classList.toggle('on', on);
            el.title = on ? '移出重要单词本' : '加入重要单词本';
          } else { App.render(); }
        })();
        break;
      case 'scene-toggle-mastered':
        (function () {
          const wid = el.dataset.wid;
          const on = !SceneStore.getState().mastered[wid];
          SceneStore.markMastered(wid, on);
          UI.toast(on ? '已标记掌握 ✅' : '已取消掌握');
          App.render();
        })();
        break;
      case 'scene-card-prev': cardMove(-1); break;
      case 'scene-card-next': cardMove(1); break;
      case 'scene-card-flip': cardFlip(); break;
      case 'scene-card-know': cardMark(true); break;
      case 'scene-card-unknown': cardMark(false); break;
      case 'scene-test-errorbook': testErrorBook(el.dataset.eb); break;
      case 'scene-view-errorbook': SceneViews.ebWordsModal(el.dataset.eb); break;
      case 'scene-clear-errorbook':
        UI.confirmBox('清空错题本', '确定清空这个错题本的所有单词吗？此操作不可恢复。', function () {
          SceneStore.clearErrorBook(el.dataset.eb); UI.toast('已清空'); App.render();
        }, { yesText: '清空' });
        break;
      case 'scene-remove-error-word':
        SceneStore.removeErrorWord(el.dataset.eb, el.dataset.wid); UI.toast('已移出'); SceneViews.ebWordsModal(el.dataset.eb);
        break;
      case 'scene-test-frequent': testFrequent(); break;
      case 'scene-test-important': testImportant(); break;
      case 'scene-view-frequent': SceneViews.frequentModal(); break;
      case 'scene-view-important': SceneViews.importantModal(); break;
      case 'scene-remove-frequent':
        SceneStore.removeFrequent(el.dataset.wid); UI.toast('已移出经常错词本'); SceneViews.frequentModal();
        break;
      case 'scene-remove-important':
        SceneStore.removeImportant(el.dataset.wid); UI.toast('已移出重要单词本'); SceneViews.importantModal();
        break;
    }
  }

  function bind() {
    document.addEventListener('click', function (e) {
      const el = e.target.closest('[data-scene-action]');
      if (!el) return;
      e.preventDefault();
      handle(el);
    });
    document.addEventListener('change', function (e) {
      if (!e.target) return;
      if (e.target.id === 'sceneTestScene' || e.target.name === 'sceneRoundKind') updateTestMode();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      const t = e.target;
      if (t && t.id === 'sceneQuizInput') {
        if (!e.shiftKey) { e.preventDefault(); e.stopPropagation(); submit(); }
        return;
      }
      if (t && t.tagName && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(t.tagName)) return;
      if (current.view !== 'quiz') return;
      if (!quiz || !quiz.revealed || quiz.finished) return;
      if (!document.querySelector('.scene-quiz-card')) return;
      e.preventDefault();
      if (quiz.idx < quiz.words.length - 1) next(); else finish();
    });
  }

  bind();

  return { html, afterRender, cardState };
})();