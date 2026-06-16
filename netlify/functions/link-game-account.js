const ACTIVE_GAME_LINKS = {
  pips: {
    name: 'Pips',
    endpointEnv: 'PIPS_LINK_ENDPOINT',
    returnOriginsEnv: 'PIPS_RETURN_ORIGINS'
  }
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'Method not allowed.' });

  const user = context.clientContext && context.clientContext.user;
  const identityId = user && (user.sub || user.id);
  if (!identityId) return json(401, { message: 'Sign in before linking your account.' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return json(400, { message: 'Invalid account link request.' });
  }

  const game = cleanString(payload.game).toLowerCase();
  const gameAccountId = cleanString(payload.gameAccountId);
  const returnTo = cleanString(payload.returnTo);
  const config = ACTIVE_GAME_LINKS[game];

  if (!config) return json(400, { message: 'Unknown game account type.' });
  if (!isSafeGameAccountId(gameAccountId)) return json(400, { message: 'Invalid game account ID.' });

  const endpoint = cleanString(process.env[config.endpointEnv]);
  const linkSecret = cleanString(process.env.WHOLEGRAIN_LINK_SECRET);
  const allowedOrigins = getAllowedOrigins(config.returnOriginsEnv);

  if (!endpoint) return json(501, { message: `Missing ${config.endpointEnv} environment variable.` });
  if (!linkSecret) return json(501, { message: 'Missing WHOLEGRAIN_LINK_SECRET environment variable.' });

  const safeReturnTo = validateReturnTo(returnTo, allowedOrigins);
  if (!safeReturnTo) return json(400, { message: 'Unsafe or unapproved return URL.' });

  let upstream;
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wholegrain-link-secret': linkSecret
      },
      body: JSON.stringify({
        identityId,
        gameAccountId
      })
    });
  } catch (error) {
    return json(502, { message: `Unable to contact ${config.name}.` });
  }

  if (!upstream.ok) {
    const details = await upstream.json().catch(() => ({}));
    return json(502, { message: details.message || `${config.name} rejected the account link.` });
  }

  return json(200, {
    ok: true,
    game,
    returnTo: safeReturnTo.href
  });
};

function getAllowedOrigins(envName) {
  return String(process.env[envName] || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function validateReturnTo(returnTo, allowedOrigins) {
  if (!allowedOrigins.length) return null;
  let parsed;
  try {
    parsed = new URL(returnTo);
  } catch (error) {
    return null;
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) return null;
  if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) return null;
  return allowedOrigins.includes(parsed.origin) ? parsed : null;
}

function isSafeGameAccountId(value) {
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
}

function cleanString(value) {
  return String(value || '').trim();
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}