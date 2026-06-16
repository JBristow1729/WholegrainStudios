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

The public site has no login button. Visit `/admin.html` directly and sign in with the approved Netlify Identity account. The homepage will show admin controls only when Netlify confirms the logged-in email is allowed.

Required Netlify environment variables:

- `ADMIN_EMAILS`: comma-separated approved email addresses, for example `jake@example.com`.
- `GITHUB_CONTENT_TOKEN`: a GitHub token with contents read/write access to this repository.
- `GITHUB_REPO`: optional, defaults to `JBristow1729/WholegrainStudios`.
- `GITHUB_BRANCH`: optional, defaults to `main`.

Game content lives in `data/games.json`. Admin saves commit updates to that file through the Netlify Function, which triggers a normal Netlify redeploy.
