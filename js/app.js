
// ============================================================
// App：路由 + 事件分发 + 测试流程
// ============================================================
const App = (function () {
  let current = { view: 'dashboard', params: {} };
  let lastQuizSpoken = -2;
  const REVERSE_BOOKS = ['cet6', 'ship'];
  const wangluPlayer = { ids: [], idx: 0, playing: false, paused: false, loop: false, token: 0 };
  let lastCheckinRecord = null;
  let studySearchTimer = null;

  function go(view, params) {
    if (view !== 'study') wangluStop();
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
      case 'checkin': html = Views.checkin(); break;
      case 'settings': html = Views.settings(); break;
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
      updateDirModeSection(bookSel.value);
      bookSel.addEventListener('change', function () {
        fillUnitSelect(bookSel.value);
        updateTestModeSection();
        updateListenModeSection(bookSel.value);
      updateDirModeSection(bookSel.value);
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
        const value = search.value;
        clearTimeout(studySearchTimer);
        studySearchTimer = setTimeout(function () {
          Views.setBrowseQuery(value);
          render();
          const next = document.getElementById('studySearch');
          if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
        }, 140);
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
    // 学习默写练习面板
    const prInput = document.getElementById('practiceInput');
    if (prInput && !prInput.dataset.boundP) {
      prInput.dataset.boundP = '1';
      prInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); doPracticeCheck(); }
      });
    }
    if (prInput) { try { prInput.focus(); } catch (e) {} }
    const pw = Views.getStudyWord();
    if (pw) {
      const pdEl = document.querySelector('input[name="practiceDir"]:checked');
      const pd = pdEl ? pdEl.value : 'zh2en';
      const pQ = document.getElementById('practiceQ');
      if (pQ) pQ.textContent = pd === 'en2zh' ? '✍️ 默写：' + pw.headword : '✍️ 默写：' + (((pw.senses && pw.senses[0]) || {}).meaning || '');
    }
    document.querySelectorAll('input[name="practiceDir"]').forEach(function (r) {
      if (!r.dataset.boundP) { r.dataset.boundP = '1'; r.addEventListener('change', function () { render(); }); }
    });
    const kt = document.getElementById('keyTypingToggle');
    if (kt && !kt.dataset.boundK) {
      kt.dataset.boundK = '1';
      kt.addEventListener('change', function () { Store.setSettings({ keyTyping: kt.checked }); UI.toast(kt.checked ? '已开启键盘默写 ✍️' : '已关闭键盘默写'); render(); });
    }
    ensureActiveRow();
    const wlLoop = document.getElementById('wangluLoop');
    if (wlLoop && !wlLoop.dataset.boundW) { wlLoop.dataset.boundW = '1'; wlLoop.addEventListener('change', function () { wangluPlayer.loop = wlLoop.checked; wangluSetUI(); }); }
    const wlRate = document.getElementById('wangluRate');
    if (wlRate && !wlRate.dataset.boundW) { wlRate.dataset.boundW = '1'; wlRate.addEventListener('change', function () { Store.setSettings({ wangluRate: Number(wlRate.value) || 1 }); }); }
    if (wangluPlayer.playing) {
      const idsNow = (Views.getBrowseWordIds ? Views.getBrowseWordIds() : []) || [];
      if (!document.getElementById('wordList') || idsNow.join(',') !== wangluPlayer.ids.join(',')) wangluStop();
    }
    document.querySelectorAll('.row-type-in').forEach(function (inp) {
      if (!inp.dataset.boundR) {
        inp.dataset.boundR = '1';
        ['click', 'mousedown', 'focus'].forEach(function (evt) {
          inp.addEventListener(evt, function (e) { e.stopPropagation(); });
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault(); e.stopPropagation();
            moveActiveRow(e.key === 'ArrowDown' ? 1 : -1, { focus: true, speak: true });
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault(); e.stopPropagation();
            rowTypeCheck(inp.dataset.wid);
            moveActiveRow(1, { focus: true, speak: true });
          }
        });
        inp.addEventListener('blur', function () { rowTypeCheck(inp.dataset.wid); });
      }
    });
    document.querySelectorAll('.typing-in').forEach(function (inp) {
      if (!inp.dataset.boundT) {
        inp.dataset.boundT = '1';
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault(); e.stopPropagation();
            moveActiveRow(e.key === 'ArrowDown' ? 1 : -1, { focus: true, speak: true });
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault(); e.stopPropagation();
            doTypingCheck(inp.dataset.wid);
            moveActiveRow(1, { focus: true, speak: true });
          }
        });
      }
    });

    // 测试题自动发音（新题出现时朗读）
    const qA = Views.quizState();
    if (current.view === 'test' && qA && !qA.revealed && !qA.finished) {
      if (lastQuizSpoken !== qA.idx) {
        lastQuizSpoken = qA.idx;
        const wA = qA.words[qA.idx];
        if (wA && !qA.reverse && (qA.listen || Store.getState().settings.autoSpeak)) {
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

  // 中文写英文：仅支持的普通词库显示方向选择（当前六级/船用英语）
  function updateDirModeSection(bookId) {
    const wrap = document.getElementById('dirModeWrap');
    if (!wrap) return;
    const b = Store.getBook(bookId);
    const ok = !!(b && b.kind !== 'listening' && REVERSE_BOOKS.indexOf(b.id) >= 0);
    wrap.style.display = ok ? '' : 'none';
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
      total = eb ? Store.getErrorBookCounts(eb).pending : 0;
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
    const passInput = document.getElementById('clPass');
    if (passInput) passInput.value = CloudSync.passGet();
    const st = document.getElementById('cloudStatus');
    if (st) st.textContent = CloudSync.passGet() ? '已设置同步口令 ✓（手机/电脑填同一个口令即可互通）' : '未设置同步口令。';
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
    const resume = scope.resumeProgress || null;
    if (resume && scope.wordIds && scope.wordIds.length) {
      list = scope.wordIds.map(Store.getWord).filter(Boolean);
      if ((scope.answeredIds || []).length >= list.length) {
        UI.toast('这一轮已经全部完成，请选择「重新开始」', 'error'); return;
      }
    } else {
      if (!list.length) { UI.toast('没有可测试的单词', 'error'); return; }
      if (scope.shuffle) shuffle(list);
      if (scope.count && scope.count !== 'all' && list.length > parseInt(scope.count, 10)) list = list.slice(0, parseInt(scope.count, 10));
      scope.wordIds = list.map(w => w.id);
    }
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
    const restoredResults = resume && Array.isArray(resume.results) ? resume.results : [];
    const restoredCorrect = resume ? Number(resume.correct) || 0 : 0;
    const restoredWrong = resume ? Number(resume.wrong) || 0 : 0;
    const restoredIndex = resume ? Math.min((scope.answeredIds || []).length, list.length - 1) : 0;
    const q = {
      words: list, idx: restoredIndex, results: restoredResults, correct: restoredCorrect, wrong: restoredWrong,
      revealed: false, lastCorrect: false, lastEv: null, lastInput: '',
      scope: scope, resultBookName: '', showPhonetic: scope.showPhonetic !== false,
      listen: !!scope.listen,
      reverse: !!scope.reverse,
      startTime: Date.now()
    };
    delete scope.resumeProgress;
    if (scope.sessionKey) Store.saveTestSession(scope.sessionKey, scope, scope.answeredIds, {
      results: q.results, correct: q.correct, wrong: q.wrong
    });
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
      const dirModeEl = document.querySelector('input[name="dirMode"]:checked');
      const dirModeVal = dirModeEl ? dirModeEl.value : 'en2zh';
      const scopeBook = {
        preset: 'book', bookId, unitId, kind, parentId: null, shuffle: opt('optShuffle'),
        count: opt('optCount'), showPhonetic: opt('optShowPhonetic'),
        listen: listenMode === 'listen',
        reverse: dirModeVal === 'zh2en',
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
        scopeBook.reverse = !!(savedBook.scope && savedBook.scope.reverse);
        scopeBook.sessionKey = keyBook;
        scopeBook.wordIds = (savedBook.scope.wordIds || []).slice();
        scopeBook.resumeProgress = savedBook.progress || { results: [], correct: 0, wrong: 0 };
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
      const words = Store.getErrorBookWords(eb, true);
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
        scopeEb.wordIds = (savedEb.scope.wordIds || []).slice();
        scopeEb.resumeProgress = savedEb.progress || { results: [], correct: 0, wrong: 0 };
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
    const isRev = !!q.reverse;
    const ev = isRev ? Store.evaluateEn(w, input) : Store.evaluateAnswer(w, input);
    const correct = isRev ? Store.isCorrectEn(w, ev) : Store.isCorrect(w, ev);
    const missedSenses = isRev ? [] : (ev.missed || []);
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
      else if (sc.preset === 'important') {
        const recorded = Store.recordWrongWord({ bookId: w.bookId, kind: 'r1', parentId: null, wid: w.id, missedSenses: missedSenses });
        rec.errorBookId = recorded ? recorded.id : null;
      } else {
        const recorded = Store.recordWrongWord({ bookId: sc.bookId, kind: sc.kind, parentId: sc.parentId || null, targetEbId: sc.targetEbId, wid: w.id, missedSenses: missedSenses });
        rec.errorBookId = recorded ? recorded.id : null;
      }
    }
    // 保存测试会话进度
    if (sc.sessionKey && sc.answeredIds) {
      if (!sc.answeredIds.includes(w.id)) sc.answeredIds.push(w.id);
      Store.saveTestSession(sc.sessionKey, sc, sc.answeredIds, { results: q.results, correct: q.correct, wrong: q.wrong });
    }
    render();
  }

  function acceptCurrentAnswer() {
    const q = Views.quizState();
    if (!q || !q.revealed || q.lastCorrect) return;
    const rec = q.results[q.idx];
    const w = q.words[q.idx];
    if (!rec || !w || !rec.input.trim()) { UI.toast('空答案不能设为同义说法', 'error'); return; }
    if (q.reverse) {
      Store.acceptEnAlias(w.id, rec.input, {
        errorBookId: rec.errorBookId || q.scope.targetEbId || null,
        masterInBookId: q.scope.masterIn || null
      });
      rec.correct = true;
      rec.ev = Store.evaluateEn(w, rec.input);
      rec.ev.accepted = true;
    } else {
      Store.acceptAnswerAlias(w.id, rec.input, {
        errorBookId: rec.errorBookId || q.scope.targetEbId || null,
        masterInBookId: q.scope.masterIn || null
      });
      rec.correct = true;
      rec.ev = Store.evaluateAnswer(w, rec.input);
      rec.ev.accepted = true;
    }
    q.correct++;
    q.wrong = Math.max(0, q.wrong - 1);
    q.lastCorrect = true;
    q.lastEv = rec.ev;
    if (q.scope.sessionKey) Store.saveTestSession(q.scope.sessionKey, q.scope, q.scope.answeredIds, {
      results: q.results, correct: q.correct, wrong: q.wrong
    });
    UI.toast('已记住这个说法，并撤销本次错题 ✓');
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
    {
      const bk = Store.getBook(sc.bookId) || {};
      const unitName = sc.unitId ? (((bk.units || []).find(function (u) { return u.id === sc.unitId; }) || {}).name || '') : '全部单元';
      Store.addTestRecord({ bookId: sc.bookId || '', bookName: bk.name || '', unitName: unitName, scopeLabel: sc.scopeLabel || '', total: q.words.length, correct: q.correct, wrong: q.wrong, kind: sc.kind || '', listen: !!q.listen, reverse: !!q.reverse });
    }
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
    'study-page': function (el) { Views.setBrowsePage(el.dataset.page); render(); window.scrollTo(0, 180); },
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
      const words = Store.getErrorBookWords(eb, true).filter(w => w && Store.unitNameOf(w) === unit);
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
    'accept-answer': function () { acceptCurrentAnswer(); },
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
    'study-practice-toggle': function () { Views.toggleStudyPractice(); render(); },
    'practice-check': function () { doPracticeCheck(); },
    'typing-check': function (el) { doTypingCheck(el.dataset.wid); },
    'open-checkin': function () { openCheckin(0); },
    'open-checkin-records': function () { openCheckinRecords(); },
    'checkin-manual': function () {
      const bid = (document.getElementById('ckBook') || {}).value || '';
      const bk = Store.getBook(bid) || {};
      const unit = ((document.getElementById('ckUnit') || {}).value || '').trim();
      const total = parseInt(((document.getElementById('ckTotal') || {}).value || '0'), 10);
      const wrong = parseInt(((document.getElementById('ckWrong') || {}).value || '0'), 10);
      if (!total || total < 1) { UI.toast('请填写总题数', 'error'); return; }
      if (isNaN(wrong) || wrong < 0 || wrong > total) { UI.toast('答错数应在 0 到总题数之间', 'error'); return; }
      openCheckin({ time: Date.now(), bookId: bid, bookName: bk.name || '', unitName: unit || '全部单元', total: total, wrong: wrong, correct: total - wrong });
    },
    'checkin-preview': function (el) { UI.closeModal(); openCheckin(el.dataset.idx); },
    'checkin-image': function (el) { saveCheckinImage(el.dataset.idx); },
    'wanglu-play': function () { wangluStart(); },
    'wanglu-pause': function () { wangluPause(); },
    'wanglu-stop': function () { wangluStop(); },
    'toggle-theme': function () { toggleTheme(); },
    'export-data': function () { exportData(); },
    'import-data': function () { importData(); },
    'cloud-save-pass': function () {
      const v = ((document.getElementById('clPass') || {}).value || '').trim();
      if (!v) { UI.toast('请输入同步口令', 'error'); return; }
      if (v.length < 4) { UI.toast('口令至少 4 位', 'error'); return; }
      CloudSync.passSet(v);
      UI.toast('同步口令已保存 ✓');
      bindCloud();
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
        else if (res === 'noop') { UI.toast('云端还没有进度：请先在「有你进度的设备」上点 ⬆️ 上传进度', 'error'); }
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
    const words = Store.getErrorBookWords(eb, true);
    if (!words.length) { UI.toast('这个错题本已经全部攻克了', 'error'); return; }
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
    document.body.appendChild(a);
    a.click();
    const href = a.href;
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 1000);
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

  // 学习页：默写练习检查（键盘助记，不记错题）
  function doPracticeCheck() {
    const inputEl = document.getElementById('practiceInput');
    const fb = document.getElementById('practiceFb');
    const w = Views.getStudyWord();
    if (!inputEl || !fb || !w) return;
    const dirEl = document.querySelector('input[name="practiceDir"]:checked');
    const dir = dirEl ? dirEl.value : 'zh2en';
    const val = inputEl.value;
    if (!val.trim()) { UI.toast('先输入答案再检查', 'error'); return; }
    let ok = false; let show = '';
    if (dir === 'zh2en') {
      const ev = Store.evaluateEn(w, val);
      ok = ev.correct;
      show = '英文：' + (ev.expected && ev.expected.length ? ev.expected.join(' / ') : w.headword);
    } else {
      const ev = Store.evaluateAnswer(w, val);
      ok = Store.isCorrect(w, ev);
      show = '意思：' + (w.senses || []).map(function (s) { return s.meaning; }).join('；');
    }
    fb.innerHTML = (ok ? '<div class="quiz-verdict ok">✓ 正确！</div>' : '<div class="quiz-verdict no">✗ 不对，再想想</div>') + '<div class="muted small">' + UI.esc(show) + '</div>';
    if (ok) inputEl.select();
  }

  // 词表列表：某一行默写检查
  function doTypingCheck(wid) {
    const inputEl = document.querySelector('.typing-in[data-wid="' + wid + '"]');
    const resEl = document.querySelector('.typing-result[data-rid="' + wid + '"]');
    const w = Store.getWord(wid);
    if (!inputEl || !resEl || !w) return;
    const val = inputEl.value;
    if (!val.trim()) return;
    const ev = Store.evaluateEn(w, val);
    if (ev.correct) {
      resEl.innerHTML = '<span class="typing-ok">✓ ' + UI.esc(w.headword) + '</span>' + (w.aliases && w.aliases.length ? '<span class="muted small">（' + UI.esc(w.aliases.join('；')) + '）</span>' : '');
    } else {
      const ans = (ev.expected && ev.expected.length) ? ev.expected.join(' / ') : w.headword;
      resEl.innerHTML = '<span class="typing-bad">✗ ' + UI.esc(ans) + '</span>';
    }
  }
  function focusNextTypingInput(current) {
    const ins = Array.prototype.slice.call(document.querySelectorAll('#wordList .typing-in'));
    const i = ins.indexOf(current);
    if (i < 0) return;
    for (let j = i + 1; j < ins.length; j++) {
      if (!ins[j].value.trim()) { ins[j].focus(); return; }
    }
  }

  // 单词列表：喇叭旁“打一遍”输入框的拼写检查（只做提示，不改进度）
  function rowTypeCheck(wid) {
    const inp = document.querySelector('.row-type-in[data-wid="' + wid + '"]');
    const fb = document.querySelector('.row-type-fb[data-rid="' + wid + '"]');
    const w = Store.getWord(wid);
    if (!inp || !fb || !w) return;
    const val = inp.value.trim();
    if (!val) { fb.textContent = ''; fb.className = 'row-type-fb'; return; }
    const ev = Store.evaluateEn(w, val);
    if (ev.correct) {
      fb.textContent = '✓'; fb.className = 'row-type-fb ok';
    } else {
      const ans = (ev.expected && ev.expected.length) ? ev.expected.join(' / ') : w.headword;
      fb.textContent = '✗ ' + ans; fb.className = 'row-type-fb bad';
    }
  }

  // 学习列表：键盘上下移动并朗读当前单词
  function moveActiveRow(delta, opts) {
    opts = opts || {};
    const rows = Array.prototype.slice.call(document.querySelectorAll('#wordList .word-row'));
    if (!rows.length) return;
    let cur = -1;
    const focused = document.activeElement;
    if (focused && focused.closest) { const fr = focused.closest('#wordList .word-row'); if (fr) cur = rows.indexOf(fr); }
    if (cur < 0) { const marked = document.querySelector('#wordList .word-row.row-active'); cur = marked ? rows.indexOf(marked) : -1; }
    if (cur < 0) cur = delta > 0 ? -1 : rows.length;
    const next = Math.max(0, Math.min(rows.length - 1, cur + delta));
    rows.forEach(function (r) { r.classList.remove('row-active'); });
    const row = rows[next];
    row.classList.add('row-active');
    const inp = row.querySelector('.row-type-in, .typing-in');
    if (opts.focus !== false && inp) { try { inp.focus({ preventScroll: true }); } catch (e) { try { inp.focus(); } catch (e2) {} } }
    try { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { try { row.scrollIntoView(); } catch (e2) {} }
    if (opts.speak !== false) {
      const wid = row.dataset.wid || (inp && inp.dataset.wid);
      const w = wid ? Store.getWord(wid) : null;
      if (w) Speech.speakWord(w);
    }
  }
  function ensureActiveRow() {
    const list = document.getElementById('wordList');
    if (!list || list.querySelector('.word-row.row-active')) return;
    const first = list.querySelector('.word-row');
    if (first) first.classList.add('row-active');
  }

  // 王陆语料库：整单元连续朗读
  function wangluSetUI() {
    const el = document.getElementById('wangluProgress');
    if (!el) return;
    if (wangluPlayer.playing) el.textContent = '朗读中 ' + (wangluPlayer.idx + 1) + ' / ' + wangluPlayer.ids.length + (wangluPlayer.loop ? ' · 循环' : '') + '（空格暂停）';
    else if (wangluPlayer.paused) el.textContent = '已暂停 ' + (wangluPlayer.idx + 1) + ' / ' + wangluPlayer.ids.length + '（空格继续）';
    else if (wangluPlayer.ids.length) el.textContent = '播放完毕（空格或 ▶ 重播）';
    else el.textContent = '按 ▶ 开始（空格播放）';
  }
  function wangluHighlight(wid) {
    const row = document.querySelector('#wordList .word-row[data-wid="' + wid + '"]');
    if (!row) return;
    Array.prototype.forEach.call(document.querySelectorAll('#wordList .word-row.row-active'), function (r) { r.classList.remove('row-active'); });
    row.classList.add('row-active');
    try { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { try { row.scrollIntoView(); } catch (e2) {} }
  }
  function wangluPlayFrom(i) {
    if (!wangluPlayer.playing) return;
    const ids = wangluPlayer.ids;
    if (!ids.length) { wangluPlayer.playing = false; wangluSetUI(); return; }
    if (i >= ids.length) {
      if (wangluPlayer.loop) i = 0;
      else { wangluPlayer.playing = false; wangluPlayer.paused = false; wangluPlayer.idx = 0; wangluSetUI(); return; }
    }
    wangluPlayer.idx = i;
    const w = Store.getWord(ids[i]);
    if (!w) { wangluPlayFrom(i + 1); return; }
    wangluHighlight(w.id);
    const myToken = ++wangluPlayer.token;
    wangluSetUI();
    const rate = Number((Store.getState().settings || {}).wangluRate) || 1;
    Speech.speakWord(w, {
      rate: rate,
      onend: function () {
        if (!wangluPlayer.playing || myToken !== wangluPlayer.token) return;
        wangluPlayFrom(i + 1);
      }
    });
  }
  function wangluStart() {
    if (wangluPlayer.playing) return; // 正在播放时忽略（避免空格/按钮把它从头重播）
    const lp = document.getElementById('wangluLoop');
    wangluPlayer.loop = !!(lp && lp.checked);
    // 已暂停：从当前单词继续；否则从头开始
    if (wangluPlayer.paused && wangluPlayer.ids.length) {
      wangluPlayer.paused = false;
      wangluPlayer.playing = true;
      wangluPlayer.token++;
      wangluPlayFrom(Math.min(wangluPlayer.idx, wangluPlayer.ids.length - 1));
      return;
    }
    const ids = (Views.getBrowseWordIds ? Views.getBrowseWordIds() : []) || [];
    if (!ids.length) { UI.toast('这个单元没有单词', 'error'); return; }
    wangluPlayer.ids = ids;
    wangluPlayer.idx = 0;
    wangluPlayer.paused = false;
    wangluPlayer.playing = true;
    wangluPlayer.token++;
    const ae = document.activeElement;
    if (ae && ae.tagName === 'BUTTON' && ae.dataset && /^wanglu-/.test(ae.dataset.action || '')) { try { ae.blur(); } catch (e) {} }
    wangluPlayFrom(0);
  }
  function wangluToggle() {
    if (wangluPlayer.playing) { wangluPause(); return; }
    if (wangluPlayer.paused && wangluPlayer.ids.length) { wangluStart(); return; }
    if (wangluPlayer.ids.length) { wangluStart(); return; }
    wangluStart();
  }
  function wangluPause() {
    if (!wangluPlayer.playing) return;
    const ae = document.activeElement;
    if (ae && ae.tagName === 'BUTTON' && ae.dataset && /^wanglu-/.test(ae.dataset.action || '')) { try { ae.blur(); } catch (e) {} }
    wangluPlayer.playing = false;
    wangluPlayer.paused = true;
    wangluPlayer.token++;
    Speech.stop();
    wangluSetUI();
  }
  function wangluStop() {
    if (!wangluPlayer.playing && !wangluPlayer.ids.length) { wangluSetUI(); return; }
    wangluPlayer.playing = false;
    wangluPlayer.paused = false;
    wangluPlayer.token++;
    Speech.stop();
    wangluPlayer.idx = 0;
    wangluPlayer.ids = [];
    wangluSetUI();
  }

  // ================= 打卡图（测试结果） =================
  function checkinGet(idx) {
    if (idx && typeof idx === 'object' && typeof idx.total === 'number') return idx;
    if (idx === 'last' || idx === 'new') return lastCheckinRecord;
    const list = Store.getTestRecords();
    const i = Number(idx);
    return (isFinite(i) ? list[i] : list[0]) || null;
  }
  function checkinAcc(r) { return r.total ? Math.round(r.correct / r.total * 100) : 0; }
  function checkinDate(r) { const d = new Date(r.time); function p(n){return n<10?'0'+n:''+n;} return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 '+p(d.getHours())+':'+p(d.getMinutes()); }
  function checkinInner(r) {
    const acc = checkinAcc(r);
    return '<div class="checkin-card">' +
      '<div class="checkin-brand">📚 词汇助手 · 今日打卡</div>' +
      '<div class="checkin-book">' + UI.esc(r.bookName || '') + '</div>' +
      '<div class="checkin-unit">' + UI.esc(r.unitName || r.scopeLabel || '') + '</div>' +
      '<div class="checkin-acc">' + acc + '%</div>' +
      '<div class="checkin-acc-label">正确率</div>' +
      '<div class="checkin-stats"><div><b>' + r.correct + '</b><span>答对</span></div><div><b>' + r.wrong + '</b><span>答错</span></div><div><b>' + r.total + '</b><span>总词数</span></div></div>' +
      '<div class="checkin-date">' + checkinDate(r) + '</div>' +
      '<div class="checkin-foot">坚持每天打卡 · 每天进步一点点</div>' +
      '</div>';
  }
  function openCheckin(idx) {
    const r = checkinGet(idx);
    if (!r) { UI.toast('还没有测试记录，先完成一次测试吧', 'error'); return; }
    lastCheckinRecord = r;
    const html = '<div class="modal-head"><h3>📸 打卡图（可直接截图）</h3><button class="icon-btn" data-action="modal-close">✕</button></div>' +
      '<div class="modal-body">' + checkinInner(r) +
      '<div class="btn-row"><button class="btn btn-primary" data-action="checkin-image" data-idx="last">💾 保存为图片</button><button class="btn" data-action="modal-close">关闭</button></div>' +
      '<p class="muted small">小提示：也可以直接用手机截图这张卡片，方便每天打卡。</p></div>';
    UI.modal(html, { size: 'lg' });
  }
  function openCheckinRecords() {
    const list = Store.getTestRecords();
    if (!list.length) { UI.toast('还没有测试记录，先测一轮吧', 'error'); return; }
    let h = '<div class="modal-head"><h3>🖼️ 打卡记录</h3><button class="icon-btn" data-action="modal-close">✕</button></div><div class="modal-body"><p class="muted small">每次测试都会自动记录；可以随时生成/保存打卡图，也可以直接截图。</p><div class="card-list">';
    list.slice(0, 60).forEach(function (r, i) {
      h += '<div class="card"><div class="eb-head"><span class="eb-name">' + UI.esc(r.bookName || '') + ' · ' + UI.esc(r.unitName || '') + '</span><span class="muted small">' + checkinDate(r) + '</span></div>' +
        '<div class="muted small">答对 ' + r.correct + ' / ' + r.total + ' · 正确率 ' + checkinAcc(r) + '%</div>' +
        '<div class="btn-row"><button class="btn btn-sm btn-primary" data-action="checkin-preview" data-idx="' + i + '">👁️ 查看打卡图</button><button class="btn btn-sm" data-action="checkin-image" data-idx="' + i + '">💾 保存图片</button></div></div>';
    });
    h += '</div></div>';
    UI.modal(h, { size: 'lg' });
  }
  function drawCheckin(r) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const F = 'bold 44px "Microsoft YaHei", "PingFang SC", sans-serif';
    x.fillStyle = '#eef2ff'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#ffffff'; x.strokeStyle = '#e2e8f0'; x.lineWidth = 3;
    const rr = function (px, py, w, h, rad) { x.beginPath(); x.moveTo(px + rad, py); x.arcTo(px + w, py, px + w, py + h, rad); x.arcTo(px + w, py + h, px, py + h, rad); x.arcTo(px, py + h, px, py, rad); x.arcTo(px, py, px + w, py, rad); x.closePath(); };
    rr(60, 60, W - 120, H - 120, 40); x.fill(); x.stroke();
    x.textAlign = 'center';
    x.fillStyle = '#4f46e5'; x.font = 'bold 46px "Microsoft YaHei", "PingFang SC", sans-serif'; x.fillText('词汇助手 · 今日打卡', W / 2, 200);
    x.fillStyle = '#0f172a'; x.font = 'bold 60px "Microsoft YaHei", "PingFang SC", sans-serif'; x.fillText(r.bookName || '', W / 2, 320);
    x.fillStyle = '#475569'; x.font = 'bold 42px "Microsoft YaHei", "PingFang SC", sans-serif'; x.fillText(r.unitName || r.scopeLabel || '', W / 2, 400);
    x.fillStyle = '#16a34a'; x.font = 'bold 220px "Microsoft YaHei", "PingFang SC", sans-serif'; x.fillText(checkinAcc(r) + '%', W / 2, 760);
    x.fillStyle = '#64748b'; x.font = '40px "Microsoft YaHei", "PingFang SC", sans-serif'; x.fillText('正确率', W / 2, 830);
    const stats = [['答对', r.correct], ['答错', r.wrong], ['总词数', r.total]];
    stats.forEach(function (it, i) {
      const bx = 130 + i * 280;
      x.fillStyle = '#f8fafc'; rr(bx, 900, 240, 170, 24); x.fill();
      x.fillStyle = '#0f172a'; x.font = 'bold 72px "Microsoft YaHei", "PingFang SC", sans-serif'; x.fillText(String(it[1]), bx + 120, 990);
      x.fillStyle = '#64748b'; x.font = '36px "Microsoft YaHei", "PingFang SC", sans-serif'; x.fillText(it[0], bx + 120, 1045);
    });
    x.fillStyle = '#64748b'; x.font = '36px "Microsoft YaHei", "PingFang SC", sans-serif'; x.fillText(checkinDate(r), W / 2, 1170);
    x.fillStyle = '#94a3b8'; x.font = '34px "Microsoft YaHei", "PingFang SC", sans-serif'; x.fillText('坚持每天打卡 · 每天进步一点点', W / 2, 1250);
    return c;
  }
  function saveCheckinImage(idx) {
    const r = checkinGet(idx);
    if (!r) { UI.toast('还没有测试记录', 'error'); return; }
    const c = drawCheckin(r);
    const name = '打卡-' + String(r.unitName || r.bookName || '英语').replace(/[\\/:*?"<>|\s]/g, '') + '-' + new Date(r.time).toISOString().slice(0, 10) + '.png';
    if (c.toBlob) {
      c.toBlob(function (b) {
        if (!b) { UI.toast('生成图片失败', 'error'); return; }
        const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
        UI.toast('图片已生成，请查看下载 ⬇️');
      }, 'image/png');
    } else {
      const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      UI.toast('图片已生成，请查看下载 ⬇️');
    }
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

    // 王陆连续朗读：空格键暂停 / 继续（仅当页面有连续朗读面板时生效）
    document.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.code !== 'Space') return;
      const t = e.target;
      if (t && t.tagName && ['INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(t.tagName)) return;
      const isWangluBtn = !!(t && t.tagName === 'BUTTON' && t.dataset && /^wanglu-/.test(t.dataset.action || ''));
      if (t && t.tagName === 'BUTTON' && !isWangluBtn) return;
      if (!document.getElementById('wangluProgress')) return;
      e.preventDefault();
      wangluToggle();
    });

    // 学习列表：上下键移动并朗读当前单词（焦点不在输入框时也可用）
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const t = e.target;
      const isRowInput = !!(t && t.classList && (t.classList.contains('row-type-in') || t.classList.contains('typing-in')));
      if (!isRowInput && t && t.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (!document.querySelector('#wordList .word-row')) return;
      e.preventDefault();
      moveActiveRow(e.key === 'ArrowDown' ? 1 : -1, { focus: true, speak: true });
    });

    // 全局 Enter：测试已揭示答案后，Enter 直接下一题/完成
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      const t = e.target;
      if (t && t.tagName && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(t.tagName)) return;
      if (document.querySelector('#wordList .word-row')) {
        const row = document.querySelector('#wordList .word-row.row-active') || document.querySelector('#wordList .word-row');
        const inp = row && row.querySelector('.row-type-in, .typing-in');
        if (inp) { e.preventDefault(); try { inp.focus(); } catch (err) {} return; }
      }
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
    // 云同步：打开网站时自动拉取/推送（口令已设置且曾同步过才会执行）
    if (window.CloudSync) setTimeout(function () { CloudSync.onLoad(); }, 600);
  }

  return { go, render, init };
})();

document.addEventListener('DOMContentLoaded', function () { App.init(); });
