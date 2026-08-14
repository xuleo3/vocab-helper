// ============================================================
// Store：状态管理 + localStorage 持久化 + 错题本体系 + 语义判分
// ============================================================
const Store = (function () {
  const LS_KEY = 'vocab_app_v1';
  let state = null;

  function defaultState() {
    return {
      words: {},        // id -> word
      books: [],        // [{id,name,examType,source,units,wordIds,createdAt}]
      errorBooks: [],   // [{id,bookId,parentId,kind,name,round,words:{wid:{wrongCount,missedSenses:[],firstAt,lastAt,mastered}},createdAt}]
      frequent: { words: {} },  // wid -> {wrongCount,firstAt,lastAt,manual}
      important: { words: {} },  // 重要单词本：wid -> {addedAt}
      testSessions: {},  // 进行中的测试会话：key -> {scope, answered, startedAt, updatedAt}
      mastered: {},     // wid -> ts
      wordStats: {},    // wid -> {wrongCount,firstAt,lastAt}
      settings: {
        defaultExam: 'cet6', ttsLang: 'auto', ttsRate: 0.95, autoSpeak: true,
        polysemy: 'lenient', freqThreshold: 2, autoMaster: true, theme: 'light'
      },
      builtinVersion: 0,
      wangluVersion: 0,
      settingsVersion: 1,
      sync: { cloud: null, lastSavedAt: 0 },
      stats: { testsTaken: 0, answered: 0, correct: 0, startDate: Date.now() },
      activity: []      // [{time,text,kind}]
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) state = Object.assign(defaultState(), JSON.parse(raw));
      else state = defaultState();
    } catch (e) { state = defaultState(); }
    const d = defaultState();
    state.settings = Object.assign(d.settings, state.settings || {});
    state.stats = Object.assign(d.stats, state.stats || {});
    state.wordStats = state.wordStats || {};
    state.frequent = state.frequent || { words: {} };
    state.important = state.important || { words: {} };
    state.testSessions = state.testSessions || {};
    state.activity = state.activity || [];
    state.errorBooks = state.errorBooks || [];
    state.mastered = state.mastered || {};
    return state;
  }

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { if (window.UI) UI.toast('保存失败：浏览器存储空间不足', 'error'); }
  }
  function save() {
    persist();
    // 云同步：本地有变化时自动上传（由 CloudSync 去重/节流）
    if (window.CloudSync) CloudSync.onLocalSave();
  }
  function saveQuiet() { persist(); }

  function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---------- 内置词库初始化（幂等） ----------
  function initBuiltin() {
    const ver = (window.BUILTIN_VERSION || 0);
    const wver = (window.WANGLU_VERSION || 0);
    const hasBuiltin = state.books.some(b => b.source === 'builtin');
    const hasWan = state.books.some(b => b.id === 'wanglu');
    const wanChanged = (state.wangluVersion || 0) !== wver;
    if (state.builtinVersion === ver && hasBuiltin && (!wver || (hasWan && !wanChanged))) return;
    // 数据版本变化：只重建内置词库的【词表/单元结构】，【学习进度一律保留】。
    // 单词 id 是稳定的，已掌握/错题本/重要单词本/错词统计都按单词 id 记录，
    // 因此单元拆分、词库更新都不会让进度失效。
    state.books = state.books.filter(b => b.source !== 'builtin');
    if (state.settingsVersion !== 1) {
      state.settings = Object.assign(defaultState().settings);
      state.settingsVersion = 1;
    }
    BUILTIN.books.forEach(def => {
      const wordIds = [];
      const units = def.units.map(u => ({ id: u.id, name: u.name, wordIds: u.wordIds.slice() }));
      units.forEach(u => u.wordIds.forEach(wid => { wordIds.push(wid); }));
      state.books.push({ id: def.id, name: def.name, examType: def.examType, source: 'builtin', units, wordIds, createdAt: Date.now() });
    });
    // 王陆雅思听力语料库（独立数据文件 js/wanglu_data.js，不影响既有词库与进度）
    if (window.WANGLU_BOOK && !state.books.some(b => b.id === WANGLU_BOOK.id)) {
      const def = WANGLU_BOOK;
      const wordIds = [];
      const units = def.units.map(u => ({ id: u.id, name: u.name, wordIds: u.wordIds.slice() }));
      units.forEach(u => u.wordIds.forEach(wid => { wordIds.push(wid); }));
      state.books.push({ id: def.id, name: def.name, examType: def.examType, source: 'builtin', kind: def.kind || 'listening', units, wordIds, createdAt: Date.now() });
    }
    state.wangluVersion = wver;
    state.builtinVersion = ver;
    save();
  }

  // ---------- 查询 ----------
  function getWord(id) {
    if (state.words[id]) return state.words[id];
    if (window.BUILTIN && BUILTIN.words && BUILTIN.words[id]) return BUILTIN.words[id];
    if (window.WANGLU_WORDS && WANGLU_WORDS[id]) return WANGLU_WORDS[id];
    return null;
  }
  function getBook(id) { return state.books.find(b => b.id === id) || null; }
  function getBookWords(bookId) {
    const b = getBook(bookId); if (!b) return [];
    return b.wordIds.map(id => getWord(id)).filter(Boolean);
  }
  function getUnitWords(bookId, unitId) {
    const b = getBook(bookId); if (!b) return [];
    const u = b.units.find(x => x.id === unitId); if (!u) return [];
    return u.wordIds.map(id => getWord(id)).filter(Boolean);
  }
  function getErrorBook(id) { return state.errorBooks.find(b => b.id === id) || null; }
  function getErrorBookWords(eb) {
    if (!eb) return [];
    return Object.keys(eb.words).map(id => getWord(id)).filter(Boolean);
  }
  // 单词所属单元名称 / 按名称找单元 id
  function unitNameOf(w) {
    if (!w || w.unit == null) return '';
    const b = getBook(w.bookId);
    if (!b || !b.units) return '';
    const u = b.units[w.unit];
    return u ? u.name : '';
  }
  function getUnitIdByName(bookId, name) {
    const b = getBook(bookId);
    if (!b || !b.units) return '';
    const u = b.units.find(x => x.name === name);
    return u ? u.id : '';
  }
  function getFrequentWords() {
    return Object.keys(state.frequent.words).map(id => getWord(id)).filter(Boolean);
  }
  function childrenOf(ebId) { return state.errorBooks.filter(b => b.parentId === ebId); }

  function totalWrong(wid) { return (state.wordStats[wid] && state.wordStats[wid].wrongCount) || 0; }

  // ---------- 错题本 ----------
  function errorBookName(book, kind, parent) {
    if (kind === 'r1') return book.name + ' · 第1次错题本';
    if (kind === 'r2') return book.name + ' · 第2次错题本';
    if (kind === 'sub' && parent) return parent.name + ' · 第' + childRound(parent) + '轮';
    return book.name + ' · 错题本';
  }
  function nextSubRound(parent) {
    const ch = childrenOf(parent.id);
    const max = ch.reduce((m, c) => Math.max(m, c.round || 1), 0);
    return max + 1;
  }
  // 每次重测错题本时新建一个子册（新一轮）
  function newSubErrorBook(parentId) {
    const parent = getErrorBook(parentId);
    const book = parent ? getBook(parent.bookId) : null;
    const round = parent ? childRound(parent) : 1;
    const eb = {
      id: uid(), bookId: parent ? parent.bookId : null, parentId: parentId || null, kind: 'sub',
      name: (parent ? parent.name : '错题本') + ' · 第' + round + '轮',
      round: round, words: {}, createdAt: Date.now()
    };
    state.errorBooks.push(eb);
    save();
    return eb;
  }

  // 子册轮次：至少是父册的下一轮，且不与已有子册重复
  function childRound(parent) {
    const base = (parent && parent.round ? parent.round : 0) + 1;
    const existing = childrenOf(parent.id).reduce((m, c) => Math.max(m, c.round || 1), 0) + 1;
    return Math.max(base, existing);
  }
  function ensureErrorBook({ bookId, kind, parentId }) {
    let eb = state.errorBooks.find(b => b.bookId === bookId && b.kind === kind && (b.parentId || null) === (parentId || null));
    if (!eb) {
      const book = getBook(bookId);
      const parent = parentId ? getErrorBook(parentId) : null;
      eb = {
        id: uid(), bookId, parentId: parentId || null, kind,
        name: errorBookName(book, kind, parent),
        round: kind === 'sub' ? (parent ? childRound(parent) : 1) : (kind === 'r1' ? 1 : 2),
        words: {}, createdAt: Date.now()
      };
      state.errorBooks.push(eb);
    }
    return eb;
  }

  // 记录一次测试结果
  // opts: { bookId, kind, parentId, scopeLabel, wrongList:[{wid, missedSenses:[]}], correctList:[wid], masterInBookId }
  function recordTest(opts) {
    const now = Date.now();
    const eb = opts.targetEbId ? getErrorBook(opts.targetEbId) : ensureErrorBook({ bookId: opts.bookId, kind: opts.kind, parentId: opts.parentId });
    const freqThreshold = state.settings.freqThreshold;

    (opts.wrongList || []).forEach(it => {
      const w = getWord(it.wid); if (!w) return;
      const entry = eb.words[it.wid] || (eb.words[it.wid] = { wrongCount: 0, missedSenses: [], firstAt: now, lastAt: now, mastered: false });
      entry.wrongCount++;
      entry.lastAt = now;
      entry.mastered = false;
      (it.missedSenses || []).forEach(mi => { if (!entry.missedSenses.includes(mi)) entry.missedSenses.push(mi); });
      const ws = state.wordStats[it.wid] || (state.wordStats[it.wid] = { wrongCount: 0, firstAt: now, lastAt: now });
      ws.wrongCount++; ws.lastAt = now;
      if (ws.wrongCount >= freqThreshold && !state.frequent.words[it.wid]) {
        state.frequent.words[it.wid] = { wrongCount: ws.wrongCount, firstAt: ws.firstAt, lastAt: ws.lastAt, manual: false };
      }
      delete state.mastered[it.wid];
    });

    (opts.correctList || []).forEach(wid => {
      if (state.settings.autoMaster) state.mastered[wid] = now;
      if (opts.masterInBookId) {
        const p = getErrorBook(opts.masterInBookId);
        if (p && p.words[wid]) p.words[wid].mastered = true;
      }
    });

    state.stats.testsTaken++;
    state.stats.answered += (opts.wrongList ? opts.wrongList.length : 0) + (opts.correctList ? opts.correctList.length : 0);
    state.stats.correct += opts.correctList ? opts.correctList.length : 0;
    addActivity('test', '完成「' + opts.scopeLabel + '」测试：答对 ' + (opts.correctList ? opts.correctList.length : 0) + '，答错 ' + (opts.wrongList ? opts.wrongList.length : 0) + ' → 错词已加入「' + eb.name + '」');
    save();
    return eb;
  }

  function removeErrorWord(ebId, wid) {
    const eb = getErrorBook(ebId); if (!eb) return;
    delete eb.words[wid]; save();
  }
  function clearErrorBook(ebId) {
    const eb = getErrorBook(ebId); if (!eb) return;
    eb.words = {}; save();
  }
  function toggleFrequent(wid, on) {
    const ws = state.wordStats[wid] || (state.wordStats[wid] = { wrongCount: 0, firstAt: Date.now(), lastAt: Date.now() });
    if (on) state.frequent.words[wid] = { wrongCount: ws.wrongCount, firstAt: ws.firstAt, lastAt: ws.lastAt, manual: true };
    else delete state.frequent.words[wid];
    save();
  }
  function removeFrequent(wid) { delete state.frequent.words[wid]; save(); }

  // ---------- 重要单词本 ----------
  function toggleImportant(wid, on) {
    if (on) state.important.words[wid] = { addedAt: Date.now() };
    else delete state.important.words[wid];
    save();
  }
  function removeImportant(wid) { delete state.important.words[wid]; save(); }
  function getImportantWords() {
    return Object.keys(state.important.words).map(id => getWord(id)).filter(Boolean);
  }

  // ---------- 测试实时记录 ----------
  // 单次答错：立即写入错题本（不增加"测试次数"）
  function recordWrongWord(opts) {
    const w = getWord(opts.wid);
    if (!w) return null;
    const eb = opts.targetEbId ? getErrorBook(opts.targetEbId) : ensureErrorBook({ bookId: opts.bookId, kind: opts.kind, parentId: opts.parentId });
    const now = Date.now();
    if (eb) {
      const entry = eb.words[opts.wid] || (eb.words[opts.wid] = { wrongCount: 0, missedSenses: [], firstAt: now, lastAt: now, mastered: false });
      entry.wrongCount++;
      entry.lastAt = now;
      entry.mastered = false;
      (opts.missedSenses || []).forEach(mi => { if (!entry.missedSenses.includes(mi)) entry.missedSenses.push(mi); });
    }
    const ws = state.wordStats[opts.wid] || (state.wordStats[opts.wid] = { wrongCount: 0, firstAt: now, lastAt: now });
    ws.wrongCount++; ws.lastAt = now;
    if (ws.wrongCount >= state.settings.freqThreshold && !state.frequent.words[opts.wid]) {
      state.frequent.words[opts.wid] = { wrongCount: ws.wrongCount, firstAt: ws.firstAt, lastAt: ws.lastAt, manual: false };
    }
    delete state.mastered[opts.wid];
    save();
    return eb;
  }
  // 单次答对：标记掌握 / 在父错题本标记已掌握
  function markCorrectWord(wid, masterInBookId) {
    const now = Date.now();
    if (state.settings.autoMaster) state.mastered[wid] = now;
    if (masterInBookId) {
      const p = getErrorBook(masterInBookId);
      if (p && p.words[wid]) p.words[wid].mastered = true;
    }
    save();
  }
  // 答错累计（不写入错题本，用于"经常错词"测试等场景）
  function bumpWordStats(wid) {
    const now = Date.now();
    const ws = state.wordStats[wid] || (state.wordStats[wid] = { wrongCount: 0, firstAt: now, lastAt: now });
    ws.wrongCount++; ws.lastAt = now;
    delete state.mastered[wid];
    save();
  }
  // 结束测试：累计统计
  function finishTestStats(answered, correct) {
    state.stats.testsTaken++;
    state.stats.answered += answered;
    state.stats.correct += correct;
    save();
  }

  // ---------- 测试会话（支持"继续上次测试"） ----------
  function sessionKey(scope) {
    if (!scope) return '';
    if (scope.preset === 'book') return 'bk_' + scope.bookId + '_' + (scope.unitId || 'all') + '_' + scope.kind;
    if (scope.preset === 'error' || scope.preset === 'retest') return 'eb_' + scope.parentEbId;
    if (scope.preset === 'frequent') return 'freq';
    if (scope.preset === 'important') return 'imp';
    return '';
  }
  function saveTestSession(key, scope, answered) {
    state.testSessions[key] = { scope: scope, answered: answered || [], startedAt: Date.now(), updatedAt: Date.now() };
    save();
  }
  function getTestSession(key) { return state.testSessions[key] || null; }
  function clearTestSession(key) { if (key) delete state.testSessions[key]; save(); }

  function markMastered(wid, on) {
    if (on) state.mastered[wid] = Date.now(); else delete state.mastered[wid];
    save();
  }

  function addActivity(kind, text) {
    state.activity.unshift({ time: Date.now(), kind, text });
    if (state.activity.length > 30) state.activity.length = 30;
  }

  // ---------- 语义判分 ----------
  function normalize(s) {
    return (s || '').toLowerCase().replace(/[\s\u3000，。、；;：:,.!！?？()（）\[\]\"'“”‘’\-—\/]+/g, '').trim();
  }
  function senseTokens(meaning) {
    return (meaning || '').split(/[，,、；;\/]/).map(s => normalize(s)).filter(s => s.length > 0);
  }
  // 编辑距离（字符级）
  function lev(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
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
  // 中文模糊匹配：同义/近义也算对
  function fuzzyMatch(input, token) {
    if (!input || !token) return false;
    if (input === token) return true;
    if (input.includes(token) || token.includes(input)) return true;
    const strip = function (s) { return s.replace(/[的地得了着过]$/g, ''); };
    const ai = strip(input), at = strip(token);
    if (ai === at) return true;
    if (ai.length >= 2 && at.length >= 2) {
      const d = lev(ai, at);
      if (d <= 1) return true;
      if (ai.length === at.length && ai[ai.length - 1] === at[at.length - 1] && d <= 2) return true;
    }
    return false;
  }
  function senseMatched(word, senseIdx, inputNorm) {
    const sense = (word.senses || [])[senseIdx];
    if (!sense || !inputNorm) return false;
    const tokens = senseTokens(sense.meaning);
    for (const t of tokens) {
      if (fuzzyMatch(inputNorm, t)) return true;
    }
    const syns = (word.synonyms || []).map(s => normalize(s)).filter(Boolean);
    for (const s of syns) {
      if (inputNorm === s) return true;
      if (s.length >= 3 && (inputNorm.includes(s) || s.includes(inputNorm))) return true;
    }
    return false;
  }
  function evaluateAnswer(word, input) {
    const n = normalize(input);
    const total = (word.senses || []).length || 1;
    const matched = (word.senses || []).map((_, i) => senseMatched(word, i, n));
    const hasMeaning = (word.senses || []).some(s => (s.meaning || '').trim().length > 0);
    const matchedCount = matched.filter(Boolean).length;
    const any = hasMeaning ? matchedCount > 0 : true;
    const all = hasMeaning ? matchedCount === total : true;
    const missed = (word.senses || []).map((_, i) => i).filter(i => !matched[i]);
    return { matched, matchedCount, total, any, all, missed, inputNorm: n };
  }
  function isCorrect(word, ev) {
    if (!ev) return false;
    return state.settings.polysemy === 'strict' ? ev.all : ev.any;
  }

  // ---------- 导入词库（由 importer 调用） ----------
  function addImportedBook(name, examType, rawWords) {
    const bookId = 'imp_' + Date.now().toString(36);
    const unitDef = { id: bookId + '_u1', name: '第1单元', wordIds: [] };
    const wordIds = [];
    rawWords.forEach((rw, i) => {
      const id = bookId + '_w' + i;
      const meaning = rw.meaning || '';
      const senses = meaning ? splitSenses(meaning) : [{ meaning: '' }];
      if (rw.examples && rw.examples.length) senses[0].examples = rw.examples;
      state.words[id] = {
        id, headword: rw.headword, phonetic: rw.phonetic || '', pos: rw.pos || '',
        examType, bookId, unit: 0, senses, collocations: rw.collocations || [],
        tips: rw.tips || [], synonyms: rw.synonyms || []
      };
      unitDef.wordIds.push(id); wordIds.push(id);
    });
    state.books.push({ id: bookId, name, examType, source: 'imported', units: [unitDef], wordIds, createdAt: Date.now() });
    addActivity('import', '导入词库「' + name + '」：' + wordIds.length + ' 词');
    save();
    return state.books[state.books.length - 1];
  }

  function splitSenses(meaning) {
    const parts = meaning.split(/[；;]/).map(s => s.trim()).filter(Boolean);
    return parts.length ? parts.map(p => ({ meaning: p, examples: [] })) : [{ meaning: meaning || '', examples: [] }];
  }

  // ---------- 删除词库 ----------
  function deleteBook(bookId) {
    const b = getBook(bookId); if (!b) return;
    const ids = b.wordIds;
    ids.forEach(id => { delete state.words[id]; delete state.mastered[id]; delete state.wordStats[id]; delete state.frequent.words[id]; });
    state.books = state.books.filter(x => x.id !== bookId);
    state.errorBooks = state.errorBooks.filter(x => x.bookId !== bookId);
    Object.keys(state.frequent.words).forEach(wid => { if (ids.includes(wid)) delete state.frequent.words[wid]; });
    save();
  }

  // ---------- 单词编辑 ----------
  function updateWord(wid, patch) {
    const w = state.words[wid]; if (!w) return;
    Object.assign(w, patch);
    save();
  }

  // ---------- 设置 ----------
  function setSettings(patch) {
    state.settings = Object.assign(state.settings, patch);
    save();
  }
  function setTheme(t) { state.settings.theme = t; save(); }

  // ---------- 备份 ----------
  function exportData() { return JSON.stringify(state); }
  function importData(json) {
    const parsed = JSON.parse(json);
    if (!parsed.words || !parsed.books) throw new Error('不是有效的备份文件');
    state = Object.assign(defaultState(), parsed);
    save();
  }
  function resetAll() {
    state = defaultState();
    initBuiltin();
    save();
  }

  // ---------- 统计 ----------
  function progress(bookId) {
    const words = getBookWords(bookId);
    const learned = words.filter(w => state.mastered[w.id]).length;
    return { total: words.length, learned, pct: words.length ? Math.round(learned / words.length * 100) : 0 };
  }
  function overallStats() {
    const totalWords = state.books.reduce((s, b) => s + b.wordIds.length, 0);
    const mastered = Object.keys(state.mastered).length;
    const errorBooks = state.errorBooks.filter(b => Object.keys(b.words).length > 0).length;
    const freqCount = Object.keys(state.frequent.words).length;
    const answered = state.stats.answered;
    const acc = answered ? Math.round(state.stats.correct / answered * 100) : 0;
    return { totalWords, mastered, errorBooks, freqCount, answered, correct: state.stats.correct, acc, testsTaken: state.stats.testsTaken };
  }

  function getState() { return state; }

  function getCloud() { return (state.sync && state.sync.cloud) || null; }
  function setCloud(cfg) {
    state.sync = state.sync || { cloud: null, lastSavedAt: 0 };
    state.sync.cloud = cfg;
    saveQuiet();
  }

  // init
  load();
  initBuiltin();

  return {
    getState, getWord, getBook, getBookWords, getUnitWords, getErrorBook, getErrorBookWords,
    getFrequentWords, childrenOf, totalWrong,
    ensureErrorBook, newSubErrorBook, recordTest, removeErrorWord, clearErrorBook,
    toggleFrequent, removeFrequent, markMastered, addActivity,
    toggleImportant, removeImportant, getImportantWords,
    unitNameOf, getUnitIdByName,
    recordWrongWord, markCorrectWord, bumpWordStats, finishTestStats,
    sessionKey, saveTestSession, getTestSession, clearTestSession,
    evaluateAnswer, isCorrect, normalize,
    addImportedBook, deleteBook, updateWord, setSettings, setTheme,
    exportData, importData, resetAll, progress, overallStats,
    saveQuiet, getCloud, setCloud
  };
})();
