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
