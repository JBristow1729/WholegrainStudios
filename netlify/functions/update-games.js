const CONTENT_PATH = 'data/games.json';

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' });

  const user = context.clientContext && context.clientContext.user;
  const email = user && user.email;
  const allowedEmails = getAllowedEmails();
  if (!email || !allowedEmails.includes(email.toLowerCase())) {
    return json(403, { message: 'This account is not approved for editing.' });
  }

  const token = process.env.GITHUB_CONTENT_TOKEN;
  const repo = process.env.GITHUB_REPO || 'JBristow1729/WholegrainStudios';
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token) return json(501, { message: 'Missing GITHUB_CONTENT_TOKEN environment variable.' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { message: 'Invalid JSON payload.' });
  }

  const games = Array.isArray(payload.games) ? payload.games.map(normalizeGame) : null;
  if (!games || games.some(game => !game)) return json(400, { message: 'Invalid game data.' });

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${CONTENT_PATH}`;
  const current = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token)
  });

  if (!current.ok) return json(502, { message: 'Unable to read current content from GitHub.' });
  const currentData = await current.json();
  const content = JSON.stringify({ games }, null, 2) + '\n';

  const update = await fetch(apiUrl, {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify({
      message: 'Update game shelf content',
      content: Buffer.from(content, 'utf8').toString('base64'),
      sha: currentData.sha,
      branch
    })
  });

  if (!update.ok) {
    const details = await update.json().catch(() => ({}));
    return json(502, { message: details.message || 'Unable to write content to GitHub.' });
  }

  return json(200, { ok: true });
};

function normalizeGame(game) {
  if (!game || typeof game !== 'object') return null;
  const id = cleanString(game.id);
  const title = cleanString(game.title);
  const description = cleanString(game.description);
  const coverArt = cleanString(game.coverArt);
  if (!id || !title || !description || !coverArt) return null;

  return {
    id,
    title,
    description,
    tags: Array.isArray(game.tags) ? game.tags.map(cleanString).filter(Boolean).slice(0, 8) : [],
    coverArt,
    link: cleanString(game.link),
    platform: cleanString(game.platform) || 'Browser · Mobile',
    status: cleanString(game.status) || 'live',
    ...(game.badge ? { badge: cleanString(game.badge) } : {}),
    ...(game.progressLabel ? { progressLabel: cleanString(game.progressLabel) } : {}),
    ...(game.progressValue ? { progressValue: cleanString(game.progressValue) } : {}),
    ...(Number.isFinite(Number(game.progressPercent)) ? { progressPercent: Math.max(0, Math.min(100, Number(game.progressPercent))) } : {})
  };
}

function cleanString(value) {
  return String(value || '').trim();
}

function getAllowedEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'wholegrain-studios-admin'
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}