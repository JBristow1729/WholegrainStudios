exports.handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  const email = user && user.email;
  const allowedEmails = getAllowedEmails();

  return json(200, {
    authenticated: Boolean(email),
    canEdit: Boolean(email && allowedEmails.includes(email.toLowerCase())),
    email: email || null
  });
};

function getAllowedEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}