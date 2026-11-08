const AJAX_URL = 'https://www.snapyt.app/wp-admin/admin-ajax.php';
const SITE = 'https://www.snapyt.app/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const HDR = {
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': SITE,
  'User-Agent': UA,
};

async function getNonce() {
  const res = await fetch(AJAX_URL, { 
    method: 'POST', 
    headers: HDR, 
    body: 'action=vd_fresh_nonce' 
  });
  const j = await res.json();
  if (!j.success || !j.data?.nonce) throw new Error('Could not get nonce');
  return j.data.nonce;
}

async function submitVideo(videoUrl, nonce) {
  const body = new URLSearchParams({ action: 'process_video_url', video_url: videoUrl, security: nonce });
  const res = await fetch(AJAX_URL, { method: 'POST', headers: HDR, body });
  const j = await res.json();
  if (!j.success || !j.data?.redirect) throw new Error('Submit failed: ' + JSON.stringify(j));
  return j.data.redirect;
}

async function getPreviewHtml(previewUrl) {
  const res = await fetch(previewUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('Preview fetch failed: ' + res.status);
  return res.text();
}

function parseFormats(html) {
  const formats = [];
  const re = /<option\b[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const value = /value="(\d+)"/.exec(tag);
    if (!value) continue;
    const label = /data-label="([^"]*)"/.exec(tag);
    const size = /data-size="([^"]*)"/.exec(tag);
    const kind = /data-kind="([^"]*)"/.exec(tag);
    const force = /data-force="([^"]*)"/.exec(tag);
    formats.push({
      fmt: parseInt(value[1]),
      label: label ? label[1].replace(/[ ]/g, '').trim() : 'Format ' + value[1],
      size: size ? size[1] : '',
      kind: kind ? kind[1] : 'video+audio',
      download: force ? force[1].replace(/&#038;/g, '&').replace(/&amp;/g, '&') : null,
    });
  }
  const seen = new Set();
  return formats.filter(f => (seen.has(f.fmt) ? false : (seen.add(f.fmt), true)));
}

// Vercel Serverless Function Handler
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { url: videoUrl } = req.query;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing ?url=' });
  }

  try {
    const nonce = await getNonce();
    const previewUrl = await submitVideo(videoUrl, nonce);
    const html = await getPreviewHtml(previewUrl);
    const formats = parseFormats(html);

    return res.status(200).json({ success: true, formats });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  }
