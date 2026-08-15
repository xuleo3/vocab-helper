
// ============================================================
// App：路由 + 事件分发 + 测试流程
// ============================================================
const App = (function () {
  let current = { view: 'dashboard', params: {} };
  let lastQuizSpoken = -2;

  function go(view, params) {
    current = { view: view, params: params || {} };
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const app = document.getElementById('app');
    let html = '';
    switch (current.view) {
      case 'books': html = Views.books(); break;
      case 'study': html = Views.study(current.params); break;
      case 'test': html = Views.test(current.params); break;
      case 'errors': html = Views.errors(); break;
      case 'settings': html = Views.settings(); break;
      case 'admin': html = Views.admin(); break;
      case 'scene': html = (typeof SceneApp !== 'undefined') ? SceneApp.html() : '<p class="muted">生活场景加载失败</p>'; break;
      default: html = Views.dashboard();
    }
    app.innerHTML = html;
    afterRender();
  }

  function afterRender() {
    if (current.view === 'scene' && typeof SceneApp !== 'undefined' && SceneApp.afterRender) SceneApp.afterRender();
    // 高亮导航
    document.querySelectorAll('#navTabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.view === current.view);
    });
    // 测试：单元选择联动 + 继续/重开
    const bookSel = document.getElementById('testBook');
    if (bookSel) {
      fillUnitSelect(bookSel.value);
      if (current.params.unit) {
        const uSel = document.getElementById('testUnit');
        if (uSel && Array.from(uSel.options).some(o => o.value === current.params.unit)) uSel.value = current.params.unit;
      }
      updateTestModeSection();
      updateListenModeSection(bookSel.value);
      bookSel.addEventListener('change', function () {
        fillUnitSelect(bookSel.value);
        updateTestModeSection();
        updateListenModeSection(bookSel.value);
      });
    }
    const unitSel = document.getElementById('testUnit');
    if (unitSel) unitSel.addEventListener('change', updateTestModeSection);
    document.querySelectorAll('input[name="roundKind"]').forEach(function (r) { r.addEventListener('change', updateTestModeSection); });
    const ebSel = document.getElementById('testErrorBook');
    if (ebSel) ebSel.addEventListener('change', updateTestModeSection);
    // 学习搜索过滤
    const search = document.getElementById('studySearch');
    if (search) {
      search.addEventListener('input', function () {
        const kw = search.value.trim().toLowerCase();
        document.querySelectorAll('#wordList .word-row').forEach(row => {
          row.style.display = row.textContent.toLowerCase().includes(kw) ? '' : 'none';
        });
      });
    }
    // 测试答题 Enter 提交
    const input = document.getElementById('quizInput');
    if (input && !quizRevealed()) {
      input.focus();
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); submitAnswer(); }
      });
    }
    // 设置控件
    bindSettings();
    bindCloud();

    // 测试题自动发音（新题出现时朗读）
    const qA = Views.quizState();
    if (current.view === 'test' && qA && !qA.revealed && !qA.finished) {
      if (lastQuizSpoken !== qA.idx) {
        lastQuizSpoken = qA.idx;
        const wA = qA.words[qA.idx];
        if (wA && (qA.listen || Store.getState().settings.autoSpeak)) {
          setTimeout(function () { Speech.speakWord(wA); }, 120);
        }
      }
    } else {
      lastQuizSpoken = -2;
    }
  }

  function quizRevealed() {
    const q = Views.quizState();
    return q ? q.revealed : false;
  }

  // 测试设置页：根据当前选择动态显示"继续/重开"
  function updateListenModeSection(bookId) {
    const bk = Store.getBook(bookId);
    const isListen = !!(bk && bk.kind === 'listening');
    const wrap = document.getElementById('listenModeWrap');
    if (wrap) wrap.style.display = isListen ? '' : 'none';
    const desc = document.getElementById('testDesc');
    if (desc) {
      desc.textContent = isListen
        ? '听发音 → 写出中文意思（听音写意）→ 答错自动进错题本。每轮每个单词只出现一次。'
        : '看单词 → 打出意思（语义一致就算对）→ 答错自动进错题本。每轮每个单词只出现一次。';
    }
  }

  function updateTestModeSection() {
    const wrap = document.getElementById('testModeWrap');
    if (!wrap) return;
    const preset = current.params.preset || 'book';
    let scope = null;
    if (preset === 'book') {
      const bookId = document.getElementById('testBook') ? document.getElementById('testBook').value : '';
      const unitId = document.getElementById('testUnit') ? document.getElementById('testUnit').value : '';
      const kindEl = document.querySelector('input[name="roundKind"]:checked');
      const kind = kindEl ? kindEl.value : 'r1';
      scope = { preset: 'book', bookId: bookId, unitId: unitId, kind: kind };
    } else if (preset === 'error') {
      const ebId = document.getElementById('testErrorBook') ? document.getElementById('testErrorBook').value : '';
      scope = { preset: 'error', parentEbId: ebId };
    } else {
      wrap.innerHTML = '';
      return;
    }
    const key = Store.sessionKey(scope);
    const saved = Store.getTestSession(key);
    let total = 0;
    if (preset === 'book' && scope.bookId) {
      total = scope.unitId ? Store.getUnitWords(scope.bookId, scope.unitId).length : Store.getBookWords(scope.bookId).length;
    } else if (preset === 'error' && scope.parentEbId) {
      const eb = Store.getErrorBook(scope.parentEbId);
      total = eb ? Object.keys(eb.words).length : 0;
    }
    const answered = (saved && saved.answered) ? saved.answered.length : 0;
    if (saved && saved.scope && saved.scope.wordIds && saved.scope.wordIds.length) total = saved.scope.wordIds.length;
    const remain = Math.max(0, total - answered);
    if (saved && answered > 0) {
      wrap.innerHTML = '<div class="form-group"><label>测试方式（上次测了 ' + answered + ' / ' + total + ' 词）</label><div class="radio-row">' +
        '<label class="radio"><input type="radio" name="testMode" value="continue" checked> 继续上次（剩余 ' + remain + ' 词）</label>' +
        '<label class="radio"><input type="radio" name="testMode" value="fresh"> 重新开始这一章</label>' +
        '</div></div>';
    } else {
      wrap.innerHTML = '<div class="form-group"><label>测试方式</label><p class="muted small">开始新一轮测试；中途退出后下次可选择「继续上次」。</p></div>';
    }
  }

  async function bindCloud() {
    const au = document.getElementById('clAuto');
    if (au) {
      au.checked = CloudSync.autoGet();
      if (!au.dataset.bound) { au.dataset.bound = '1'; au.addEventListener('change', function () { CloudSync.autoSet(au.checked); UI.toast('已保存'); }); }
    }
    const st = document.getElementById('cloudStatus');
    const loginWrap = document.getElementById('cloudLoginWrap');
    const userWrap = document.getElementById('cloudUserWrap');
    try {
      const session = await CloudSync.getSession();
      const email = (session && session.user) ? session.user.email : '';
      const admin = CloudSync.isAdmin(session);
      if (email) {
        if (loginWrap) loginWrap.style.display = 'none';
        if (userWrap) {
          userWrap.style.display = '';
          userWrap.innerHTML = '<p class="muted small">已登录：' + UI.esc(email) + (admin ? ' <span class="badge badge-other">管理员</span>' : '') + '</p>' + (admin ? '<div class="btn-row"><button class="btn btn-sm btn-primary" data-action="goto-admin">🔐 开发者管理（看全部进度）</button></div>' : '');
        }
        if (st) st.textContent = '已登录：' + email + (admin ? '（管理员）' : '');
      } else {
        if (loginWrap) loginWrap.style.display = '';
        if (userWrap) { userWrap.style.display = 'none'; userWrap.innerHTML = ''; }
        if (st) st.textContent = '未登录，注册或登录后即可云同步。';
      }
    } catch (e) {
      if (st) st.textContent = '登录状态读取失败：' + e.message;
    }
  }

  function fillUnitSelect(bookId) {
    const sel = document.getElementById('testUnit');
    if (!sel) return;
    const book = Store.getBook(bookId);
    sel.innerHTML = '<option value="">全部单元</option>';
    if (book) book.units.forEach(u => { sel.innerHTML += '<option value="' + u.id + '">' + u.name + '</option>'; });
  }

  function bindSettings() {
    const set = Store.getState().settings;
    const p = document.getElementById('setPolysemy');
    if (p) p.addEventListener('change', function () { Store.setSettings({ polysemy: p.value }); UI.toast('已保存'); });
    const f = document.getElementById('setFreqThreshold');
    if (f) f.addEventListener('change', function () { Store.setSettings({ freqThreshold: parseInt(f.value, 10) }); UI.toast('已保存'); });
    const a = document.getElementById('setAutoMaster');
    if (a) a.addEventListener('change', function () { Store.setSettings({ autoMaster: a.checked }); UI.toast('已保存'); });
    const t = document.getElementById('setTtsLang');
    if (t) t.addEventListener('change', function () { Store.setSettings({ ttsLang: t.value }); UI.toast('已保存'); });
    const r = document.getElementById('setTtsRate');
    if (r) r.addEventListener('input', function () {
      Store.setSettings({ ttsRate: parseFloat(r.value) });
      const rv = document.getElementById('rateVal');
      if (rv) rv.textContent = r.value;
    });
    const sp = document.getElementById('setAutoSpeak');
    if (sp) sp.addEventListener('change', function () { Store.setSettings({ autoSpeak: sp.checked }); UI.toast('已保存'); });
  }

  // ================= 测试流程 =================
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function buildQuiz(words, scope) {
    let list = (words || []).slice();
    // 继续上次：过滤已测过的词
    if (scope.answeredIds && scope.answeredIds.length) {
      const done = new Set(scope.answeredIds);
      list = list.filter(w => !done.has(w.id));
    }
    if (!list.length) { UI.toast('没有可测试的单词（这一轮已全部测过，可重新开始）', 'error'); return; }
    if (scope.shuffle) shuffle(list);
    if (scope.count && scope.count !== 'all' && list.length > scope.count) list = list.slice(0, scope.count);
    scope.wordIds = list.map(w => w.id);
    // 测试开始时先确定错题本目标（实现"答题实时进错题本"）；继续上次时沿用已保存目标
    if (!scope.targetEbId) {
    if (scope.preset === 'book') {
      const eb = Store.ensureErrorBook({ bookId: scope.bookId, kind: scope.kind, parentId: scope.parentId || null });
      scope.targetEbId = eb.id; scope.masterIn = null; scope.ebName = eb.name;
    } else if (scope.preset === 'error' || scope.preset === 'retest') {
      const parent = Store.getErrorBook(scope.parentEbId);
      if (parent) {
        const child = Store.newSubErrorBook(parent.id);
        scope.targetEbId = child.id; scope.masterIn = parent.id; scope.ebName = child.name;
      }
    } else if (scope.preset === 'frequent') {
      scope.targetEbId = null; scope.masterIn = null; scope.ebName = '经常错词本';
    } else if (scope.preset === 'important') {
      scope.targetEbId = null; scope.masterIn = null; scope.ebName = '重要单词本';
    }
    }
    scope.resultEbId = scope.targetEbId || scope.parentEbId || null;
    // 测试会话：支持中断后"继续上次"
    if (!scope.sessionKey) scope.sessionKey = Store.sessionKey(scope);
    if (!scope.answeredIds) scope.answeredIds = [];
    if (scope.sessionKey) Store.saveTestSession(scope.sessionKey, scope, scope.answeredIds);
    const q = {
      words: list, idx: 0, results: [], correct: 0, wrong: 0,
      revealed: false, lastCorrect: false, lastEv: null, lastInput: '',
      scope: scope, resultBookName: '', showPhonetic: scope.showPhonetic !== false,
      listen: !!scope.listen,
      startTime: Date.now()
    };
    Views.setQuiz(q);
    go('test', { mode: 'quiz' });
  }

  function startTest(preset) {
    if (preset === 'book') {
      const bookId = document.getElementById('testBook').value;
      const unitId = document.getElementById('testUnit').value;
      const kind = document.querySelector('input[name="roundKind"]:checked').value;
      const book = Store.getBook(bookId);
      if (!book) return;
      const words = unitId ? Store.getUnitWords(bookId, unitId) : Store.getBookWords(bookId);
      const unitName = unitId ? (book.units.find(u => u.id === unitId) || {}).name : '全部单元';
      const listenEl = document.querySelector('input[name="listenMode"]:checked');
      const listenMode = book.kind === 'listening' ? (listenEl ? listenEl.value : 'listen') : 'see';
      const scopeBook = {
        preset: 'book', bookId, unitId, kind, parentId: null, shuffle: opt('optShuffle'),
        count: opt('optCount'), showPhonetic: opt('optShowPhonetic'),
        listen: listenMode === 'listen',
        scopeLabel: book.name + ' · ' + unitName
      };
      const keyBook = Store.sessionKey(scopeBook);
      const modeElBook = document.querySelector('input[name="testMode"]:checked');
      const modeBook = modeElBook ? modeElBook.value : 'fresh';
      const savedBook = Store.getTestSession(keyBook);
      let wordsBook = words;
      if (modeBook === 'continue' && savedBook) {
        scopeBook.answeredIds = savedBook.answered || [];
        scopeBook.targetEbId = savedBook.scope.targetEbId;
        scopeBook.masterIn = savedBook.scope.masterIn;
        scopeBook.ebName = savedBook.scope.ebName;
        scopeBook.listen = !!(book.kind === 'listening' && savedBook.scope.listen);
        scopeBook.sessionKey = keyBook;
        if (savedBook.scope.wordIds && savedBook.scope.wordIds.length) {
          wordsBook = savedBook.scope.wordIds.map(id => Store.getWord(id)).filter(Boolean);
        }
      } else {
        Store.clearTestSession(keyBook);
        scopeBook.answeredIds = [];
      }
      buildQuiz(wordsBook, scopeBook);
    } else if (preset === 'error') {
      const ebId = document.getElementById('testErrorBook').value;
      const eb = Store.getErrorBook(ebId);
      if (!eb) { UI.toast('请选择一个错题本', 'error'); return; }
      const words = Store.getErrorBookWords(eb);
      const ebBook = Store.getBook(eb.bookId);
      const scopeEb = {
        preset: 'error', bookId: eb.bookId, kind: 'sub', parentId: null, parentEbId: ebId,
        shuffle: opt('optShuffle'), count: opt('optCount'), showPhonetic: opt('optShowPhonetic'),
        listen: !!(ebBook && ebBook.kind === 'listening'),
        scopeLabel: eb.name
      };
      const keyEb = Store.sessionKey(scopeEb);
      const modeElEb = document.querySelector('input[name="testMode"]:checked');
      const modeEb = modeElEb ? modeElEb.value : 'fresh';
      const savedEb = Store.getTestSession(keyEb);
      let wordsEb = words;
      if (modeEb === 'continue' && savedEb) {
        scopeEb.answeredIds = savedEb.answered || [];
        scopeEb.targetEbId = savedEb.scope.targetEbId;
        scopeEb.masterIn = savedEb.scope.masterIn;
        scopeEb.ebName = savedEb.scope.ebName;
        scopeEb.sessionKey = keyEb;
        if (savedEb.scope.wordIds && savedEb.scope.wordIds.length) {
          wordsEb = savedEb.scope.wordIds.map(id => Store.getWord(id)).filter(Boolean);
        }
      } else {
        Store.clearTestSession(keyEb);
        scopeEb.answeredIds = [];
      }
      buildQuiz(wordsEb, scopeEb);
    } else if (preset === 'frequent') {
      const words = Store.getFrequentWords();
      buildQuiz(words, {
        preset: 'frequent', shuffle: opt('optShuffle'), count: opt('optCount'), showPhonetic: opt('optShowPhonetic'),
        scopeLabel: '经常错词本'
      });
    } else if (preset === 'important') {
      const words = Store.getImportantWords();
      buildQuiz(words, {
        preset: 'important', shuffle: opt('optShuffle'), count: opt('optCount'), showPhonetic: opt('optShowPhonetic'),
        scopeLabel: '重要单词本'
      });
    }
  }

  function opt(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  }

  function submitAnswer() {
    const q = Views.quizState();
    if (!q || q.revealed) return;
    const w = q.words[q.idx];
    const input = document.getElementById('quizInput').value;
    const ev = Store.evaluateAnswer(w, input);
    const correct = Store.isCorrect(w, ev);
    const rec = { wid: w.id, correct: correct, ev: ev, input: input };
    if (q.results[q.idx]) q.results[q.idx] = rec; else q.results.push(rec);
    q.revealed = true; q.lastEv = ev; q.lastInput = input; q.lastCorrect = correct;
    if (correct) q.correct++; else q.wrong++;
    // 实时记录：答对标记掌握；答错立刻进错题本
    const sc = q.scope;
    if (correct) {
      if (sc.masterIn) Store.markCorrectWord(w.id, sc.masterIn); else Store.markCorrectWord(w.id);
    } else {
      if (sc.preset === 'frequent') Store.bumpWordStats(w.id);
      else if (sc.preset === 'important') Store.recordWrongWord({ bookId: w.bookId, kind: 'r1', parentId: null, wid: w.id, missedSenses: ev.missed });
      else Store.recordWrongWord({ bookId: sc.bookId, kind: sc.kind, parentId: sc.parentId || null, targetEbId: sc.targetEbId, wid: w.id, missedSenses: ev.missed });
    }
    // 保存测试会话进度
    if (sc.sessionKey && sc.answeredIds) {
      if (!sc.answeredIds.includes(w.id)) sc.answeredIds.push(w.id);
      Store.saveTestSession(sc.sessionKey, sc, sc.answeredIds);
    }
    render();
  }

  function nextQuestion() {
    const q = Views.quizState();
    if (!q) return;
    q.idx++;
    const r = q.results[q.idx];
    if (r) { q.revealed = true; q.lastEv = r.ev; q.lastInput = r.input; q.lastCorrect = r.correct; }
    else q.revealed = false;
    render();
  }

  function prevQuestion() {
    const q = Views.quizState();
    if (!q || q.idx <= 0) return;
    q.idx--;
    const r = q.results[q.idx];
    if (r) { q.revealed = true; q.lastEv = r.ev; q.lastInput = r.input; q.lastCorrect = r.correct; }
    else q.revealed = false;
    render();
  }

  function finishTest() {
    const q = Views.quizState();
    if (!q) return;
    const sc = q.scope;
    Store.finishTestStats(q.words.length, q.correct);
    q.resultBookName = sc.ebName || '';
    Store.addActivity('test', '完成「' + sc.scopeLabel + '」测试：答对 ' + q.correct + '，答错 ' + q.wrong + (q.resultBookName ? ' → 错词已实时加入「' + q.resultBookName + '」' : ''));
    if (q.scope.sessionKey) Store.clearTestSession(q.scope.sessionKey);
    q.finished = true;
    go('test', { mode: 'result' });
  }

  function retestWrong() {
    const q = Views.quizState();
    if (!q) return;
    const wids = q.results.filter(r => !r.correct).map(r => r.wid);
    const words = wids.map(Store.getWord).filter(Boolean);
    const scope = {
      preset: 'retest', bookId: q.scope.bookId, kind: 'sub', parentId: null,
      parentEbId: q.scope.parentEbId || q.scope.resultEbId,
      shuffle: true, count: 'all', showPhonetic: true,
      listen: !!q.scope.listen,
      scopeLabel: '错词重测（' + words.length + '）'
    };
    buildQuiz(words, scope);
  }

  // ================= 动作分发 =================
  const Actions = {
    'goto-books': function () { go('books'); },
    'goto-test': function () { go('test'); },
    'goto-errors': function () { go('errors'); },
    'goto-import': function () { Views.importModal(); },
    'open-import': function () { Views.importModal(); },
    'study-book': function (el) { cardStateReset(); go('study', { book: el.dataset.book }); },
    'browse-book': function (el) { cardStateReset(); go('study', { book: el.dataset.book, mode: 'browse' }); },
    'study-mode': function (el) { cardStateReset(); go('study', { book: el.dataset.book, mode: el.dataset.mode }); },
    'study-unit': function (el) { cardStateReset(); go('study', { book: el.dataset.book, unit: el.dataset.unit || '', mode: 'browse' }); },
    'test-book': function (el) {
      const bk = Store.getBook(el.dataset.book);
      go('test', { preset: 'book', book: el.dataset.book, listen: !!(bk && bk.kind === 'listening') });
    },
    'test-book-unit': function (el) {
      cardStateReset();
      go('test', { preset: 'book', book: el.dataset.book, unit: el.dataset.unit || '' });
    },
    'view-eb-unit': function (el) { Views.errorBookWordsModal(el.dataset.eb, el.dataset.unit || ''); },
    'retest-eb-unit': function (el) {
      const eb = Store.getErrorBook(el.dataset.eb);
      if (!eb) return;
      const unit = el.dataset.unit || '';
      const words = Store.getErrorBookWords(eb).filter(w => w && Store.unitNameOf(w) === unit);
      if (!words.length) { UI.toast('该单元没有错词', 'error'); return; }
      UI.closeModal();
      const ebBook = Store.getBook(eb.bookId);
      buildQuiz(words, {
        preset: 'error', bookId: eb.bookId, kind: 'sub', parentId: null, parentEbId: eb.id,
        shuffle: true, count: 'all', showPhonetic: true,
        listen: !!(ebBook && ebBook.kind === 'listening'),
        scopeLabel: eb.name + ' · ' + unit + '（' + words.length + '词）'
      });
    },
    'speak-current': function () {
      const q = Views.quizState();
      if (q && q.words[q.idx]) Speech.speakWord(q.words[q.idx]);
    },
    'test-preset': function (el) { go('test', { preset: el.dataset.preset }); },
    'start-test': function (el) { startTest(el.dataset.preset); },
    'submit-answer': function () { submitAnswer(); },
    'prev-question': function () { prevQuestion(); },
    'next-question': function () { nextQuestion(); },
    'finish-test': function () { finishTest(); },
    'retest-wrong': function () { retestWrong(); },
    'test-errorbook': function (el) { testErrorBook(el.dataset.eb); },
    'test-frequent': function () { testFrequent(); },
    'view-errorbook': function (el) { Views.errorBookWordsModal(el.dataset.eb); },
    'filter-eb-unit': function (el) { Views.errorBookWordsModal(el.dataset.eb, el.dataset.unit || ''); },
    'goto-study-unit': function (el) {
      UI.closeModal();
      cardStateReset();
      go('study', { book: el.dataset.book, unit: el.dataset.unit || '', mode: 'browse' });
    },
    'view-frequent': function () { Views.frequentModal(); },
    'clear-errorbook': function (el) {
      UI.confirmBox('清空错题本', '确定清空这个错题本的所有单词吗？此操作不可恢复。', function () {
        Store.clearErrorBook(el.dataset.eb); UI.toast('已清空'); render();
      }, { yesText: '清空' });
    },
    'remove-error-word': function (el) {
      Store.removeErrorWord(el.dataset.eb, el.dataset.wid); UI.toast('已移出'); render();
    },
    'remove-frequent': function (el) {
      Store.removeFrequent(el.dataset.wid); UI.toast('已移出经常错词本'); render();
    },
    'toggle-important': function (el) {
      const wid = el.dataset.wid;
      const on = !Store.getState().important.words[wid];
      Store.toggleImportant(wid, on);
      UI.toast(on ? '已加入重要单词本 ⭐' : '已移出重要单词本');
      if (el.classList && el.classList.contains('star-btn')) {
        if (el.textContent.indexOf('重要') >= 0) {
          el.textContent = on ? '★ 已在重要单词本' : '☆ 加入重要单词本';
        } else {
          el.textContent = on ? '★' : '☆';
        }
        el.classList.toggle('on', on);
        el.title = on ? '移出重要单词本' : '加入重要单词本';
      } else {
        render();
      }
    },
    'test-important': function () { testImportant(); },
    'view-important': function () { Views.importantModal(); },
    'remove-important': function (el) {
      Store.removeImportant(el.dataset.wid); UI.toast('已移出重要单词本'); render();
    },
    'word-detail': function (el) { Views.wordModal(el.dataset.wid); },
    'toggle-mastered': function (el) {
      const wid = el.dataset.wid;
      const on = !Store.getState().mastered[wid];
      Store.markMastered(wid, on); UI.toast(on ? '已标记掌握' : '已取消掌握'); Views.wordModal(wid);
    },
    'toggle-frequent': function (el) {
      const wid = el.dataset.wid;
      const on = !Store.getState().frequent.words[wid];
      Store.toggleFrequent(wid, on); UI.toast(on ? '已加入经常错词本' : '已移出经常错词本'); Views.wordModal(wid);
    },
    'edit-word': function (el) { Views.editWordModal(el.dataset.wid); },
    'save-word': function (el) { saveWord(el.dataset.wid); },
    'do-import': function () { doImport(); },
    'speak': function (el) { const w = Store.getWord(el.dataset.wid); if (w) Speech.speakWord(w); },
    'modal-close': function () { UI.closeModal(); },
    'card-flip': function () { cardFlip(); },
    'card-prev': function () { cardMove(-1); },
    'card-next': function () { cardMove(1); },
    'card-know': function () { cardMark(true); },
    'card-unknown': function () { cardMark(false); },
    'toggle-theme': function () { toggleTheme(); },
    'export-data': function () { exportData(); },
    'import-data': function () { importData(); },
    'cloud-signup': function () {
      const email = (document.getElementById('clEmail') || {}).value.trim();
      const pw = (document.getElementById('clPassword') || {}).value;
      if (!email || !pw) { UI.toast('请填写邮箱和密码', 'error'); return; }
      UI.toast('正在注册…');
      CloudSync.signUp(email, pw).then(function () {
        UI.toast('注册成功！请到邮箱点一下确认链接后再登录');
        bindCloud();
      }).catch(function (e) { UI.toast(e.message, 'error'); });
    },
    'cloud-signin': function () {
      const email = (document.getElementById('clEmail') || {}).value.trim();
      const pw = (document.getElementById('clPassword') || {}).value;
      if (!email || !pw) { UI.toast('请填写邮箱和密码', 'error'); return; }
      UI.toast('正在登录…');
      CloudSync.signIn(email, pw).then(function () {
        UI.toast('登录成功 ✓');
        bindCloud();
      }).catch(function (e) { UI.toast(e.message, 'error'); });
    },
    'cloud-signout': function () {
      CloudSync.signOut().then(function () { UI.toast('已退出登录'); bindCloud(); }).catch(function (e) { UI.toast('退出失败：' + e.message, 'error'); });
    },
    'cloud-push': function () {
      UI.toast('正在上传…');
      CloudSync.push().then(function (t) {
        UI.toast('已上传到云端 ☁️ ' + new Date(t).toLocaleTimeString());
      }).catch(function (e) { UI.toast('上传失败：' + e.message, 'error'); });
    },
    'cloud-sync-now': function () {
      UI.toast('正在同步…');
      CloudSync.sync().then(function (res) {
        if (res === 'pulled') { UI.toast('已下载最新进度 ☁️'); App.render(); }
        else if (res === 'pushed') { UI.toast('已上传进度 ☁️'); }
        else { UI.toast('两边已是最新 ✓'); }
      }).catch(function (e) { UI.toast('同步失败：' + e.message, 'error'); });
    },
    'goto-settings-cloud': function () { go('settings'); },
    'cloud-pull': function () {
      UI.toast('正在下载…');
      CloudSync.pull().then(function (res) {
        if (res === 'applied') { UI.toast('已从云端下载最新进度 ☁️'); App.render(); }
        else if (res === 'up-to-date') { UI.toast('云端没有更新的进度'); }
        else { UI.toast('云端还没有数据，可先「上传进度」'); }
      }).catch(function (e) { UI.toast('下载失败：' + e.message, 'error'); });
    },
    'goto-admin': function () { go('admin'); },
    'admin-fetch': function () { fetchAdminUsers(); },
    'reset-data': function () {
      UI.confirmBox('清空全部数据', '将删除所有进度、错题本和导入的词库，只保留内置词库。确定吗？', function () {
        Store.resetAll(); UI.toast('已清空'); go('dashboard');
      }, { yesText: '清空' });
    },
    'delete-book': function (el) {
      const b = Store.getBook(el.dataset.book);
      UI.confirmBox('删除词库', '确定删除「' + (b ? b.name : '') + '」吗？其错题本数据也会删除。', function () {
        Store.deleteBook(el.dataset.book); UI.toast('已删除'); render();
      }, { yesText: '删除' });
    }
  };

  function cardStateReset() {
    // 通过 Views 暴露的 setter 重置卡片状态
    try { Views.setCardState({ index: 0, flipped: false }); } catch (e) {}
  }
  function cardFlip() { try { Views.setCardState({ index: Views.cardState().index, flipped: !Views.cardState().flipped }); render(); } catch (e) {} }
  function cardMove(d) {
    const st = Views.cardState();
    const next = st.index + d;
    const params = current.params;
    const words = params.unit ? Store.getUnitWords(params.book, params.unit) : Store.getBookWords(params.book);
    if (next < 0 || next >= words.length) { UI.toast(next < 0 ? '已经是第一张' : '已经是最后一张'); return; }
    Views.setCardState({ index: next, flipped: false });
    render();
  }
  function cardMark(know) {
    const st = Views.cardState();
    const params = current.params;
    const words = params.unit ? Store.getUnitWords(params.book, params.unit) : Store.getBookWords(params.book);
    const w = words[st.index];
    if (!w) return;
    if (know) {
      Store.markMastered(w.id, true); UI.toast('已标记掌握');
      if (st.index < words.length - 1) { Views.setCardState({ index: st.index + 1, flipped: false }); render(); }
    } else {
      Store.toggleFrequent(w.id, true); UI.toast('已加入经常错词本');
    }
  }

  function testErrorBook(ebId) {
    const eb = Store.getErrorBook(ebId);
    if (!eb) return;
    const words = Store.getErrorBookWords(eb);
    const ebBook = Store.getBook(eb.bookId);
    buildQuiz(words, {
      preset: 'error', bookId: eb.bookId, kind: 'sub', parentId: null, parentEbId: eb.id,
      shuffle: true, count: 'all', showPhonetic: true,
      listen: !!(ebBook && ebBook.kind === 'listening'),
      scopeLabel: eb.name
    });
  }
  function testFrequent() {
    const words = Store.getFrequentWords();
    buildQuiz(words, {
      preset: 'frequent', shuffle: true, count: 'all', showPhonetic: true, scopeLabel: '经常错词本'
    });
  }
  function testImportant() {
    const words = Store.getImportantWords();
    buildQuiz(words, {
      preset: 'important', shuffle: true, count: 'all', showPhonetic: true, scopeLabel: '重要单词本'
    });
  }

  function saveWord(wid) {
    const g = function (id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const sensesText = g('edSenses');
    const examplesText = g('edExamples');
    const senses = sensesText.split(/[；;]/).map(s => s.trim()).filter(Boolean);
    const exArr = examplesText.split(/[；;]/).map(s => s.trim()).filter(Boolean);
    const sensesOut = senses.length ? senses.map((m, i) => ({
      meaning: m,
      examples: exArr[i] ? exArr[i].split('|').map(x => x.trim()).filter(Boolean) : []
    })) : [{ meaning: sensesText, examples: [] }];
    Store.updateWord(wid, {
      phonetic: g('edPhonetic'), pos: g('edPos'), senses: sensesOut,
      collocations: g('edCollocations').split(/\n/).map(s => s.trim()).filter(Boolean),
      tips: g('edTips').split(/\n/).map(s => s.trim()).filter(Boolean),
      synonyms: g('edSynonyms').split(/[,，]/).map(s => s.trim()).filter(Boolean)
    });
    UI.closeModal(); UI.toast('已保存'); render();
  }

  function doImport() {
    const name = document.getElementById('impName').value.trim();
    const exam = document.getElementById('impExam').value;
    const text = document.getElementById('impText').value;
    const fileInput = document.getElementById('impFile');
    const finish = function (content) {
      const result = Importer.parse(content);
      if (!result.words.length) { UI.toast('没有解析到单词：' + (result.warnings || []).join('；'), 'error'); return; }
      if (!name) { UI.toast('请填写词库名称', 'error'); return; }
      const book = Store.addImportedBook(name, exam, result.words);
      UI.closeModal(); UI.toast('导入成功：' + result.words.length + ' 词'); go('books');
    };
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = function () { finish(reader.result); };
      reader.readAsText(fileInput.files[0], 'utf-8');
    } else if (text.trim()) {
      finish(text);
    } else {
      UI.toast('请选择文件或粘贴文本', 'error');
    }
  }

  function fetchAdminUsers() {
    UI.toast('正在加载所有用户进度…');
    CloudSync.adminList().then(function (rows) {
      Views.setAdminUsers(rows || []);
      App.render();
    }).catch(function (e) { UI.toast('获取失败：' + e.message, 'error'); });
  }

  function toggleTheme() {
    const set = Store.getState().settings;
    const next = set.theme === 'dark' ? 'light' : 'dark';
    Store.setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    render();
  }

  function exportData() {
    const blob = new Blob([Store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vocab-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = function () {
      const f = input.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = function () {
        try { Store.importData(reader.result); UI.toast('导入成功'); go('dashboard'); }
        catch (e) { UI.toast('导入失败：' + e.message, 'error'); }
      };
      reader.readAsText(f, 'utf-8');
    };
    input.click();
  }

  // ================= 全局事件绑定 =================
  function bind() {
    // 导航
    document.querySelectorAll('#navTabs .tab').forEach(t => {
      t.addEventListener('click', function () { go(t.dataset.view); });
    });
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // 全局点击：data-action
    document.addEventListener('click', function (e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      if (Actions[action]) { e.preventDefault(); Actions[action](el); }
    });

    // 全局 Enter：测试已揭示答案后，Enter 直接下一题/完成
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      const t = e.target;
      if (t && t.tagName && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(t.tagName)) return;
      const q = Views.quizState();
      if (!q || !q.revealed || q.finished) return;
      if (!document.querySelector('.quiz-card')) return;
      e.preventDefault();
      if (q.idx < q.words.length - 1) nextQuestion(); else finishTest();
    });
  }

  function init() {
    // 主题
    const theme = Store.getState().settings.theme;
    document.documentElement.setAttribute('data-theme', theme);
    bind();
    go('dashboard');
    // 云同步：打开网站时自动拉取/推送
    if (window.CloudSync) {
      CloudSync.onAuth(function () { bindCloud(); App.render(); });
      setTimeout(function () { CloudSync.onLoad(); }, 600);
    }
  }

  return { go, render, init };
})();

document.addEventListener('DOMContentLoaded', function () { App.init(); });
