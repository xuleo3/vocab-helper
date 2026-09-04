// ============================================================
// Vercel Serverless Function：词汇助手云同步
// 数据存到 Vercel Blob（私有）。同一个“同步口令”=> 同一个私有文件，
// 不同口令互不可见（用口令的 SHA-256 当文件名，相当于访问令牌）。
// 需要环境变量 BLOB_READ_WRITE_TOKEN（Vercel 后台把 Blob Store 连到项目后自动注入）。
// ============================================================
import { createHash } from 'node:crypto';
import { put, head } from '@vercel/blob';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
  });
}

function keyOf(pass) {
  const h = createHash('sha256').update('vocab-helper-sync:' + pass).digest('hex');
  return 'progress/' + h + '.json';
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return json({ ok: false, error: '服务器缺少 BLOB_READ_WRITE_TOKEN：请在 Vercel 后台把 Blob Store 连接到项目后再试' }, 500);
  }

  const url = new URL(req.url);

  // GET /api/sync?pass=口令  -> 读取该口令对应的云端进度
  if (req.method === 'GET') {
    const pass = (url.searchParams.get('pass') || '').trim();
    if (!pass) return json({ ok: false, error: '缺少同步口令' }, 400);
    const key = keyOf(pass);
    let meta = null;
    try {
      meta = await head(key, { access: 'private', token });
    } catch (e) {
      meta = null;
    }
    if (!meta || !meta.url) return json({ ok: true, empty: true });
    const res = await fetch(meta.url, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return json({ ok: false, error: '读取云端数据失败 (' + res.status + ')' }, 502);
    const text = await res.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch (e) { payload = null; }
    if (!payload || payload.data == null) return json({ ok: true, empty: true });
    return json({ ok: true, data: payload.data, savedAt: Number(payload.savedAt) || 0 });
  }

  // POST /api/sync  body:{password, data, savedAt} -> 覆盖写入该口令的进度
  if (req.method === 'POST') {
    let body = null;
    try { body = await req.json(); } catch (e) { return json({ ok: false, error: '请求格式错误' }, 400); }
    const pass = String(body.password || '').trim();
    const data = body.data;
    if (!pass) return json({ ok: false, error: '缺少同步口令' }, 400);
    if (!data || typeof data !== 'string') return json({ ok: false, error: '缺少进度数据' }, 400);
    const key = keyOf(pass);
    const savedAt = Number(body.savedAt) || Date.now();
    await put(key, JSON.stringify({ savedAt: savedAt, data: data }), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: token
    });
    return json({ ok: true, savedAt: savedAt });
  }

  return json({ ok: false, error: '不支持的方法' }, 405);
}
