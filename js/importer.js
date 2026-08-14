// ============================================================
// Importer：解析用户导入的单词本（txt / csv / json / 粘贴文本）
// ============================================================
const Importer = (function () {

  // 主入口：content(字符串) -> { words:[...], warnings:[], format }
  function parse(content) {
    content = (content || '').replace(/^\uFEFF/, '');
    const trimmed = content.trim();
    if (!trimmed) return { words: [], warnings: ['内容为空'], format: 'none' };

    // JSON
    if (trimmed[0] === '[' || trimmed[0] === '{') {
      try { return parseJson(trimmed); }
      catch (e) { return { words: [], warnings: ['JSON 解析失败：' + e.message], format: 'json' }; }
    }

    const lines = trimmed.split(/\r?\n/);

    // CSV（含逗号/制表符/分号 且第一行看起来像表头或含多列）
    const looksCsv = lines.some(l => /[,\t]/.test(l) && l.split(/[,\t]/).length >= 2);
    if (looksCsv) {
      const r = parseCsv(lines);
      if (r.words.length || r.header) return r;
    }

    // 逐行文本
    return parseTxt(lines);
  }

  // ---------- JSON ----------
  function parseJson(str) {
    const data = JSON.parse(str);
    let arr = Array.isArray(data) ? data : (data.words || data.list || []);
    if (!Array.isArray(arr)) throw new Error('无法识别的 JSON 结构');
    const words = [];
    const warnings = [];
    arr.forEach((it, i) => {
      if (typeof it === 'string') {
        words.push({ headword: it.trim(), pos: '', meaning: '' });
        return;
      }
      const head = it.headword || it.word || it.name || it.headWord || '';
      if (!head) { warnings.push('第 ' + (i + 1) + ' 条缺少单词'); return; }
      words.push({
        headword: String(head).trim(),
        phonetic: it.phonetic || it.phone || it.phoneticSymbol || '',
        pos: it.pos || it.partOfSpeech || '',
        meaning: it.meaning || it.translation || it.definition || it.chinese || '',
        examples: normArr(it.example || it.examples || it.sentences),
        collocations: normArr(it.collocations || it.phrases || it.collocation),
        tips: normArr(it.tips || it.tip || it.memory || it.note),
        synonyms: normArr(it.synonyms || it.synonym)
      });
    });
    if (!words.length) warnings.push('没有解析到任何单词');
    return { words, warnings, format: 'json' };
  }

  function normArr(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    return String(v).split(/[|；;\n]/).map(s => s.trim()).filter(Boolean);
  }

  // ---------- CSV / TSV ----------
  const HEADER_MAP = {
    word: 'headword', headword: 'headword', 单词: 'headword', 单词拼写: 'headword', english: 'headword',
    phonetic: 'phonetic', 音标: 'phonetic', phone: 'phonetic',
    pos: 'pos', 词性: 'pos', partofspeech: 'pos', 类型: 'pos',
    meaning: 'meaning', 意思: 'meaning', 释义: 'meaning', 中文: 'meaning', translation: 'meaning', definition: 'meaning', 中文释义: 'meaning',
    example: 'examples', examples: 'examples', 例句: 'examples', sentence: 'examples', sentences: 'examples',
    phrase: 'collocations', phrases: 'collocations', collocation: 'collocations', collocations: 'collocations', 词组: 'collocations', 搭配: 'collocations',
    tip: 'tips', tips: 'tips', 助记: 'tips', 记忆: 'tips', note: 'tips', 提示: 'tips',
    synonym: 'synonyms', synonyms: 'synonyms', 同义词: 'synonyms', 近义词: 'synonyms'
  };

  function parseCsv(lines) {
    // 尝试识别表头
    const first = lines[0];
    const delim = first.indexOf('\t') >= 0 ? '\t' : ',';
    const cells = splitCsv(first, delim);
    let header = null;
    const lower = cells.map(c => c.trim().toLowerCase());
    const known = lower.filter(c => HEADER_MAP[c]);
    if (known.length >= 2) header = cells;

    const start = header ? 1 : 0;
    const words = [];
    const warnings = [];
    for (let i = start; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const c = splitCsv(line, delim);
      if (!c.length) continue;
      let rec = {};
      if (header) {
        header.forEach((h, idx) => {
          const key = HEADER_MAP[String(h).trim().toLowerCase()];
          if (key && c[idx] != null) {
            const val = c[idx].trim();
            if (!rec[key]) rec[key] = val;
            else rec[key] = rec[key] + '；' + val;
          }
        });
      } else {
        // 无表头：2列按 Anki 格式(单词+释义)，>=3列按 word, phonetic, pos, meaning, example, phrase, tip, synonym
        if (c.length <= 2) {
          rec = { headword: (c[0] || '').trim(), meaning: (c[1] || '').trim() };
        } else if (c.length === 3) {
          const c1 = (c[1] || '').trim();
          const looksPos = /^(v|n|adj|adv|prep|conj|pron|num|art|int|abbr|vt|vi|a|ad)\./i.test(c1);
          if (looksPos) rec = { headword: (c[0] || '').trim(), pos: c1, meaning: (c[2] || '').trim() };
          else rec = { headword: (c[0] || '').trim(), phonetic: c1, meaning: (c[2] || '').trim() };
        } else {
          rec = { headword: (c[0] || '').trim(), phonetic: (c[1] || '').trim(), pos: (c[2] || '').trim(), meaning: (c[3] || '').trim() };
        }
        if (c[4]) rec.examples = c[4].trim();
        if (c[5]) rec.collocations = c[5].trim();
        if (c[6]) rec.tips = c[6].trim();
        if (c[7]) rec.synonyms = c[7].trim();
      }
      if (!rec.headword) { warnings.push('第 ' + (i + 1) + ' 行没有单词'); continue; }
      words.push({
        headword: rec.headword,
        phonetic: rec.phonetic || '',
        pos: rec.pos || '',
        meaning: rec.meaning || '',
        examples: splitMulti(rec.examples),
        collocations: splitMulti(rec.collocations),
        tips: splitMulti(rec.tips),
        synonyms: splitMulti(rec.synonyms)
      });
    }
    if (!words.length && !header) warnings.push('没有解析到单词');
    return { words, warnings, format: 'csv', header: !!header };
  }

  function splitMulti(v) {
    if (!v) return [];
    return String(v).split(/[|；;\n]/).map(s => s.trim()).filter(Boolean);
  }

  function splitCsv(line, delim) {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  // ---------- TXT（每行一个单词，可带分隔符和释义） ----------
  function parseTxt(lines) {
    const words = [];
    const warnings = [];
    lines.forEach((line, i) => {
      line = (line || '').trim();
      if (!line) return;
      // 支持 "word 释义" / "word - 释义" / "word|释义" / "word\t释义"
      let head = line, meaning = '';
      const m1 = line.match(/^([A-Za-z][A-Za-z'\- ]*?)\s*[\-|:|：\t]\s*(.+)$/);
      if (m1) { head = m1[1].trim(); meaning = m1[2].trim(); }
      else {
        const m2 = line.match(/^([A-Za-z][A-Za-z'\- ]*?)\s+([\u4e00-\u9fff].*)$/);
        if (m2) { head = m2[1].trim(); meaning = m2[2].trim(); }
        else if (/^[A-Za-z]/.test(line)) { head = line; }
        else { warnings.push('第 ' + (i + 1) + ' 行无法识别：' + line.slice(0, 30)); return; }
      }
      words.push({ headword: head, pos: '', meaning, examples: [], collocations: [], tips: [], synonyms: [] });
    });
    if (!words.length) warnings.push('没有解析到任何单词');
    return { words, warnings, format: 'txt' };
  }

  return { parse };
})();
