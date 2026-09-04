// ============================================================
// Vercel Serverless Function（CommonJS 写法，兼容性最稳）
// 词汇助手云同步：数据存 Vercel Blob（私有）。
// 同一个“同步口令”=> 同一个私有文件，不同口令互不可见
// （用口令的 SHA-256 当文件名，相当于访问令牌）。
// 需要环境变量 BLOB_READ_WRITE_TOKEN（Vercel 后台把 Blob Store 连到项目后自动注入）。
// ============================================================
const { createHash } = require('node:crypto');
const { put, head } = require('@vercel/blob');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function send(res, status, obj) {
  res.statusCode = status || 200;
  Object.keys(CORS).forEach(function (k) { res.setHeader(k, CORS[k]); });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function keyOf(pass) {
  const h = createHash('sha256').update('vocab-helper-sync:' + pass).digest('hex');
  return 'progress/' + h + '.json';
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) data += chunk;
  return data;
}

module.exports = async function handler(req, res) {
  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    Object.keys(CORS).forEach(function (k) { res.setHeader(k, CORS[k]); });
    res.end();
    return;
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return send(res, 500, { ok: false, error: '服务器缺少 BLOB_READ_WRITE_TOKEN：请在 Vercel 后台把 Blob Store 连接到项目后再试' });
  }

  const url = new URL(req.url, 'https://vocab-helper-blond.vercel.app');

  // GET /api/sync?pass=口令 -> 读取该口令对应的云端进度
  if (req.method === 'GET') {
    const pass = (url.searchParams.get('pass') || '').trim();
    if (!pass) return send(res, 400, { ok: false, error: '缺少同步口令' });
    const key = keyOf(pass);
    let meta = null;
    try { meta = await head(key, { access: 'private', token: token }); } catch (e) { meta = null; }
    if (!meta || !meta.url) return send(res, 200, { ok: true, empty: true });
    const r = await fetch(meta.url, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return send(res, 502, { ok: false, error: '读取云端数据失败 (' + r.status + ')' });
    const text = await r.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch (e) { payload = null; }
    if (!payload || payload.data == null) return send(res, 200, { ok: true, empty: true });
    return send(res, 200, { ok: true, data: payload.data, savedAt: Number(payload.savedAt) || 0 });
  }

  // POST /api/sync  body:{password, data, savedAt} -> 覆盖写入该口令的进度
  if (req.method === 'POST') {
    let body = null;
    try { body = JSON.parse((await readBody(req)) || '{}'); } catch (e) {
      return send(res, 400, { ok: false, error: '请求格式错误' });
    }
    const pass = String(body.password || '').trim();
    const data = body.data;
    if (!pass) return send(res, 400, { ok: false, error: '缺少同步口令' });
    if (!data || typeof data !== 'string') return send(res, 400, { ok: false, error: '缺少进度数据' });
    const key = keyOf(pass);
    const savedAt = Number(body.savedAt) || Date.now();
    try {
      await put(key, JSON.stringify({ savedAt: savedAt, data: data }), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        token: token
      });
    } catch (e) {
      return send(res, 500, { ok: false, error: '写入云端失败：' + ((e && e.message) || e) });
    }
    return send(res, 200, { ok: true, savedAt: savedAt });
  }

  return send(res, 405, { ok: false, error: '不支持的方法' });
};
