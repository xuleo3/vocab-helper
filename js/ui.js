// ============================================================
// UI：通用渲染/弹窗/提示/转义
// ============================================================
const UI = (function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type) {
    const root = document.getElementById('toastRoot');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.classList.add('show'); }, 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }

  function modal(html, opts) {
    opts = opts || {};
    const root = document.getElementById('modalRoot');
    root.innerHTML = '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="modal ' + (opts.size || '') + '">' + html + '</div>';
    root.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay && !opts.noDismiss) closeModal();
    });
    return overlay;
  }
  function closeModal() {
    const root = document.getElementById('modalRoot');
    root.innerHTML = '';
  }
  function confirmBox(title, message, onYes, opts) {
    opts = opts || {};
    const html =
      '<div class="modal-head"><h3>' + esc(title) + '</h3><button class="icon-btn" data-action="modal-close">✕</button></div>' +
      '<div class="modal-body"><p class="muted">' + esc(message) + '</p></div>' +
      '<div class="modal-foot">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn btn-danger" id="confirmYes">' + esc(opts.yesText || '确定') + '</button>' +
      '</div>';
    const ov = modal(html, opts);
    ov.querySelector('#confirmYes').addEventListener('click', function () { closeModal(); onYes && onYes(); });
    return ov;
  }

  // 词性徽章颜色
  function posBadge(pos) {
    if (!pos) return '';
    const p = pos.toLowerCase();
    let cls = 'badge';
    if (p.indexOf('n') === 0) cls += ' badge-n';
    else if (p.indexOf('v') === 0) cls += ' badge-v';
    else if (p.indexOf('adj') === 0) cls += ' badge-adj';
    else if (p.indexOf('adv') === 0) cls += ' badge-adv';
    else cls += ' badge-other';
    return '<span class="' + cls + '">' + esc(pos) + '</span>';
  }
  function examBadge(examType) {
    if (!examType) return '';
    if (examType === 'cet6') return '<span class="badge badge-cet6">六级</span>';
    if (examType === 'ielts') return '<span class="badge badge-ielts">雅思</span>';
    if (examType === 'gaokao') return '<span class="badge badge-gaokao">高考</span>';
    if (examType === 'cet4') return '<span class="badge badge-cet4">四级</span>';
    return '<span class="badge badge-other">通用</span>';
  }

  // 发音按钮
  function speakBtn(w, cls) {
    return '<button class="speak-btn ' + (cls || '') + '" data-action="speak" data-wid="' + esc(w.id) + '" title="发音">🔊</button>';
  }

  // 单词主释义预览（第一个义项）
  function meaningPreview(w) {
    if (!w || !w.senses || !w.senses.length) return '';
    const s = w.senses[0].meaning || '';
    return esc(s.length > 40 ? s.slice(0, 40) + '…' : s);
  }

  return { esc, toast, modal, closeModal, confirmBox, posBadge, examBadge, speakBtn, meaningPreview };
})();
