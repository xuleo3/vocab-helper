
const Views = (function () {
  const S = () => Store.getState();
  const esc = UI.esc;

  // ---------- 首页 ----------
  function dashboard() {
    const st = Store.overallStats();
    const s = S();
    const cards = [
      { label: '词库单词', value: st.totalWords, icon: '📖' },
      { label: '已掌握', value: st.mastered, icon: '✅' },
      { label: '累计正确率', value: st.answered ? st.acc + '%' : '—', icon: '🎯' },
      { label: '测试次数', value: st.testsTaken, icon: '📝' },
      { label: '错题本', value: st.errorBooks, icon: '📕' },
      { label: '经常错词', value: st.freqCount, icon: '🔥' }
    ];
    let html = '<div class="page-head"><h1>首页</h1><p class="muted">坚持每天背一点，六级雅思都拿下。</p></div>';
    html += '<div class="stat-grid">' + cards.map(c =>
      '<div class="card stat-card"><div class="stat-icon">' + c.icon + '</div><div class="stat-body"><div class="stat-value">' + c.value + '</div><div class="stat-label">' + c.label + '</div></div></div>'
    ).join('') + '</div>';

    // 学习进度
    html += '<div class="section-title"><h2>词库进度</h2></div>';
    const books = s.books;
    if (!books.length) html += '<p class="muted">还没有词库，去「词库」页导入或使用内置词库。</p>';
    else {
      html += '<div class="card-list">' + books.map(b => {
        const p = Store.progress(b.id);
        return '<div class="card book-progress">' +
          '<div class="book-progress-top"><span class="book-name">' + esc(b.name) + ' ' + UI.examBadge(b.examType) + '</span><span class="muted">' + p.learned + ' / ' + p.total + '</span></div>' +
          '<div class="progress"><div class="progress-bar" style="width:' + p.pct + '%"></div></div>' +
          '</div>';
      }).join('') + '</div>';
    }

    // 快捷入口
    html += '<div class="section-title"><h2>快捷开始</h2></div>';
    html += '<div class="action-grid">' +
      '<button class="card action-card" data-action="goto-books">📚 选词库学习</button>' +
      '<button class="card action-card" data-action="goto-test">📝 开始测试</button>' +
      '<button class="card action-card" data-action="goto-errors">📕 复习错题</button>' +
      '<button class="card action-card" data-action="goto-import">➕ 导入单词本</button>' +
      '</div>';

    // 云同步状态
    const cloudCfg = Store.getCloud();
    if (cloudCfg && cloudCfg.server && cloudCfg.appKey && cloudCfg.syncKey) {
      const lastAt = (Store.getState().sync && Store.getState().sync.lastSavedAt) || 0;
      html += '<div class="section-title"><h2>☁️ 云同步</h2></div>';
      html += '<div class="card">';
      html += '<div class="muted small">' + (lastAt ? '上次同步：' + fmtTime(lastAt) : '还没同步过（请到「设置 → 云同步」先上传或下载一次）') + (cloudCfg.auto ? ' · 自动同步已开启 ✓' : ' · 自动同步未开启（可在设置里打开）') + '</div>';
      html += '<div class="btn-row"><button class="btn btn-sm btn-primary" data-action="cloud-sync-now">🔄 立即同步</button>';
      html += '<button class="btn btn-sm" data-action="goto-settings-cloud">⚙️ 云同步设置</button></div>';
      html += '</div>';
    }

    // 最近动态
    html += '<div class="section-title"><h2>最近动态</h2></div>';
    if (!s.activity.length) html += '<p class="muted">暂无动态。完成一次测试后这里会显示记录。</p>';
    else {
      html += '<div class="card-list">' + s.activity.slice(0, 8).map(a =>
        '<div class="card activity-item"><span class="muted">' + fmtTime(a.time) + '</span> <span>' + esc(a.text) + '</span></div>'
      ).join('') + '</div>';
    }
    return html;
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // ---------- 词库 ----------
  function books() {
    const s = S();
    let html = '<div class="page-head"><h1>词库</h1><p class="muted">内置《六级词汇闪过》《雅思词汇真经》，也可以导入自己的单词本。</p></div>';
    html += '<div class="toolbar"><button class="btn btn-primary" data-action="open-import">➕ 导入单词本</button></div>';

    if (!s.books.length) html += '<p class="muted">还没有词库。</p>';
    html += '<div class="book-grid">' + s.books.map(b => {
      const p = Store.progress(b.id);
      const errCount = s.errorBooks.filter(e => e.bookId === b.id).reduce((sum, e) => sum + Object.keys(e.words).length, 0);
      return '<div class="card book-card">' +
        '<div class="book-card-head">' +
        '<div><div class="book-title">' + esc(b.name) + '</div>' +
        '<div class="muted small">' + UI.examBadge(b.examType) + (b.kind === 'listening' ? ' <span class="tag tag-blue">听音写意</span>' : '') + ' ' + (b.source === 'builtin' ? '内置' : '导入') + ' · ' + b.wordIds.length + ' 词 · ' + b.units.length + ' 单元</div></div>' +
        '</div>' +
        '<div class="progress"><div class="progress-bar" style="width:' + p.pct + '%"></div></div>' +
        '<div class="muted small">已掌握 ' + p.learned + '/' + p.total + ' · 错题 ' + errCount + '</div>' +
        '<div class="book-card-actions">' +
        '<button class="btn btn-sm" data-action="study-book" data-book="' + esc(b.id) + '">学习</button>' +
        '<button class="btn btn-sm btn-primary" data-action="test-book" data-book="' + esc(b.id) + '">' + (b.kind === 'listening' ? '🔊 听音写意' : '测试') + '</button>' +
        '<button class="btn btn-sm" data-action="browse-book" data-book="' + esc(b.id) + '">词表</button>' +
        (b.source === 'imported' ? '<button class="btn btn-sm btn-danger" data-action="delete-book" data-book="' + esc(b.id) + '">删除</button>' : '') +
        '</div></div>';
    }).join('') + '</div>';

    html += '<div class="section-title"><h2>导入格式说明</h2></div>';
    html += '<div class="card"><ul class="help-list">' +
      '<li><b>TXT 文本</b>：每行一个单词，可带释义，如 <code>abandon 放弃</code> 或 <code>abandon - 放弃</code></li>' +
      '<li><b>CSV / Excel 导出的表格</b>：表头可识别「单词 / 音标 / 词性 / 意思 / 例句 / 词组 / 助记 / 同义词」</li>' +
      '<li><b>JSON</b>：数组，每项含 headword / meaning / examples / collocations / tips / synonyms</li>' +
      '<li><b>Anki 导出</b>：单词<TAB>释义 的制表符格式也支持</li>' +
      '</ul></div>';
    return html;
  }

  // ---------- 学习 ----------
  function study(params) {
    params = params || {};
    const bookId = params.book || (params.bookId || '');
    const unitId = params.unit || '';
    const mode = params.mode || 'browse';

    if (!bookId) {
      const s = S();
      let html = '<div class="page-head"><h1>学习</h1><p class="muted">选择一本词库开始背。</p></div>';
      html += '<div class="book-grid">' + s.books.map(b =>
        '<button class="card book-card" data-action="study-book" data-book="' + esc(b.id) + '">' +
        '<div class="book-title">' + esc(b.name) + '</div>' +
        '<div class="muted small">' + b.wordIds.length + ' 词 · ' + b.units.length + ' 单元</div>' +
        '</button>').join('') + '</div>';
      return html;
    }

    const book = Store.getBook(bookId);
    if (!book) return '<p class="muted">词库不存在。</p>';

    let html = '<div class="page-head">';
    html += '<div class="page-head-row"><h1>' + esc(book.name) + '</h1>' + UI.examBadge(book.examType) + '</div>';
    html += '<div class="btn-row">';
    html += '<button class="btn btn-sm" data-action="goto-books">← 返回词库</button>';
    html += '<button class="btn btn-sm" data-action="study-mode" data-book="' + esc(bookId) + '" data-mode="browse"' + (mode === 'browse' ? ' disabled' : '') + '>列表浏览</button>';
    html += '<button class="btn btn-sm" data-action="study-mode" data-book="' + esc(bookId) + '" data-mode="card"' + (mode === 'card' ? ' disabled' : '') + '>卡片背词</button>';
    if (book.kind === 'listening') html += '<button class="btn btn-sm btn-primary" data-action="test-book" data-book="' + esc(bookId) + '">🔊 听音写意测试</button>';
    html += '</div></div>';

    // 单元选择
    html += '<div class="chip-row">';
    html += '<button class="chip' + (!unitId ? ' chip-active' : '') + '" data-action="study-unit" data-book="' + esc(bookId) + '" data-unit="">全部</button>';
    book.units.forEach(u => {
      html += '<button class="chip' + (unitId === u.id ? ' chip-active' : '') + '" data-action="study-unit" data-book="' + esc(bookId) + '" data-unit="' + esc(u.id) + '">' + esc(u.name) + '</button>';
    });
    html += '</div>';

    if (unitId) {
      const un = book.units.find(u => u.id === unitId);
      html += '<div class="btn-row"><button class="btn btn-primary" data-action="test-book-unit" data-book="' + esc(bookId) + '" data-unit="' + esc(unitId) + '">📝 测试本章节' + (un ? '（' + esc(un.name) + '）' : '') + '</button></div>';
    }

    let words = unitId ? Store.getUnitWords(bookId, unitId) : Store.getBookWords(bookId);
    if (mode === 'card') return html + studyCard(book, words, unitId);
    return html + studyBrowse(book, words, unitId);
  }

  function studyBrowse(book, words, unitId) {
    let html = '<div class="study-toolbar"><input type="search" id="studySearch" class="input" placeholder="搜索单词…" value=""><span class="muted small">' + words.length + ' 词</span></div>';
    html += '<div class="word-list" id="wordList">';
    let lastGroup = null;
    words.forEach(w => {
      if (typeof w.group === 'number' && w.group !== lastGroup) {
        html += '<div class="group-header">词群 ' + (w.group + 1) + '</div>';
        lastGroup = w.group;
      }
      const mastered = !!S().mastered[w.id];
      html += '<div class="word-row" data-action="word-detail" data-wid="' + esc(w.id) + '">' +
        '<div class="word-row-main">' +
        '<span class="word-h">' + esc(w.headword) + '</span>' +
        (w.phonetic ? '<span class="phonetic">' + esc(w.phonetic) + '</span>' : '') +
        UI.posBadge(w.pos) +
        '<span class="word-mean">' + UI.meaningPreview(w) + '</span>' +
        '</div>' +
        '<div class="word-row-side">' + (mastered ? '<span class="tag tag-green">已掌握</span>' : '') + UI.speakBtn(w) + '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function studyCard(book, words, unitId) {
    if (!words.length) return '<p class="muted">该单元没有单词。</p>';
    if (cardState.index >= words.length) cardState.index = 0;
    const idx = cardState.index;
    const w = words[idx];
    const s = S();
    const mastered = !!s.mastered[w.id];
    const inFreq = !!s.frequent.words[w.id];
    let html = '<div class="card-study">';
    html += '<div class="study-progress muted small">' + (idx + 1) + ' / ' + words.length + '</div>';
    html += '<div class="flashcard' + (cardState.flipped ? ' flipped' : '') + '" id="flashcard">';
    html += '<div class="flash-inner">';
    html += '<div class="flash-front"><div class="flash-word">' + esc(w.headword) + '</div>';
    html += w.phonetic ? '<div class="phonetic">' + esc(w.phonetic) + '</div>' : '';
    html += '<div class="flash-front-bottom">' + UI.posBadge(w.pos) + UI.speakBtn(w) + '</div>';
    html += '</div>';
    html += '<div class="flash-back">' + wordContent(w) + '</div>';
    html += '</div></div>';
    html += '<div class="btn-row center">';
    html += '<button class="btn" data-action="card-prev">←</button>';
    html += '<button class="btn btn-primary" data-action="card-flip">翻面</button>';
    html += '<button class="btn" data-action="card-next">→</button>';
    html += '</div>';
    html += '<div class="btn-row center">';
    html += '<button class="btn btn-success' + (mastered ? ' on' : '') + '" data-action="card-know">认识 ✓</button>';
    html += '<button class="btn btn-danger' + (inFreq ? ' on' : '') + '" data-action="card-unknown">不认识 ✗</button>';
    html += '</div>';
    html += '<p class="muted small center">翻面自动发音；点「认识」标记掌握并下一张；点「不认识」加入经常错词本。</p>';
    html += '</div>';
    return html;
  }

  // 重要单词本按钮（☆/★）
  function starBtn(w) {
    const on = !!(S().important.words && S().important.words[w.id]);
    return '<button class="star-btn' + (on ? ' on' : '') + '" data-action="toggle-important" data-wid="' + esc(w.id) + '" title="' + (on ? '移出重要单词本' : '加入重要单词本') + '">' + (on ? '★' : '☆') + '</button>';
  }

  // 单词完整内容（详情/卡片背面共用）
  function wordContent(w) {
    let h = '';
    const senses = w.senses || [];
    if (senses.length) {
      h += '<div class="sense-list">';
      senses.forEach((s, i) => {
        h += '<div class="sense-item">';
        h += '<div class="sense-mean">' + (senses.length > 1 ? '<span class="sense-no">' + (i + 1) + '</span>' : '') + esc(s.meaning || '') + '</div>';
        if (s.examples && s.examples.length) {
          h += '<ul class="examples">' + s.examples.map(e => '<li><span class="ex-en">' + esc(e) + '</span></li>').join('') + '</ul>';
        }
        h += '</div>';
      });
      h += '</div>';
    }
    if (w.collocations && w.collocations.length) {
      h += '<div class="detail-block"><div class="detail-label">📎 词组 / 搭配</div><ul class="plain-list">' + w.collocations.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
    }
    if (w.tips && w.tips.length) {
      h += '<div class="detail-block"><div class="detail-label">💡 助记小提示</div><ul class="plain-list">' + w.tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
    }
    if (w.synonyms && w.synonyms.length) {
      h += '<div class="detail-block"><div class="detail-label">🔁 同义词</div><div class="chips">' + w.synonyms.map(sy => '<span class="chip chip-sm">' + esc(sy) + '</span>').join('') + '</div></div>';
    }
    return h;
  }

  // ---------- 测试 ----------
  // 会话状态
  let quiz = null;
  let cardState = { index: 0, flipped: false };

  function test(params) {
    params = params || {};
    if (params.mode === 'quiz' && quiz) return testQuiz();
    if (params.mode === 'result' && quiz) return testResult();
    return testSetup(params);
  }

  function testSetup(params) {
    const s = S();
    const preset = params.preset || 'book';
    const presetBook = params.book || '';
    let html = '<div class="page-head"><h1>测试</h1><p class="muted" id="testDesc">看单词 → 打出意思（语义一致就算对）→ 答错自动进错题本。每轮每个单词只出现一次。</p></div>';

    // 测试范围
    html += '<div class="section-title"><h2>① 选择测试范围</h2></div>';
    html += '<div class="seg" id="testScope">';
    html += '<button class="seg-btn' + (preset === 'book' ? ' active' : '') + '" data-action="test-preset" data-preset="book">词库 / 单元</button>';
    html += '<button class="seg-btn' + (preset === 'error' ? ' active' : '') + '" data-action="test-preset" data-preset="error">错题本</button>';
    html += '<button class="seg-btn' + (preset === 'frequent' ? ' active' : '') + '" data-action="test-preset" data-preset="frequent">经常错词</button>';
    html += '<button class="seg-btn' + (preset === 'important' ? ' active' : '') + '" data-action="test-preset" data-preset="important">重要单词</button>';
    html += '</div>';

    if (preset === 'book') {
      html += '<div class="form-group"><label>词库</label><select class="input" id="testBook">';
      s.books.forEach(b => { html += '<option value="' + esc(b.id) + '"' + (b.id === presetBook ? ' selected' : '') + '>' + esc(b.name) + '</option>'; });
      html += '</select></div>';
      html += '<div class="form-group"><label>单元 / 章节（选一个就只测这一章）</label><select class="input" id="testUnit"><option value="">全部单元</option></select></div>';
      html += '<div class="form-group"><label>错题去向</label>';
      html += '<div class="radio-row">';
      html += '<label class="radio"><input type="radio" name="roundKind" value="r1" checked> 第1次测试 → 第1次错题本</label>';
      html += '<label class="radio"><input type="radio" name="roundKind" value="r2"> 第2次完整测试 → 第2次错题本</label>';
      html += '</div><p class="muted small">第2次完整测试：等你把全部单词重新背完一遍后再测，错词单独进第2次错题本。</p></div>';
      const presetBookObj = Store.getBook(presetBook);
      const isListenBook = !!(presetBookObj && presetBookObj.kind === 'listening');
      html += '<div class="form-group" id="listenModeWrap"' + (isListenBook ? '' : ' style="display:none"') + '><label>出题方式（王陆语料库）</label>';
      html += '<div class="radio-row">';
      html += '<label class="radio"><input type="radio" name="listenMode" value="listen" checked> 🔊 听音写意：听发音 → 写意思</label>';
      html += '<label class="radio"><input type="radio" name="listenMode" value="see"> 👀 看词写意：看单词 → 写意思</label>';
      html += '</div><p class="muted small">听音写意不显示单词，只听发音写中文意思（写一个即可），练听力反应；错词一样进错题本。</p></div>';
      html += '<div id="testModeWrap"></div>';
    } else if (preset === 'error') {
      html += '<div class="form-group"><label>选择错题本</label><select class="input" id="testErrorBook">';
      s.errorBooks.forEach(eb => {
        const cnt = Object.keys(eb.words).length;
        if (cnt) html += '<option value="' + esc(eb.id) + '">' + esc(eb.name) + '（' + cnt + ' 词）</option>';
      });
      html += '</select></div>';
      html += '<div id="testModeWrap"></div>';
      if (!s.errorBooks.length) html += '<p class="muted">还没有错题本，先去测一次吧。</p>';
    } else if (preset === 'frequent') {
      const cnt = Object.keys(s.frequent.words).length;
      html += '<p class="muted">经常错词本当前有 ' + cnt + ' 个单词（多次答错自动收录，也可手动添加）。</p>';
    } else if (preset === 'important') {
      const cnt = Object.keys(s.important.words).length;
      html += '<p class="muted">重要单词本当前有 ' + cnt + ' 个单词（学习和测试时点 ⭐ 即可加入）。</p>';
    }

    html += '<div class="section-title"><h2>② 选项</h2></div>';
    html += '<div class="form-group"><label class="check"><input type="checkbox" id="optShuffle" checked> 乱序出题</label></div>';
    html += '<div class="form-group"><label class="check"><input type="checkbox" id="optShowPhonetic" checked> 显示音标</label></div>';
    html += '<div class="form-group"><label>单词数量</label><select class="input" id="optCount"><option value="all">全部</option><option value="20">20</option><option value="30">30</option><option value="50">50</option></select></div>';

    html += '<div class="btn-row"><button class="btn btn-primary btn-lg" data-action="start-test" data-preset="' + esc(preset) + '">开始测试 🚀</button></div>';
    return html;
  }

  function testQuiz() {
    const w = quiz.words[quiz.idx];
    const s = S();
    const qn = quiz.idx + 1;
    const total = quiz.words.length;
    let html = '<div class="quiz-wrap">';
    html += '<div class="quiz-progress"><div class="progress"><div class="progress-bar" style="width:' + Math.round(qn / total * 100) + '%"></div></div><div class="muted small">' + (quiz.listen ? '🔊 听音写意 · ' : '') + '第 ' + qn + ' / ' + total + ' 题 · 已对 ' + quiz.correct + ' · 已错 ' + quiz.wrong + '</div></div>';
    html += '<div class="quiz-card card' + (quiz.revealed ? (quiz.lastCorrect ? ' quiz-correct' : ' quiz-wrong') : '') + '">';
    if (quiz.listen && !quiz.revealed) {
      html += '<div class="quiz-listen-hero">';
      html += '<div class="listen-word-hidden">听发音，写意思</div>';
      html += '<button class="listen-play-btn" data-action="speak-current" title="重听发音">🔊 播放发音</button>';
      html += '<div class="muted small">每个新词会自动朗读，可点上方按钮重听</div>';
      html += '</div>';
    } else {
      html += '<div class="quiz-word-row">';
      html += '<div class="quiz-word">' + esc(w.headword) + '</div>';
      if (quiz.showPhonetic && w.phonetic) html += '<div class="phonetic">' + esc(w.phonetic) + '</div>';
      html += UI.posBadge(w.pos) + starBtn(w) + UI.speakBtn(w);
      html += '</div>';
    }

    if (!quiz.revealed) {
      html += '<textarea id="quizInput" class="input quiz-input" rows="3" placeholder="' + (quiz.listen ? '听发音，写出中文意思（写一个即可，同义词也算对）' : '打出它的意思（可多个，用分号隔开；同义词也算对）') + '"></textarea>';
      html += '<div class="btn-row">';
      if (quiz.idx > 0) html += '<button class="btn" data-action="prev-question">← 上一题</button>';
      html += '<button class="btn btn-primary btn-lg" data-action="submit-answer">提交答案</button></div>';
      html += '<p class="muted small">快捷键：Enter 提交，再按 Enter 下一题</p>';
    } else {
      const ev = quiz.lastEv;
      const verdict = quiz.lastCorrect ? '答对 ✓' : '答错 ✗';
      html += '<div class="quiz-verdict ' + (quiz.lastCorrect ? 'ok' : 'no') + '">' + verdict + (ev.matchedCount < ev.total ? '（答出 ' + ev.matchedCount + ' / ' + ev.total + ' 个意思）' : '') + '</div>';
      if (quiz.lastInput) html += '<div class="quiz-your-answer">你的回答：' + esc(quiz.lastInput) + '</div>';
      // 逐义项揭示
      const ok = quiz.lastCorrect;
      html += '<div class="sense-list">';
      (w.senses || []).forEach((s, i) => {
        const hit = ev.matched[i];
        const cls = hit ? 'sense-hit' : (ok ? 'sense-info' : 'sense-miss');
        const mark = hit ? '✓' : (ok ? '＋' : '✗');
        html += '<div class="sense-item ' + cls + '">';
        html += '<div class="sense-mean"><span class="sense-mark">' + mark + '</span> ' + esc(s.meaning || '') + '</div>';
        if (!hit && !ok && s.examples && s.examples.length) {
          html += '<ul class="examples">' + s.examples.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>';
        }
        html += '</div>';
      });
      html += '</div>';
      if (ok && ev.missed.length) html += '<div class="quiz-note">✓ 已通过（答对一个意思即可）。＋ 标记的是它的其他说法/意思，可顺带记一下。</div>';
      if (!ok && ev.missed.length) html += '<div class="quiz-note miss">还有 ' + ev.missed.length + ' 个意思没记住，标 ✗ 的就是。</div>';
      // 答案出现时：加入重要单词本
      {
        const inImp = !!(s.important.words && s.important.words[w.id]);
        html += '<div class="btn-row">';
        html += '<button class="btn star-btn' + (inImp ? ' on' : '') + '" data-action="toggle-important" data-wid="' + esc(w.id) + '">' + (inImp ? '★ 已在重要单词本' : '☆ 加入重要单词本') + '</button>';
        html += '</div>';
      }
      if (!quiz.lastCorrect) {
        const ww = w;
        if (ww.collocations && ww.collocations.length) html += '<div class="detail-block"><div class="detail-label">📎 词组</div><ul class="plain-list">' + ww.collocations.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></div>';
        if (ww.tips && ww.tips.length) html += '<div class="detail-block"><div class="detail-label">💡 助记</div><ul class="plain-list">' + ww.tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
      }
      html += '<div class="btn-row">';
      if (quiz.idx > 0) html += '<button class="btn" data-action="prev-question">← 上一题</button>';
      if (quiz.idx < total - 1) html += '<button class="btn btn-primary btn-lg" data-action="next-question">下一题 →</button>';
      else html += '<button class="btn btn-primary btn-lg" data-action="finish-test">查看测试结果 🎉</button>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function testResult() {
    const total = quiz.words.length;
    const correct = quiz.correct;
    const wrong = quiz.wrong;
    const acc = total ? Math.round(correct / total * 100) : 0;
    const wrongItems = quiz.results.filter(r => !r.correct);
    let html = '<div class="page-head"><h1>测试结果</h1></div>';
    html += '<div class="result-hero card">';
    html += '<div class="result-score">' + acc + '%</div>';
    html += '<div class="result-line">答对 <b>' + correct + '</b> / ' + total + ' · 答错 <b>' + wrong + '</b> 词</div>';
    html += '<div class="result-line muted">错词已自动加入「' + esc(quiz.resultBookName) + '」</div>';
    html += '</div>';

    if (wrongItems.length) {
      html += '<div class="section-title"><h2>错词复习（' + wrongItems.length + '）</h2></div>';
      html += '<div class="word-list">' + wrongItems.map(r => {
        const w = Store.getWord(r.wid);
        if (!w) return '';
        return '<div class="word-row" data-action="word-detail" data-wid="' + esc(w.id) + '">' +
          '<div class="word-row-main"><span class="word-h">' + esc(w.headword) + '</span>' + UI.posBadge(w.pos) +
          '<span class="word-mean">' + UI.meaningPreview(w) + '</span></div>' +
          '<div class="word-row-side">' + UI.speakBtn(w) + '</div></div>';
      }).join('') + '</div>';
      html += '<div class="btn-row"><button class="btn btn-primary" data-action="retest-wrong">重测这 ' + wrongItems.length + ' 个错词</button></div>';
    } else {
      html += '<div class="card"><p class="muted">全部答对，太棒了！🎉</p></div>';
    }

    html += '<div class="btn-row"><button class="btn" data-action="goto-test">返回测试</button><button class="btn" data-action="goto-errors">去看错题本</button></div>';
    return html;
  }

  // ---------- 错题本 ----------
  function errors() {
    const s = S();
    let html = '<div class="page-head"><h1>错题本</h1><p class="muted">第一次测试的错词进「第1次错题本」；重测它再错的进它的子册，一轮轮缩小；整体二测单独成册；多次答错的自动进「经常错词本」。</p></div>';

    // 重要单词本
    const impCount = Object.keys(s.important.words).length;
    html += '<div class="section-title"><h2>⭐ 重要单词本（' + impCount + '）</h2></div>';
    if (!impCount) html += '<div class="card"><p class="muted">学习和测试时点 ⭐ 即可把重要的单词收进来。</p></div>';
    else {
      html += '<div class="card error-book-card"><div class="eb-actions">';
      html += '<button class="btn btn-sm btn-primary" data-action="test-important">重测重要单词</button>';
      html += '<button class="btn btn-sm" data-action="view-important">查看单词</button>';
      html += '</div></div>';
    }

    // 经常错词本
    const freqWords = Object.keys(s.frequent.words).length;
    html += '<div class="section-title"><h2>🔥 经常错词本（' + freqWords + '）</h2></div>';
    if (!freqWords) html += '<div class="card"><p class="muted">暂无。累计答错 ' + s.settings.freqThreshold + ' 次以上的单词会自动收进来，也可以在单词详情里手动添加。</p></div>';
    else {
      html += '<div class="card error-book-card">';
      html += '<div class="eb-actions"><button class="btn btn-sm btn-primary" data-action="test-frequent">重测经常错词</button><button class="btn btn-sm" data-action="view-frequent">查看单词</button></div>';
      html += '</div>';
    }

    // 各词库错题本树
    s.books.forEach(book => {
      const roots = s.errorBooks.filter(e => e.bookId === book.id && !e.parentId);
      const hasAny = s.errorBooks.some(e => e.bookId === book.id && Object.keys(e.words).length);
      html += '<div class="section-title"><h2>' + esc(book.name) + ' 的错题本</h2></div>';
      if (!hasAny) { html += '<div class="card"><p class="muted">还没有错题。去「测试」测一轮，错词会自动进这里。</p></div>'; return; }

      function renderNode(eb, depth) {
        const cnt = Object.keys(eb.words).length;
        const masteredCnt = Object.values(eb.words).filter(v => v.mastered).length;
        if (!cnt && !depth) return '';
        let h = '<div class="card error-book-card" style="margin-left:' + (depth * 18) + 'px">';
        h += '<div class="eb-head">';
        h += '<div><span class="eb-name">' + esc(eb.name) + '</span>';
        const unitCounts = {};
        Object.keys(eb.words).forEach(wid => { const w = Store.getWord(wid); if (w) { const un = Store.unitNameOf(w); if (un) unitCounts[un] = (unitCounts[un] || 0) + 1; } });
        const unitSet = Object.keys(unitCounts);
        h += '<span class="muted small">' + cnt + ' 词' + (masteredCnt ? ' · 已掌握 ' + masteredCnt : '') + ' · 第' + eb.round + '轮' + (unitSet.length ? ' · 覆盖 ' + unitSet.length + ' 个单元' : '') + '</span></div>';
        if (unitSet.length) {
          h += '<div class="chips eb-unit-chips">';
          unitSet.forEach(un => {
            h += '<button class="chip chip-sm" data-action="view-eb-unit" data-eb="' + esc(eb.id) + '" data-unit="' + esc(un) + '">' + esc(shortUnit(un)) + ' ' + unitCounts[un] + '</button>';
          });
          h += '</div>';
        }
        h += '<div class="eb-actions">';
        h += '<button class="btn btn-sm btn-primary" data-action="test-errorbook" data-eb="' + esc(eb.id) + '">重测</button>';
        h += '<button class="btn btn-sm" data-action="view-errorbook" data-eb="' + esc(eb.id) + '">单词</button>';
        h += '<button class="btn btn-sm btn-danger" data-action="clear-errorbook" data-eb="' + esc(eb.id) + '">清空</button>';
        h += '</div></div></div>';
        Store.childrenOf(eb.id).forEach(ch => { h += renderNode(ch, depth + 1); });
        return h;
      }
      roots.forEach(r => { html += renderNode(r, 0); });
    });
    return html;
  }

  // 错题本单词列表（弹窗，可按单元筛选）
  function errorBookWordsModal(ebId, unitFilter) {
    const eb = Store.getErrorBook(ebId);
    if (!eb) return;
    const s = S();
    const entries = Object.keys(eb.words);
    // 统计单元分布
    const unitCount = new Map();
    const widUnit = new Map();
    entries.forEach(wid => {
      const w = Store.getWord(wid); if (!w) return;
      const un = Store.unitNameOf(w);
      widUnit.set(wid, un);
      unitCount.set(un, (unitCount.get(un) || 0) + 1);
    });
    const unitNames = [...unitCount.keys()].filter(Boolean);
    let html = '<div class="modal-head"><h3>' + esc(eb.name) + '</h3><button class="icon-btn" data-action="modal-close">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="muted small">共 ' + entries.length + ' 词 · 每词答错 ' + s.settings.freqThreshold + ' 次以上会进「经常错词本」</div>';
    if (unitNames.length > 1) {
      html += '<div class="chip-row">';
      html += '<button class="chip' + (!unitFilter ? ' chip-active' : '') + '" data-action="filter-eb-unit" data-eb="' + esc(ebId) + '" data-unit="">全部</button>';
      unitNames.forEach(un => {
        html += '<button class="chip' + (unitFilter === un ? ' chip-active' : '') + '" data-action="filter-eb-unit" data-eb="' + esc(ebId) + '" data-unit="' + esc(un) + '">' + esc(shortUnit(un)) + '（' + unitCount.get(un) + '）</button>';
      });
      html += '</div>';
      if (unitFilter) {
        const uid = Store.getUnitIdByName(eb.bookId, unitFilter);
        html += '<div class="btn-row">';
        html += '<button class="btn btn-sm btn-primary" data-action="retest-eb-unit" data-eb="' + esc(ebId) + '" data-unit="' + esc(unitFilter) + '">重测本单元</button>';
        html += '<button class="btn btn-sm" data-action="goto-study-unit" data-book="' + esc(eb.bookId) + '" data-unit="' + esc(uid) + '">去「' + esc(unitFilter) + '」学习</button>';
        html += '</div>';
      }
    }
    if (!entries.length) html += '<p class="muted">本子还没有单词。</p>';
    else {
      html += '<div class="word-list">' + entries.filter(wid => !unitFilter || widUnit.get(wid) === unitFilter).map(wid => {
        const w = Store.getWord(wid); if (!w) return '';
        const e = eb.words[wid];
        const un = widUnit.get(wid) || '';
        return '<div class="word-row" data-action="word-detail" data-wid="' + esc(w.id) + '">' +
          '<div class="word-row-main"><span class="word-h">' + esc(w.headword) + '</span>' + UI.posBadge(w.pos) +
          (un ? '<span class="tag unit-tag">' + esc(shortUnit(un)) + '</span>' : '') +
          '<span class="word-mean">' + UI.meaningPreview(w) + '</span></div>' +
          '<div class="word-row-side"><span class="tag' + (e.mastered ? ' tag-green' : ' tag-red') + '">' + (e.mastered ? '已掌握' : '错' + e.wrongCount + '次') + '</span>' + UI.speakBtn(w) +
          '<button class="icon-btn" title="移出此错题本" data-action="remove-error-word" data-eb="' + esc(ebId) + '" data-wid="' + esc(w.id) + '">🗑</button></div>' +
          '</div>';
      }).join('') + '</div>';
    }
    html += '</div>';
    UI.modal(html, { size: 'lg' });
  }

  // 经常错词列表（弹窗）
  function frequentModal() {
    const s = S();
    const ids = Object.keys(s.frequent.words);
    let html = '<div class="modal-head"><h3>🔥 经常错词本</h3><button class="icon-btn" data-action="modal-close">✕</button></div>';
    html += '<div class="modal-body">';
    if (!ids.length) html += '<p class="muted">暂无经常错词。</p>';
    else {
      html += '<div class="word-list">' + ids.map(wid => {
        const w = Store.getWord(wid); if (!w) return '';
        const e = s.frequent.words[wid];
        return '<div class="word-row" data-action="word-detail" data-wid="' + esc(w.id) + '">' +
          '<div class="word-row-main"><span class="word-h">' + esc(w.headword) + '</span>' + UI.posBadge(w.pos) +
          '<span class="word-mean">' + UI.meaningPreview(w) + '</span></div>' +
          '<div class="word-row-side"><span class="tag tag-red">错' + e.wrongCount + '次</span>' + UI.speakBtn(w) +
          '<button class="icon-btn" title="移出" data-action="remove-frequent" data-wid="' + esc(w.id) + '">🗑</button></div>' +
          '</div>';
      }).join('') + '</div>';
    }
    html += '</div>';
    UI.modal(html, { size: 'lg' });
  }

  // 单元名缩写（显示用）
  function shortUnit(name) {
    if (!name) return '';
    const m = name.match(/^(高频词|中频词) Word List (\d+)$/);
    if (m) return m[1] + 'WL' + m[2];
    return name;
  }

  // 重要单词本列表（弹窗）
  function importantModal() {
    const s = S();
    const ids = Object.keys(s.important.words);
    let html = '<div class="modal-head"><h3>⭐ 重要单词本</h3><button class="icon-btn" data-action="modal-close">✕</button></div>';
    html += '<div class="modal-body">';
    if (!ids.length) html += '<p class="muted">暂无重要单词。</p>';
    else {
      html += '<div class="word-list">' + ids.map(wid => {
        const w = Store.getWord(wid); if (!w) return '';
        return '<div class="word-row" data-action="word-detail" data-wid="' + esc(w.id) + '">' +
          '<div class="word-row-main"><span class="word-h">' + esc(w.headword) + '</span>' + UI.posBadge(w.pos) +
          '<span class="word-mean">' + UI.meaningPreview(w) + '</span></div>' +
          '<div class="word-row-side">' + UI.speakBtn(w) +
          '<button class="icon-btn" title="移出重要单词本" data-action="remove-important" data-wid="' + esc(w.id) + '">🗑</button></div>' +
          '</div>';
      }).join('') + '</div>';
    }
    html += '</div>';
    UI.modal(html, { size: 'lg' });
  }

  // ---------- 设置 ----------
  function settings() {
    const st = S();
    const set = st.settings;
    let html = '<div class="page-head"><h1>设置</h1></div>';

    html += '<div class="section-title"><h2>判定</h2></div>';
    html += '<div class="card form-card">';
    html += '<div class="form-group"><label>多义词判定</label><select class="input" id="setPolysemy">';
    html += '<option value="lenient"' + (set.polysemy === 'lenient' ? ' selected' : '') + '>宽松（推荐）：写出任意一个意思就算对，同义词也行</option>';
    html += '<option value="strict"' + (set.polysemy === 'strict' ? ' selected' : '') + '>严格：所有意思都答出才算对</option>';
    html += '</select></div>';
    html += '<div class="form-group"><label>经常错词收录阈值（累计答错次数）</label><select class="input" id="setFreqThreshold">';
    [2, 3, 4, 5].forEach(n => html += '<option value="' + n + '"' + (set.freqThreshold === n ? ' selected' : '') + '>' + n + ' 次</option>');
    html += '</select></div>';
    html += '<div class="form-group"><label class="check"><input type="checkbox" id="setAutoMaster"' + (set.autoMaster ? ' checked' : '') + '> 测试答对的单词自动标记为「已掌握」</label></div>';
    html += '</div>';

    html += '<div class="section-title"><h2>发音</h2></div>';
    html += '<div class="card form-card">';
    html += '<div class="form-group"><label>发音语音</label><select class="input" id="setTtsLang">';
    html += '<option value="auto"' + (set.ttsLang === 'auto' ? ' selected' : '') + '>自动（优先美音）</option>';
    html += '<option value="en-US"' + (set.ttsLang === 'en-US' ? ' selected' : '') + '>美音 en-US</option>';
    html += '<option value="en-GB"' + (set.ttsLang === 'en-GB' ? ' selected' : '') + '>英音 en-GB</option>';
    html += '</select></div>';
    html += '<div class="form-group"><label>语速：<span id="rateVal">' + set.ttsRate + '</span></label><input type="range" id="setTtsRate" min="0.5" max="1.5" step="0.05" value="' + set.ttsRate + '"></div>';
    html += '<div class="form-group"><label class="check"><input type="checkbox" id="setAutoSpeak"' + (set.autoSpeak ? ' checked' : '') + '> 自动发音（测试出题、卡片翻面时朗读）</label></div>';
    html += '</div>';

    html += '<div class="section-title"><h2>外观</h2></div>';
    html += '<div class="card form-card"><div class="btn-row"><button class="btn" data-action="toggle-theme">' + (set.theme === 'dark' ? '☀️ 切换浅色' : '🌙 切换深色') + '</button></div></div>';

    html += '<div class="section-title"><h2>☁️ 云同步（手机 ↔ 电脑）</h2></div>';
    html += '<div class="card form-card">';
    html += '<p class="muted small">用免费的 Supabase 存一份云端进度，手机和电脑都能同步。首次使用：先在一台设备「⬆️ 上传进度」，再在另一台「⬇️ 下载进度」；之后可勾选自动同步。<b>密钥请填 sb_publishable_ 开头的公钥（不要填 sb_secret_ 密钥）</b>。</p>';
    html += '<div class="form-group"><label>项目地址（Project URL）</label><input class="input" id="clServer" placeholder="https://xxxx.supabase.co"></div>';
    html += '<div class="form-group"><label>anon 公钥（anon public key）</label><input class="input" id="clAppKey" type="password" placeholder="sb_publishable_...（Supabase 设置→API 里复制）"></div>';
    html += '<div class="form-group"><label>同步口令（自己起一个，比如英文名+日期，两边填一样）</label><input class="input" id="clKey" placeholder="例如 my2026"></div>';
    html += '<div class="form-group"><label class="check"><input type="checkbox" id="clAuto"> 自动同步（打开网站时自动下载较新的，学习时自动上传）</label></div>';
    html += '<div class="btn-row">';
    html += '<button class="btn btn-primary" data-action="cloud-save">保存设置</button>';
    html += '<button class="btn" data-action="cloud-test">测试连接</button>';
    html += '<button class="btn" data-action="cloud-push">⬆️ 上传进度</button>';
    html += '<button class="btn" data-action="cloud-pull">⬇️ 下载进度</button>';
    html += '</div>';
    html += '<p class="muted small" id="cloudStatus">未配置云同步。</p>';
    html += '</div>';

    html += '<div class="section-title"><h2>数据</h2></div>';
    html += '<div class="card form-card">';
    html += '<p class="muted">数据保存在这台电脑的浏览器里，导出备份以防丢失。</p>';
    html += '<div class="btn-row">';
    html += '<button class="btn" data-action="export-data">⬇️ 导出备份</button>';
    html += '<button class="btn" data-action="import-data">⬆️ 导入备份</button>';
    html += '<button class="btn btn-danger" data-action="reset-data">🗑 清空全部数据</button>';
    html += '</div></div>';
    return html;
  }

  // ---------- 单词详情弹窗 ----------
  function wordModal(wid) {
    const w = Store.getWord(wid);
    if (!w) return;
    const s = S();
    const mastered = !!s.mastered[wid];
    const inFrequent = !!s.frequent.words[wid];
    const inImportant = !!(s.important.words && s.important.words[wid]);
    let html = '<div class="modal-head">';
    html += '<div class="word-title-row"><span class="word-big">' + esc(w.headword) + '</span>' + (w.phonetic ? '<span class="phonetic">' + esc(w.phonetic) + '</span>' : '') + UI.speakBtn(w) + '</div>';
    html += '<button class="icon-btn" data-action="modal-close">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="meta-row">' + UI.posBadge(w.pos) + UI.examBadge(w.examType) + (w.bookId ? '<span class="muted small">' + esc((Store.getBook(w.bookId) || {}).name || '') + '</span>' : '') + '</div>';
    html += wordContent(w);
    html += '</div>';
    html += '<div class="modal-foot">';
    html += '<button class="btn' + (mastered ? ' btn-success' : '') + '" data-action="toggle-mastered" data-wid="' + esc(wid) + '">' + (mastered ? '已掌握 ✓' : '标记掌握') + '</button>';
    html += '<button class="btn' + (inFrequent ? ' btn-danger' : '') + '" data-action="toggle-frequent" data-wid="' + esc(wid) + '">' + (inFrequent ? '已加入经常错词' : '加入经常错词') + '</button>';
    html += '<button class="btn star-btn' + (inImportant ? ' on' : '') + '" data-action="toggle-important" data-wid="' + esc(wid) + '">' + (inImportant ? '★ 已在重要本' : '☆ 加入重要本') + '</button>';
    html += '<button class="btn" data-action="edit-word" data-wid="' + esc(wid) + '">编辑资料</button>';
    html += '</div>';
    UI.modal(html, { size: 'lg' });
  }

  // ---------- 编辑单词弹窗 ----------
  function editWordModal(wid) {
    const w = Store.getWord(wid);
    if (!w) return;
    const sensesText = (w.senses || []).map(s => (s.meaning || '')).join('；');
    const examplesText = (w.senses || []).map(s => (s.examples || []).join('|')).filter(Boolean).join('；');
    let html = '<div class="modal-head"><h3>编辑：' + esc(w.headword) + '</h3><button class="icon-btn" data-action="modal-close">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="form-group"><label>音标</label><input class="input" id="edPhonetic" value="' + esc(w.phonetic || '') + '" placeholder="/əˈbændən/"></div>';
    html += '<div class="form-group"><label>词性</label><input class="input" id="edPos" value="' + esc(w.pos || '') + '" placeholder="v. / n. / adj."></div>';
    html += '<div class="form-group"><label>意思（多个义项用分号隔开）</label><textarea class="input" id="edSenses" rows="2">' + esc(sensesText) + '</textarea></div>';
    html += '<div class="form-group"><label>例句（每个义项的例句用 | 分隔，义项间用 ；隔开）</label><textarea class="input" id="edExamples" rows="3">' + esc(examplesText) + '</textarea></div>';
    html += '<div class="form-group"><label>词组 / 搭配（每行一个）</label><textarea class="input" id="edCollocations" rows="2">' + esc((w.collocations || []).join('\n')) + '</textarea></div>';
    html += '<div class="form-group"><label>助记小提示（每行一个）</label><textarea class="input" id="edTips" rows="2">' + esc((w.tips || []).join('\n')) + '</textarea></div>';
    html += '<div class="form-group"><label>同义词（用逗号隔开）</label><input class="input" id="edSynonyms" value="' + esc((w.synonyms || []).join(', ')) + '"></div>';
    html += '</div>';
    html += '<div class="modal-foot"><button class="btn" data-action="modal-close">取消</button><button class="btn btn-primary" data-action="save-word" data-wid="' + esc(wid) + '">保存</button></div>';
    UI.modal(html, { size: 'lg' });
  }

  // ---------- 导入弹窗 ----------
  function importModal() {
    let html = '<div class="modal-head"><h3>导入单词本</h3><button class="icon-btn" data-action="modal-close">✕</button></div>';
    html += '<div class="modal-body">';
    html += '<div class="form-group"><label>词库名称</label><input class="input" id="impName" placeholder="例如：我的六级词汇"></div>';
    html += '<div class="form-group"><label>考试类型</label><select class="input" id="impExam">';
    html += '<option value="cet6">六级</option><option value="ielts">雅思</option><option value="general">通用 / 其他</option>';
    html += '</select></div>';
    html += '<div class="form-group"><label>选择文件（txt / csv / json）</label><input type="file" class="input" id="impFile" accept=".txt,.csv,.json,.tsv"></div>';
    html += '<div class="form-group"><label>或直接粘贴文本（每行一个单词，可带释义）</label><textarea class="input" id="impText" rows="6" placeholder="abandon 放弃；抛弃&#10;abundant 丰富的；充裕的"></textarea></div>';
    html += '<div class="preview-box" id="impPreview"></div>';
    html += '</div>';
    html += '<div class="modal-foot"><button class="btn" data-action="modal-close">取消</button><button class="btn btn-primary" data-action="do-import">导入</button></div>';
    UI.modal(html, { size: 'lg' });
  }

  return { dashboard, books, study, test, errors, settings, wordModal, editWordModal, importModal, errorBookWordsModal, frequentModal, importantModal, wordContent, quizState: function(){ return quiz; }, setQuiz: function(q){ quiz = q; },
  cardState: function(){ return cardState; }, setCardState: function(s){ cardState = Object.assign(cardState, s); } };
})();
