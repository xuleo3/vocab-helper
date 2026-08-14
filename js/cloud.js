// ============================================================
// CloudSync：云同步（Supabase 数据存储）
// 原理：把整份学习进度 JSON 存到 Supabase 的一张表 sync_data 里（按「同步口令」区分）
// 首次使用：先在一台设备「上传进度」，再在另一台「下载进度」，之后可开自动同步
// 需要：项目地址(Project URL) + anon 公钥 + 同步口令（在设置里填）
// ============================================================
const CloudSync = (function () {
  let lastPushAt = 0;
  let applying = false;   // 正在应用云端数据，避免回写循环
  let busy = false;       // 防止并发请求

  function getCfg() {
    const c = Store.getCloud();
    return (c && c.server && c.appKey && c.syncKey) ? c : null;
  }
  function headers(c) {
    return {
      'apikey': c.appKey,
      'Authorization': 'Bearer ' + c.appKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }
  function base(c) {
    return String(c.server).replace(/\/+$/, '') + '/rest/v1/sync_data';
  }
  function fetchTO(url, opts, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 15000);
    return fetch(url, Object.assign({}, opts, { signal: ctrl.signal })).then(function (r) {
      clearTimeout(t);
      return r;
    }, function (e) {
      clearTimeout(t);
      throw e;
    });
  }
  async function req(url, opts) {
    let r = null;
    let lastErr = null;
    // 失败自动重试 1 次（网络抖动常见）
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        r = await fetchTO(url, opts, 15000);
        break;
      } catch (e) {
        lastErr = e;
        if (e && e.name === 'AbortError') lastErr = new Error('连接超时（15秒）');
      }
    }
    if (!r) {
      throw new Error('网络错误：' + (lastErr ? lastErr.message : '未知') + '（请检查网络；密钥请填 sb_publishable_ 开头的公钥，不是 sb_secret_ 密钥）');
    }
    if (!r.ok) {
      let txt = '';
      try { txt = (await r.text()).slice(0, 200); } catch (e) {}
      const hint = r.status === 401 ? '（密钥不对：请填 sb_publishable_ 开头的公钥，不是 sb_secret_ 密钥）' : '';
      throw new Error('HTTP ' + r.status + hint + '：' + txt);
    }
    let j = null;
    try { j = await r.json(); } catch (e) { j = null; }
    return j;
  }

  // 查询当前口令对应的记录（按 saved_at 倒序取最新一条）
  async function find(c) {
    const url = base(c) + '?key=eq.' + encodeURIComponent(c.syncKey) + '&order=saved_at.desc&limit=1&select=*';
    const j = await req(url, { method: 'GET', headers: headers(c) });
    return (Array.isArray(j) && j[0]) || null;
  }

  // 上传本地进度到云端（upsert：按 key 覆盖或新建）
  async function push() {
    const c = getCfg();
    if (!c) throw new Error('请先在设置里填写云同步信息');
    const data = Store.exportData();
    const savedAt = Date.now();
    const url = base(c) + '?on_conflict=key';
    await req(url, {
      method: 'POST',
      headers: Object.assign(headers(c), { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{ key: c.syncKey, data: data, saved_at: savedAt }])
    });
    const st = Store.getState();
    st.sync = st.sync || { cloud: null, lastSavedAt: 0 };
    st.sync.lastSavedAt = savedAt;
    Store.saveQuiet();
    return savedAt;
  }

  // 从云端下载进度（云端比本地新才应用）
  async function pull() {
    const c = getCfg();
    if (!c) throw new Error('请先在设置里填写云同步信息');
    const rec = await find(c);
    if (!rec || !rec.data) return 'empty';
    const cloudAt = Number(rec.saved_at) || 0;
    const st = Store.getState();
    const localAt = (st.sync && st.sync.lastSavedAt) || 0;
    if (localAt > 0 && cloudAt <= localAt) return 'up-to-date';
    const localCloud = Store.getCloud();
    applying = true;
    try {
      Store.importData(rec.data);
      const s2 = Store.getState();
      s2.sync = s2.sync || { cloud: null, lastSavedAt: 0 };
      s2.sync.cloud = localCloud;   // 保留本机的云设置（项目地址/密钥/口令/自动开关）
      s2.sync.lastSavedAt = cloudAt;
      Store.saveQuiet();
    } finally { applying = false; }
    return 'applied';
  }

  // 统一同步：按时间新旧自动决定 拉取/上传（云端新→下载，本地新→上传）
  async function sync() {
    const c = getCfg();
    if (!c) throw new Error('请先填写云同步信息');
    const rec = await find(c);
    const st = Store.getState();
    const localAt = (st.sync && st.sync.lastSavedAt) || 0;
    if (!rec || !rec.data) {
      // 云端还没有数据：把本地传上去（首次）
      await push();
      return 'pushed';
    }
    const cloudAt = Number(rec.saved_at) || 0;
    if (cloudAt > localAt) {
      const localCloud = Store.getCloud();
      applying = true;
      try {
        Store.importData(rec.data);
        const s2 = Store.getState();
        s2.sync = s2.sync || { cloud: null, lastSavedAt: 0 };
        s2.sync.cloud = localCloud;   // 保留本机的云设置
        s2.sync.lastSavedAt = cloudAt;
        Store.saveQuiet();
      } finally { applying = false; }
      return 'pulled';
    }
    if (cloudAt < localAt) {
      await push();
      return 'pushed';
    }
    return 'same';
  }

  async function test() {
    const c = getCfg();
    if (!c) throw new Error('请先填写项目地址 / anon 密钥 / 同步口令');
    await find(c);
    return 'ok';
  }

  // 本地保存后的自动同步（节流）
  function onLocalSave() {
    if (applying) return;
    const c = getCfg();
    if (!c || !c.auto) return;
    const st = Store.getState();
    if (!(st.sync && st.sync.lastSavedAt > 0)) return; // 还没做过首次同步，不自动传
    const now = Date.now();
    if (now - lastPushAt < 2500) return;
    lastPushAt = now;
    if (busy) return;
    busy = true;
    sync().catch(function () { /* 静默，避免打断学习 */ }).then(function () { busy = false; });
  }

  // 打开网站时自动同步
  async function onLoad() {
    const c = getCfg();
    if (!c || !c.auto) return;
    const st = Store.getState();
    if (!(st.sync && st.sync.lastSavedAt > 0)) return; // 首次使用让用户手动选择方向
    busy = true;
    try {
      const res = await sync();
      if (window.UI) {
        if (res === 'pulled') { UI.toast('已从云端同步最新进度 ☁️'); if (typeof App !== 'undefined') App.render(); }
        else if (res === 'pushed') { UI.toast('已上传进度到云端 ☁️'); }
      }
    } catch (e) {
      if (window.UI) UI.toast('自动同步失败：' + e.message, 'error');
    } finally { busy = false; }
  }

  return { push, pull, sync, test, onLocalSave, onLoad };
})();

// 挂到 window，供 store.js / app.js 通过 window.CloudSync 调用
window.CloudSync = CloudSync;
