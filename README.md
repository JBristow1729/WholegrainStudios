# Wholegrain Studios

PWA-ready static site split from the original single-file prototype.

## Structure

- `index.html` - document markup and content
- `css/styles.css` - extracted site styles
- `js/main.js` - theme toggle, game icon loading, progress animation, service worker registration
- `images/` - extracted PNG assets from the original HTML
- `manifest.json` - PWA metadata
- `sw.js` - basic app-shell service worker

## Asset Notes

The original file included baked-in Wholegrain Games wordmark images. Those have been extracted as image files. To fully rebrand the visible artwork to Wholegrain Studios, provide replacement wordmark/logo image assets and swap them into `images/wordmark.png` and `images/hero-wordmark.png`.

## Admin editing

The public site has no login button. Visit `/admin.html` directly and sign in with a Netlify Identity email/password account. The homepage will show admin controls only when the logged-in email is listed in `ADMIN_EMAILS`.

Required Netlify environment variables:

- `ADMIN_EMAILS`: comma-separated admin email addresses, for example `jake@example.com`. These accounts must exist in Netlify Identity. Player accounts do not need to be listed here.
- `GITHUB_CONTENT_TOKEN`: a GitHub token with contents read/write access to this repository.
- `GITHUB_REPO`: optional, defaults to `JBristow1729/WholegrainStudios`.
- `GITHUB_BRANCH`: optional, defaults to `main`.

Game content lives in `data/games.json`. Admin saves commit updates to that file through the Netlify Function, which triggers a normal Netlify redeploy.

## Wholegrain account linking

Wholegrain Studios is the central account service. Pips redirects players to `/accounts/link` with `game`, `gameAccountId`, and `returnTo` query parameters. Wholegrain handles login, then calls Pips server-to-server through `/.netlify/functions/link-game-account`.

### Required Wholegrain Studios Netlify settings

Enable Netlify Identity on the Wholegrain Studios site. Use Netlify Identity email/password accounts. In Identity registration settings, choose whether players can sign up publicly now or whether signup stays invite-only while testing. Do not enable Google or other external providers unless you deliberately want them later.

Set these environment variables on the Wholegrain Studios Netlify site:

- `WHOLEGRAIN_LINK_SECRET`: a long random shared secret. This must match the value in the Pips Netlify project.
- `PIPS_LINK_ENDPOINT`: the protected Pips backend endpoint, for example `https://pips.wholegrainstudios.com/.netlify/functions/pips-profile?action=link-wholegrain-account`.
- `PIPS_RETURN_ORIGINS`: comma-separated origins that the link page may redirect back to, for example `https://pips.wholegrainstudios.com,https://tavern-dice.netlify.app`.

### Required Pips Netlify settings

Set these environment variables on the Pips Netlify site:

- `VITE_WHOLEGRAIN_ACCOUNTS_URL`: `https://wholegrainstudios.co.uk/accounts/link`
- `WHOLEGRAIN_LINK_SECRET`: the same long random shared secret used on Wholegrain Studios.

### Adding another game later

Do not add future games until their backend link endpoint exists. When a new game is ready:

1. Add its entry to `ACTIVE_GAME_LINKS` in `netlify/functions/link-game-account.js`.
2. Add matching environment variables for its endpoint and allowed return origins.
3. Optionally add its display name to `js/account-link.js`.
4. Update the game app so it redirects to `/accounts/link?game=<id>&gameAccountId=<id>&returnTo=<url>`.

The browser never receives `WHOLEGRAIN_LINK_SECRET`; only the Wholegrain Netlify Function uses it.
