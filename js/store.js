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
      answerAliases: {}, // wid -> [用户确认可接受的中文说法]
      answerEn: {},      // wid -> [用户确认可接受的英文写法/全称]
      mastered: {},     // wid -> ts
      wordStats: {},    // wid -> {wrongCount,firstAt,lastAt}
      settings: {
        defaultExam: 'cet6', ttsLang: 'auto', ttsRate: 0.95, autoSpeak: true,
        keyTyping: true, // 键盘默写：长期可开关（列表/卡片打字助记）
        polysemy: 'lenient', freqThreshold: 2, autoMaster: true, theme: 'light'
      },
      builtinVersion: 0,
      wangluVersion: 0,
      shipVersion: 0,
      oralVersion: 0,
      settingsVersion: 1,
      sync: { cloud: null, lastSavedAt: 0, localChangedAt: 0, dirty: false },
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
    state.answerAliases = state.answerAliases || {};
    state.answerEn = state.answerEn || {};
    state.activity = state.activity || [];
    state.errorBooks = state.errorBooks || [];
    state.mastered = state.mastered || {};
    state.sync = Object.assign(d.sync, state.sync || {});
    return state;
  }

  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { if (window.UI) UI.toast('保存失败：浏览器存储空间不足', 'error'); }
  }
  function save() {
    state.sync = state.sync || { cloud: null, lastSavedAt: 0, localChangedAt: 0, dirty: false };
    state.sync.localChangedAt = Date.now();
    state.sync.dirty = true;
    persist();
    // 云同步：本地有变化时自动上传（由 CloudSync 去重/节流）
    if (window.CloudSync) CloudSync.onLocalSave();
  }
  function saveQuiet() { persist(); }

  function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // 附加内置词库（船用英语 / 日常口语）：各自独立数据文件，只补建/重建自己这一本，
  // 绝不触碰六级/雅思/高考/四级/王陆及其进度。
  function ensureExtra(def, verKey, verField) {
    if (!def) return;
    const ver = window[verKey] || 1;
    if (!state.books.some(b => b.id === def.id) || (state[verField] || 0) !== ver) {
      state.books = state.books.filter(b => b.id !== def.id);
      const wordIds = [];
      const units = def.units.map(u => ({ id: u.id, name: u.name, wordIds: u.wordIds.slice() }));
      units.forEach(u => u.wordIds.forEach(wid => { wordIds.push(wid); }));
      const nb = { id: def.id, name: def.name, examType: def.examType, source: 'builtin', kind: def.kind || '', units, wordIds, createdAt: Date.now() };
      if (!nb.kind) delete nb.kind;
      state.books.push(nb);
      state[verField] = ver;
      saveQuiet();
    }
  }
  function ensureExtras() {
    ensureExtra(window.SHIP_BOOK, 'SHIP_VERSION', 'shipVersion');
    ensureExtra(window.ORAL_BOOK, 'ORAL_VERSION', 'oralVersion');
  }

  // ---------- 内置词库初始化（幂等） ----------
  function initBuiltin() {
    const ver = (window.BUILTIN_VERSION || 0);
    const wver = (window.WANGLU_VERSION || 0);
    const hasBuiltin = state.books.some(b => b.source === 'builtin');
    const hasWan = state.books.some(b => b.id === 'wanglu');
    const wanChanged = (state.wangluVersion || 0) !== wver;

    ensureExtras();

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
    ensureExtras();
    state.wangluVersion = wver;
    state.builtinVersion = ver;
    save();
  }

  // ---------- 查询 ----------
  function getWord(id) {
    if (state.words[id]) return state.words[id];
    if (window.BUILTIN && BUILTIN.words && BUILTIN.words[id]) return BUILTIN.words[id];
    if (window.WANGLU_WORDS && WANGLU_WORDS[id]) return WANGLU_WORDS[id];
    if (window.SHIP_WORDS && SHIP_WORDS[id]) return SHIP_WORDS[id];
    if (window.ORAL_WORDS && ORAL_WORDS[id]) return ORAL_WORDS[id];
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
  function getErrorBookWords(eb, pendingOnly) {
    if (!eb) return [];
    return Object.keys(eb.words).filter(function (id) {
      return !pendingOnly || !eb.words[id].mastered;
    }).map(id => getWord(id)).filter(Boolean);
  }
  function getErrorBookCounts(eb) {
    const entries = eb && eb.words ? Object.values(eb.words) : [];
    const mastered = entries.filter(function (e) { return !!e.mastered; }).length;
    return { total: entries.length, mastered: mastered, pending: entries.length - mastered };
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
  function saveTestSession(key, scope, answered, progress) {
    const old = state.testSessions[key];
    state.testSessions[key] = {
      scope: scope,
      answered: answered || [],
      progress: progress || (old && old.progress) || null,
      startedAt: old ? old.startedAt : Date.now(),
      updatedAt: Date.now()
    };
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
  function answerParts(s) {
    const parts = (s || '').split(/[\n，,、；;\/]|(?:或者|或是|也就是|即)/).map(normalize).filter(Boolean);
    const whole = normalize(s);
    if (whole && !parts.includes(whole)) parts.push(whole);
    return parts;
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
  const EQUIVALENT_GROUPS = [
    ['放弃','抛弃','舍弃','摒弃'], ['获得','得到','取得','获取'], ['购买','买','采购','购置'],
    ['开始','起始','着手','启动'], ['结束','终止','完毕','停止'], ['帮助','协助','援助','帮忙'],
    ['选择','挑选','选取'], ['改变','改动','转变','变更'], ['提高','提升','增强','增进'],
    ['减少','降低','削减','缩减'], ['说明','解释','阐明','讲明'], ['证明','证实','验证'],
    ['认为','觉得','以为','认定'], ['允许','许可','准许'], ['需要','需求','需'],
    ['理解','明白','懂','领悟'], ['重要','关键','要紧'], ['困难','艰难','难'],
    ['快速','迅速','很快','飞快'], ['可能','也许','或许'], ['保持','维持','保留'],
    ['建立','创建','创立','设立'], ['包含','包括','含有'], ['显示','展示','表明'],
    ['拒绝','回绝','谢绝'], ['承认','认可','认同'], ['错误','过错','差错'],
    ['立即','立刻','马上','即刻'], ['尤其','特别','格外'], ['通常','一般','往往']
  ];
  function phraseCore(s) {
    let out = normalize(s);
    out = out.replace(/^(使|让|把|将|进行|加以|予以)/, '');
    if (out.length >= 3) out = out.replace(/[的地了着过]$/g, '');
    return out;
  }
  function equivalent(a, b) {
    return EQUIVALENT_GROUPS.some(function (g) { return g.includes(a) && g.includes(b); });
  }
  function bigramDice(a, b) {
    if (a.length < 2 || b.length < 2) return 0;
    const aa = [], bb = [];
    for (let i = 0; i < a.length - 1; i++) aa.push(a.slice(i, i + 2));
    for (let j = 0; j < b.length - 1; j++) bb.push(b.slice(j, j + 2));
    let hit = 0; const copy = bb.slice();
    aa.forEach(function (x) { const k = copy.indexOf(x); if (k >= 0) { hit++; copy.splice(k, 1); } });
    return (2 * hit) / (aa.length + bb.length);
  }
  // 中文智能匹配：兼顾近义表达，也避免单字包含造成误判
  function fuzzyMatch(input, token) {
    if (!input || !token) return false;
    if (input === token) return true;
    const ai = phraseCore(input), at = phraseCore(token);
    if (ai === at) return true;
    if (equivalent(ai, at)) return true;
    const minLen = Math.min(ai.length, at.length);
    const maxLen = Math.max(ai.length, at.length);
    if (minLen >= 3 && (ai.includes(at) || at.includes(ai))) return true;
    if (minLen >= 3) {
      const d = lev(ai, at);
      if (d <= 1 || bigramDice(ai, at) >= 0.72) return true;
    }
    return false;
  }
  function senseMatched(word, senseIdx, inputs) {
    const sense = (word.senses || [])[senseIdx];
    if (!sense || !inputs.length) return false;
    const tokens = senseTokens(sense.meaning);
    for (const input of inputs) {
      for (const t of tokens) {
        if (fuzzyMatch(input, t)) return true;
      }
    }
    return false;
  }
  function evaluateAnswer(word, input) {
    const n = normalize(input);
    const inputs = answerParts(input);
    const total = (word.senses || []).length || 1;
    const matched = (word.senses || []).map((_, i) => senseMatched(word, i, inputs));
    const aliases = (state.answerAliases[word.id] || []).map(normalize).filter(Boolean);
    const aliasAccepted = inputs.some(function (part) { return aliases.some(function (a) { return fuzzyMatch(part, a); }); });
    if (aliasAccepted && matched.length && !matched.some(Boolean)) matched[0] = true;
    const hasMeaning = (word.senses || []).some(s => (s.meaning || '').trim().length > 0);
    const matchedCount = matched.filter(Boolean).length;
    const any = hasMeaning ? matchedCount > 0 : true;
    const all = hasMeaning ? (aliasAccepted || matchedCount === total) : true;
    const missed = (word.senses || []).map((_, i) => i).filter(i => !matched[i]);
    return { matched, matchedCount, total, any, all, missed, inputNorm: n, parts: inputs, aliasAccepted: aliasAccepted };
  }
  function isCorrect(word, ev) {
    if (!ev) return false;
    return state.settings.polysemy === 'strict' ? ev.all : ev.any;
  }

  // ---------- 中文写英文（反向测试）判分 ----------
  function normEn(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function enAcceptList(word) {
    const out = [];
    function push(x) { const v = String(x || '').trim(); if (v && !out.some(function (y) { return normEn(y) === normEn(v); })) out.push(v); }
    if (word) { push(word.headword); (word.aliases || []).forEach(push); }
    (state.answerEn[word && word.id] || []).forEach(push);
    return out;
  }
  function evaluateEn(word, input) {
    const list = enAcceptList(word);
    const n = normEn(input);
    const correct = !!n && list.some(function (x) { return normEn(x) === n; });
    return { correct: correct, expected: list, inputNorm: n };
  }
  function isCorrectEn(word, ev) { return !!(ev && ev.correct); }
  function acceptEnAlias(wid, input, opts) {
    const alias = String(input || '').trim();
    if (!wid || !normEn(alias)) return false;
    const list = state.answerEn[wid] || (state.answerEn[wid] = []);
    if (!list.some(function (x) { return normEn(x) === normEn(alias); })) list.push(alias);
    opts = opts || {};
    if (opts.errorBookId) {
      const eb = getErrorBook(opts.errorBookId);
      const entry = eb && eb.words[wid];
      if (entry) { entry.wrongCount = Math.max(0, (entry.wrongCount || 0) - 1); if (!entry.wrongCount) delete eb.words[wid]; }
    }
    const ws = state.wordStats[wid];
    if (ws) { ws.wrongCount = Math.max(0, (ws.wrongCount || 0) - 1); if (!ws.wrongCount) delete state.wordStats[wid]; }
    const fr = state.frequent.words[wid];
    const nowWrong = state.wordStats[wid] ? state.wordStats[wid].wrongCount : 0;
    if (fr && !fr.manual && nowWrong < state.settings.freqThreshold) delete state.frequent.words[wid];
    if (state.settings.autoMaster) state.mastered[wid] = Date.now();
    if (opts.masterInBookId) { const parent = getErrorBook(opts.masterInBookId); if (parent && parent.words[wid]) parent.words[wid].mastered = true; }
    save();
    return true;
  }
  function getEnAliases(wid) { const w = getWord(wid); return enAcceptList(w); }

  function acceptAnswerAlias(wid, input, opts) {
    const alias = (input || '').trim();
    if (!wid || !normalize(alias)) return false;
    const list = state.answerAliases[wid] || (state.answerAliases[wid] = []);
    if (!list.some(function (x) { return normalize(x) === normalize(alias); })) list.push(alias);
    opts = opts || {};
    if (opts.errorBookId) {
      const eb = getErrorBook(opts.errorBookId);
      const entry = eb && eb.words[wid];
      if (entry) {
        entry.wrongCount = Math.max(0, (entry.wrongCount || 0) - 1);
        if (!entry.wrongCount) delete eb.words[wid];
      }
    }
    const ws = state.wordStats[wid];
    if (ws) {
      ws.wrongCount = Math.max(0, (ws.wrongCount || 0) - 1);
      if (!ws.wrongCount) delete state.wordStats[wid];
    }
    const fr = state.frequent.words[wid];
    const nowWrong = state.wordStats[wid] ? state.wordStats[wid].wrongCount : 0;
    if (fr && !fr.manual && nowWrong < state.settings.freqThreshold) delete state.frequent.words[wid];
    if (state.settings.autoMaster) state.mastered[wid] = Date.now();
    if (opts.masterInBookId) {
      const parent = getErrorBook(opts.masterInBookId);
      if (parent && parent.words[wid]) parent.words[wid].mastered = true;
    }
    save();
    return true;
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
    ids.forEach(id => { delete state.answerAliases[id]; delete state.answerEn[id]; });
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

  // 云同步专用：只导出"学习进度"（不含固定的词库/单词表，体积小很多）
  function exportSyncData() {
    return JSON.stringify({
      syncVersion: 2,
      mastered: state.mastered,
      errorBooks: state.errorBooks,
      important: state.important,
      frequent: state.frequent,
      wordStats: state.wordStats,
      testSessions: state.testSessions,
      answerAliases: state.answerAliases,
      answerEn: state.answerEn,
      stats: state.stats,
      settings: state.settings,
      activity: state.activity
    });
  }
  // 云同步专用：把云端进度合并进来（保留本机词库/单词/云设置）
  function importSyncData(json) {
    const parsed = JSON.parse(json);
    if (!parsed || parsed.syncVersion !== 2) throw new Error('不是有效的云同步数据');
    ['mastered', 'errorBooks', 'important', 'frequent', 'wordStats', 'testSessions', 'answerAliases', 'answerEn', 'stats', 'settings', 'activity'].forEach(function (k) {
      if (parsed[k] !== undefined) state[k] = parsed[k];
    });
    saveQuiet();
  }

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
    getFrequentWords, childrenOf, totalWrong, getErrorBookCounts,
    ensureErrorBook, newSubErrorBook, recordTest, removeErrorWord, clearErrorBook,
    toggleFrequent, removeFrequent, markMastered, addActivity,
    toggleImportant, removeImportant, getImportantWords,
    unitNameOf, getUnitIdByName,
    recordWrongWord, markCorrectWord, bumpWordStats, finishTestStats,
    sessionKey, saveTestSession, getTestSession, clearTestSession,
    evaluateAnswer, isCorrect, normalize,
    evaluateEn, isCorrectEn, acceptEnAlias, getEnAliases,
    acceptAnswerAlias,
    addImportedBook, deleteBook, updateWord, setSettings, setTheme,
    exportData, importData, resetAll, progress, overallStats,
    saveQuiet, getCloud, setCloud,
    exportSyncData, importSyncData
  };
})();
