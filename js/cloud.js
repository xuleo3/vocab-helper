// ============================================================
// CloudSync：单用户 + Vercel Blob 云同步
// 手机/电脑填同一个“同步口令”即可互通（口令只保存在本机浏览器里）。
// 后端接口：/api/sync（Vercel Serverless Function，数据存 Vercel Blob）
// ============================================================
const CloudSync = (function () {
  // 电脑(github.io/本地)、手机、Vercel 域名都调用这个绝对地址
  const API = 'https://vocab-helper-blond.vercel.app/api/sync';
  const LS_PASS = 'vocab_sync_pass';
  const LS_AUTO = 'vocab_cloud_auto';
  let lastPushAt = 0;
  let busy = false;

  function passGet() { try { return localStorage.getItem(LS_PASS) || ''; } catch (e) { return ''; } }
  function passSet(v) { try { localStorage.setItem(LS_PASS, String(v || '').trim()); } catch (e) {} }
  function autoGet() { return localStorage.getItem(LS_AUTO) === '1'; }
  function autoSet(v) { localStorage.setItem(LS_AUTO, v ? '1' : '0'); }

  async function apiGet(pass) {
    const res = await fetch(API + '?pass=' + encodeURIComponent(pass), { method: 'GET' });
    return parseRes(res);
  }
  async function apiPost(pass, data, savedAt) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass, data: data, savedAt: savedAt })
    });
    return parseRes(res);
  }
  async function parseRes(res) {
    let j = null;
    try { j = await res.json(); } catch (e) { j = null; }
    if (!res.ok) throw new Error((j && j.error) || ('云同步服务出错(' + res.status + ')'));
    return j || {};
  }

  function localSavedAt() {
    const st = Store.getState();
    return (st.sync && st.sync.lastSavedAt) || 0;
  }
  function setLocalSavedAt(t) {
    const st = Store.getState();
    st.sync = st.sync || { cloud: null, lastSavedAt: 0 };
    st.sync.lastSavedAt = t;
    Store.saveQuiet();
  }

  // 上传本地进度到云端（只传学习进度，不传词库，体积小）
  async function push() {
    const pass = passGet();
    if (!pass) throw new Error('请先在「设置」里填写同步口令');
    const savedAt = Date.now();
    await apiPost(pass, Store.exportSyncData(), savedAt);
    setLocalSavedAt(savedAt);
    return savedAt;
  }

  // 从云端下载进度到本机
  async function pull() {
    const pass = passGet();
    if (!pass) throw new Error('请先在「设置」里填写同步口令');
    const j = await apiGet(pass);
    if (!j || j.empty || !j.data) return 'empty';
    const cloudAt = Number(j.savedAt) || 0;
    const localAt = localSavedAt();
    if (localAt > 0 && cloudAt <= localAt) return 'up-to-date';
    Store.importSyncData(j.data);
    setLocalSavedAt(cloudAt);
    return 'applied';
  }

  // 统一同步：比较云端与本机的新旧，谁新用谁
  async function sync() {
    const pass = passGet();
    if (!pass) throw new Error('请先在「设置」里填写同步口令');
    const j = await apiGet(pass);
    const localAt = localSavedAt();
    if (!j || j.empty || !j.data) { await push(); return 'pushed'; }
    const cloudAt = Number(j.savedAt) || 0;
    if (cloudAt > localAt) {
      Store.importSyncData(j.data);
      setLocalSavedAt(cloudAt);
      return 'pulled';
    }
    if (cloudAt < localAt) { await push(); return 'pushed'; }
    return 'same';
  }

  // 本地保存后自动上传（节流 30 秒）；只有“同步过”才自动上传，避免误覆盖云端
  function onLocalSave() {
    if (!autoGet()) return;
    if (!passGet()) return;
    if (!(localSavedAt() > 0)) return;
    const now = Date.now();
    if (now - lastPushAt < 30000) return;
    lastPushAt = now;
    if (busy) return;
    busy = true;
    sync().catch(function () {}).then(function () { busy = false; });
  }

  // 打开网站时自动同步（首次请先手动「下载进度」一次）
  async function onLoad() {
    if (!autoGet()) return;
    if (!passGet()) return;
    const st = Store.getState();
    if (!(st.sync && st.sync.lastSavedAt > 0)) return;
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

  return { push, pull, sync, onLocalSave, onLoad, autoGet, autoSet, passGet, passSet };
})();

window.CloudSync = CloudSync;
