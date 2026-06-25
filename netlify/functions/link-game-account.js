const ACTIVE_GAME_LINKS = {
  pips: {
    name: 'Pips',
    endpointEnv: 'PIPS_LINK_ENDPOINT',
    returnOriginsEnv: 'PIPS_RETURN_ORIGINS',
    restoreTokenParam: 'pipsRestoreToken'
  },
  tadoo: {
    name: 'Tadoo',
    endpointEnv: 'TADOO_LINK_ENDPOINT',
    returnOriginsEnv: 'TADOO_RETURN_ORIGINS',
    restoreTokenParam: 'tadooRestoreToken'
  },
  nom: {
    name: 'Nom',
    endpointEnv: 'NOM_LINK_ENDPOINT',
    returnOriginsEnv: 'NOM_RETURN_ORIGINS',
    restoreTokenParam: 'nomRestoreToken'
  },
  splob: {
    name: 'Splob',
    endpointEnv: 'SPLOB_LINK_ENDPOINT',
    returnOriginsEnv: 'SPLOB_RETURN_ORIGINS',
    restoreTokenParam: 'splobRestoreToken'
  },
  stubb: {
    name: 'Stubb',
    endpointEnv: 'STUBB_LINK_ENDPOINT',
    returnOriginsEnv: 'STUBB_RETURN_ORIGINS',
    restoreTokenParam: 'stubbRestoreToken'
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
  const linkChoice = cleanString(payload.linkChoice);
  const conflictToken = cleanString(payload.conflictToken);
  const config = ACTIVE_GAME_LINKS[game];

  if (!config) return json(400, { message: 'Unknown game account type.' });
  if (!isSafeGameAccountId(gameAccountId)) return json(400, { message: 'Invalid game account ID.' });
  if (linkChoice && !isSafeLinkChoice(linkChoice)) return json(400, { message: 'Invalid account link choice.' });
  if (conflictToken && !isSafeConflictToken(conflictToken)) return json(400, { message: 'Invalid account link choice token.' });

  const endpoint = cleanString(process.env[config.endpointEnv]);
  const linkSecret = cleanString(process.env.WHOLEGRAIN_LINK_SECRET);
  const allowedOrigins = getAllowedOrigins(config.returnOriginsEnv);

  if (!endpoint) return json(501, { message: `Missing ${config.endpointEnv} environment variable.` });
  if (!isHttpUrl(endpoint)) return json(501, { message: `${config.endpointEnv} must be a full https URL.` });
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
        identityEmail: cleanString(user.email),
        gameAccountId,
        linkChoice: linkChoice || undefined,
        conflictToken: conflictToken || undefined
      })
    });
  } catch (error) {
    console.error(`Unable to contact ${config.name} link endpoint`, {
      error: error && error.message,
      endpointHost: safeHost(endpoint)
    });
    return json(502, { message: `Unable to contact ${config.name}. Check the configured link endpoint and that the game backend is deployed.` });
  }

  const upstreamBody = await upstream.json().catch(() => ({}));

  if (upstream.status === 409 && isChoiceRequired(upstreamBody)) {
    return json(409, buildChoiceRequiredResponse(config, game, upstreamBody));
  }

  if (!upstream.ok) {
    return json(502, { message: upstreamBody.message || `${config.name} rejected the account link.` });
  }

  const redirectUrl = buildGameReturnUrl(config, safeReturnTo, upstreamBody);

  return json(200, {
    ok: true,
    game,
    returnTo: redirectUrl.href
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

function buildGameReturnUrl(config, safeReturnTo, upstreamBody) {
  const redirectUrl = new URL(safeReturnTo.href);
  const restoreToken = cleanString(upstreamBody && upstreamBody.restoreToken);
  const restoreTokenParam = cleanString(config.restoreTokenParam);

  if (restoreToken && restoreTokenParam) {
    redirectUrl.searchParams.set(restoreTokenParam, restoreToken);
  }

  return redirectUrl;
}

function isChoiceRequired(upstreamBody) {
  return Boolean(upstreamBody && (upstreamBody.requiresChoice || upstreamBody.code === 'LINK_CHOICE_REQUIRED'));
}

function buildChoiceRequiredResponse(config, game, upstreamBody) {
  return {
    ok: false,
    requiresChoice: true,
    game,
    gameName: config.name,
    existingUsername: cleanString(upstreamBody.existingUsername || upstreamBody.existingProfile && upstreamBody.existingProfile.username),
    localUsername: cleanString(upstreamBody.localUsername || upstreamBody.localProfile && upstreamBody.localProfile.username),
    conflictToken: cleanString(upstreamBody.conflictToken),
    message: cleanString(upstreamBody.message) || `Choose which ${config.name} profile to keep.`
  };
}

function isSafeLinkChoice(value) {
  return ['useLinked', 'useLocal'].includes(value);
}

function isSafeConflictToken(value) {
  return /^[A-Za-z0-9_.:-]{1,512}$/.test(value);
}
function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname));
  } catch (error) {
    return false;
  }
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch (error) {
    return 'invalid-url';
  }
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
