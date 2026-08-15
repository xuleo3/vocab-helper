// ============================================================
// CloudSync：基于 Supabase 登录 + 行级安全(RLS) 的云同步
// 每人注册/登录后只能读写自己的进度；管理员(is_admin)可看全部
// ============================================================
const CloudSync = (function () {
  const URL = 'https://ftaalioocdwcqbqwadyl.supabase.co';
  const ANON = 'sb_publishable_p_9ctWLRZ-_xSrZP8Yb2Qw_Mnq70LW2';
  let sb = null;
  let lastPushAt = 0;
  let busy = false;

  function client() {
    if (!sb && window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(URL, ANON, { persistSession: true });
    }
    return sb;
  }
  function autoGet() { return localStorage.getItem('vocab_cloud_auto') === '1'; }
  function autoSet(v) { localStorage.setItem('vocab_cloud_auto', v ? '1' : '0'); }

  async function signUp(email, pw) {
    const c = client(); if (!c) throw new Error('云同步组件未加载');
    const { data, error } = await c.auth.signUp({ email: email, password: pw });
    if (error) throw new Error(translateAuth(error));
    return data;
  }
  async function signIn(email, pw) {
    const c = client(); if (!c) throw new Error('云同步组件未加载');
    const { data, error } = await c.auth.signInWithPassword({ email: email, password: pw });
    if (error) throw new Error(translateAuth(error));
    return data;
  }
  async function signOut() {
    const c = client(); if (!c) return;
    await c.auth.signOut();
  }
  async function getSession() {
    const c = client(); if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session || null;
  }
  function onAuth(cb) {
    const c = client(); if (!c) return;
    c.auth.onAuthStateChange(function (ev, session) { cb(ev, session); });
  }
  function isAdmin(session) {
    return !!(session && session.user && session.user.app_metadata && session.user.app_metadata.is_admin);
  }
  async function currentUid() {
    const s = await getSession();
    return (s && s.user) ? s.user.id : null;
  }

  function translateAuth(e) {
    const m = (e && e.message) || '登录失败';
    if (/Invalid login credentials/i.test(m)) return '邮箱或密码不对';
    if (/already registered/i.test(m)) return '这个邮箱已注册，请直接登录';
    if (/password should be at least/i.test(m)) return '密码至少 6 位';
    if (/email_address_invalid|Unable to validate email/i.test(m)) return '邮箱格式不对';
    if (/rate limit|rate_limit/i.test(m)) return '操作太频繁，请稍后再试';
    if (/Email not confirmed/i.test(m)) return '邮箱还没确认，请先去邮箱点确认链接';
    return m;
  }

  // 上传本地进度到云端（按登录用户 uid 存一行）
  async function push() {
    const uid = await currentUid();
    if (!uid) throw new Error('请先登录');
    const savedAt = Date.now();
    const { error } = await client().from('sync_data').upsert(
      { key: uid, user_id: uid, data: Store.exportData(), saved_at: savedAt },
      { onConflict: 'key' }
    );
    if (error) throw new Error(error.message);
    const st = Store.getState();
    st.sync = st.sync || { cloud: null, lastSavedAt: 0 };
    st.sync.lastSavedAt = savedAt;
    Store.saveQuiet();
    return savedAt;
  }

  // 从云端下载自己的进度
  async function pull() {
    const uid = await currentUid();
    if (!uid) throw new Error('请先登录');
    const { data, error } = await client().from('sync_data').select('data,saved_at').eq('key', uid).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || !data.data) return 'empty';
    const cloudAt = Number(data.saved_at) || 0;
    const st = Store.getState();
    const localAt = (st.sync && st.sync.lastSavedAt) || 0;
    if (localAt > 0 && cloudAt <= localAt) return 'up-to-date';
    Store.importData(data.data);
    const s2 = Store.getState();
    s2.sync = s2.sync || { cloud: null, lastSavedAt: 0 };
    s2.sync.lastSavedAt = cloudAt;
    Store.saveQuiet();
    return 'applied';
  }

  // 统一同步：按时间新旧决定上传/下载
  async function sync() {
    const uid = await currentUid();
    if (!uid) throw new Error('请先登录');
    const { data, error } = await client().from('sync_data').select('data,saved_at').eq('key', uid).maybeSingle();
    if (error) throw new Error(error.message);
    const st = Store.getState();
    const localAt = (st.sync && st.sync.lastSavedAt) || 0;
    if (!data || !data.data) { await push(); return 'pushed'; }
    const cloudAt = Number(data.saved_at) || 0;
    if (cloudAt > localAt) {
      Store.importData(data.data);
      const s2 = Store.getState();
      s2.sync = s2.sync || { cloud: null, lastSavedAt: 0 };
      s2.sync.lastSavedAt = cloudAt;
      Store.saveQuiet();
      return 'pulled';
    }
    if (cloudAt < localAt) { await push(); return 'pushed'; }
    return 'same';
  }

  // 管理员：查看所有用户的进度
  async function adminList() {
    const s = await getSession();
    if (!isAdmin(s)) throw new Error('你不是管理员');
    const { data, error } = await client().from('sync_data').select('key,data,saved_at').order('saved_at', { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return data || [];
  }

  // 本地保存后自动上传（节流 30 秒）
  function onLocalSave() {
    if (!autoGet()) return;
    const st = Store.getState();
    if (!(st.sync && st.sync.lastSavedAt > 0)) return;
    const now = Date.now();
    if (now - lastPushAt < 30000) return;
    lastPushAt = now;
    if (busy) return;
    busy = true;
    sync().catch(function () {}).then(function () { busy = false; });
  }

  // 打开网站时自动同步
  async function onLoad() {
    if (!autoGet()) return;
    const s = await getSession();
    if (!s) return;
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

  return { signUp, signIn, signOut, getSession, onAuth, isAdmin, push, pull, sync, adminList, onLocalSave, onLoad, autoGet, autoSet };
})();

window.CloudSync = CloudSync;