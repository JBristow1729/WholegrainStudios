# Wholegrain Studios

PWA-ready static site split from the original single-file prototype.

## Structure

- `index.html` - document markup and content
- `css/styles.css` - extracted site styles
- `js/main.js` - theme toggle, card navigation, service worker registration
- `images/` - extracted PNG assets from the original HTML
- `manifest.json` - PWA metadata
- `sw.js` - basic app-shell service worker

## Asset Notes

The original file included baked-in Wholegrain Games wordmark images. Those have been extracted as image files. To fully rebrand the visible artwork to Wholegrain Studios, provide replacement wordmark/logo image assets and swap them into `images/wordmark.png` and `images/hero-wordmark.png`.


## Wholegrain account linking

Wholegrain Studios is the central account service. Pips, Tadoo, and Nom redirect players to `/accounts/link` with `game`, `gameAccountId`, and `returnTo` query parameters. Wholegrain handles login, then calls the app server-to-server through `/.netlify/functions/link-game-account`.

### Required Wholegrain Studios Netlify settings

Enable Netlify Identity on the Wholegrain Studios site. Use Netlify Identity email/password accounts. In Identity registration settings, choose whether players can sign up publicly now or whether signup stays invite-only while testing. Do not enable Google or other external providers unless you deliberately want them later.

For the smoothest signup flow, configure the Netlify Identity confirmation email/link to send players back to the production account-link page after verification. If Netlify sends confirmation links to the site root instead, the homepage now detects Identity callback hashes and forwards same-browser pending account links to the account-link page. The link page stores the pending `game`, `gameAccountId`, and `returnTo` payload in the browser before opening Netlify Identity, then auto-links once Identity finishes confirmation/login. If a player verifies in a different browser or device, they should return to the game and start the link flow again. Fully cross-device automatic linking would require adding a short-lived server-side pending-link store later.

Set these environment variables on the Wholegrain Studios Netlify site:

- `WHOLEGRAIN_LINK_SECRET`: a long random shared secret. This must match the value in the Pips Netlify project.
- `PIPS_LINK_ENDPOINT`: the protected Pips backend endpoint. Keep the actual value only in Netlify, not in committed docs or client-side code.
- `PIPS_RETURN_ORIGINS`: comma-separated origins that the link page may redirect back to. Keep the actual values only in Netlify if the variable is marked secret.
- `TADOO_LINK_ENDPOINT`: the protected Tadoo backend endpoint. Keep the actual value only in Netlify, not in committed docs or client-side code.
- `TADOO_RETURN_ORIGINS`: comma-separated origins that the link page may redirect back to. Keep the actual values only in Netlify if the variable is marked secret.
- `NOM_LINK_ENDPOINT`: the protected Nom backend endpoint. Keep the actual value only in Netlify, not in committed docs or client-side code.
- `NOM_RETURN_ORIGINS`: comma-separated origins that the link page may redirect back to. Keep the actual values only in Netlify if the variable is marked secret.

### Required Pips Netlify settings

Set these environment variables on the Pips Netlify site:

- `VITE_WHOLEGRAIN_ACCOUNTS_URL`: the production Wholegrain account-link page URL.
- `WHOLEGRAIN_LINK_SECRET`: the same long random shared secret used on Wholegrain Studios.

### Required Tadoo Netlify settings

Set these environment variables on the Tadoo Netlify site:

- `WHOLEGRAIN_LINK_SECRET`: the same long random shared secret used on Wholegrain Studios.
- `NETLIFY_DB_URL` or `DATABASE_URL`: the Netlify database connection string used by `/.netlify/functions/tadoo-profile`.

### Required Nom Netlify settings

Set these environment variables on the Nom Netlify site:

- `VITE_WHOLEGRAIN_ACCOUNTS_URL`: the production Wholegrain account-link page URL.
- `WHOLEGRAIN_LINK_SECRET`: the same long random shared secret used on Wholegrain Studios.
- `NETLIFY_DB_URL` or `DATABASE_URL`: the Netlify database connection string used by `/.netlify/functions/nom-profile`.

### Linked app backend contract

Each game or app owns its own profile data. Wholegrain Studios only authenticates the Wholegrain account, validates the return URL, and calls the app backend server-to-server.

The app backend endpoint should accept:

```json
{
  "identityId": "netlify-identity-user-id",
  "gameAccountId": "current-local-profile-id"
}
```

The app backend should treat the Wholegrain-linked profile as authoritative unless it deliberately asks Wholegrain to show a choice:

- If the Wholegrain account is not linked yet, link the provided local profile and return a short-lived `restoreToken`.
- If the Wholegrain account is already linked to the same app profile, return a short-lived `restoreToken`.
- If the Wholegrain account is linked to a different app profile, either resolve automatically or return a `409` choice response.

A choice response should look like:

```json
{
  "code": "LINK_CHOICE_REQUIRED",
  "requiresChoice": true,
  "existingUsername": "Jake",
  "localUsername": "Fredo",
  "conflictToken": "short-lived-conflict-token"
}
```

Wholegrain then asks the player whether to use the existing linked profile or overwrite it with the local profile, and calls the app backend again with:

```json
{
  "identityId": "netlify-identity-user-id",
  "gameAccountId": "current-local-profile-id",
  "linkChoice": "useLinked",
  "conflictToken": "short-lived-conflict-token"
}
```

or:

```json
{
  "identityId": "netlify-identity-user-id",
  "gameAccountId": "current-local-profile-id",
  "linkChoice": "useLocal",
  "conflictToken": "short-lived-conflict-token"
}
```

When `linkChoice` is `useLinked`, the app backend should keep the existing linked profile, discard/delete the unlinked local profile, and return a restore token for the existing profile. When `linkChoice` is `useLocal`, the app backend should replace the Wholegrain link with the local profile, discard/delete the previously linked profile or migrate it according to the app's rules, and return a restore token for the newly authoritative local profile.

Wholegrain appends the final `restoreToken` to the validated `returnTo` URL using the app's configured `restoreTokenParam`.

### Adding another game or app later

Do not add future apps until their backend link endpoint exists. When a new app is ready:

1. Add its entry to `ACTIVE_GAME_LINKS` in `netlify/functions/link-game-account.js` with `name`, `endpointEnv`, `returnOriginsEnv`, and `restoreTokenParam`.
2. Add matching environment variables for its endpoint and allowed return origins.
3. Optionally add its display name to `js/account-link.js`.
4. Update the app so it redirects to `/accounts/link?game=<id>&gameAccountId=<id>&returnTo=<url>`.
5. Update the app so it consumes the restore token from its configured return query parameter and replaces local/unlinked data with the authoritative profile selected by the link flow.

The browser never receives `WHOLEGRAIN_LINK_SECRET`; only the Wholegrain Netlify Function uses it.
