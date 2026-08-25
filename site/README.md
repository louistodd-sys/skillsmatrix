# Skills Matrix App — marketing site

The public front page for Skills Matrix App. It is a **static site with no build
step**: HTML, one stylesheet, one small progressive-enhancement script, and a
handful of assets. Every word of content is in the HTML, so it is fully
crawlable and readable with JavaScript disabled.

It is deliberately **separate from the React application** in `src/`. That app is
behind Base44 authentication and renders client-side, which makes it a poor
surface for search engines and social crawlers. This directory is what search
engines, link previews and first-time visitors see.

```
site/
├── index.html            the front page
├── 404.html              not-found page (noindex)
├── robots.txt            crawl rules + sitemap pointer
├── sitemap.xml           one URL; add entries as pages are added
├── site.webmanifest      PWA/browser metadata
├── vercel.json           headers, caching, clean URLs (Vercel)
├── netlify.toml          the same for Netlify / Cloudflare Pages
└── assets/
    ├── styles.css        design tokens mirrored from src/index.css
    ├── main.js           mobile nav, pricing toggle, sticky header, reveal
    ├── favicon.svg       matches the app's favicon
    ├── apple-touch-icon.png
    └── og-image.png      1200×630 social preview
```

---

## Before you deploy — three edits

1. **`SITE_URL`** — every canonical, `og:url`, sitemap and robots entry uses
   `https://skillsmatrixapp.com`. If the marketing site lives anywhere else,
   find-and-replace that string across `site/`.

2. **`APP_URL`** — every call to action points at `https://app.skillsmatrixapp.com`.
   The Base44 application currently answers on `https://skillsmatrixapp.com`
   (see the URLs in `base44/functions/*/entry.ts`), so **you must decide one of**:

   - **Recommended** — move the app to `app.skillsmatrixapp.com`, publish this
     site on the apex/`www`, and update the hard-coded URLs in
     `base44/functions/stripeWebhook`, `stripePortal`, `checkTrialEnding` and
     `sendWelcomeEmail` to match. Best for SEO: the marketing page owns the root.
   - **Alternative** — leave the app on the apex and publish this site on a
     different host, then find-and-replace `https://app.skillsmatrixapp.com`
     with `https://skillsmatrixapp.com` throughout `site/`.

   Both are single find-and-replace operations. Nothing else in the site depends
   on the split.

3. **Statutory footer details** — the footer ships with `Conryx Ltd` and no
   company number, ICO registration or registered office (search `STATUTORY` in
   `index.html`). A UK compliance product with blank statutory details
   undermines the trust the rest of the page builds. The same gap exists in
   `src/components/SiteFooter.jsx`; fill both.

---

## Deploying

Nothing to build. Publish the `site/` directory as-is.

**Vercel**

```bash
cd site
npx vercel --prod          # or point a Vercel project at this directory
```
Project settings: framework preset **Other**, build command **empty**, output
directory `.`. `vercel.json` supplies the security headers, immutable caching for
`/assets/*` and a revalidated `index.html`.

**Netlify / Cloudflare Pages**

Publish directory `site`, build command empty. `netlify.toml` carries the same
headers and cache rules.

**Any static host (S3, nginx, GitHub Pages)**

Copy the contents of `site/` to the web root. Reproduce the headers from
`vercel.json` if your host supports them; the site works without them, but the
CSP and HSTS entries are worth keeping.

### After the first deploy

- Submit `https://<your-domain>/sitemap.xml` in Google Search Console and Bing
  Webmaster Tools.
- Check the social preview with the Facebook Sharing Debugger and
  `https://cards-dev.twitter.com/validator` — both should show `og-image.png`.
- Run Lighthouse. The page has no third-party JavaScript and one external
  stylesheet (Google Fonts, loaded non-blocking), so it should score high without
  further work.

---

## SEO features already in place

| Feature | Where |
|---|---|
| Unique title (~70 chars) and meta description (~155 chars) | `<head>` |
| Canonical URL, `robots` directives with large image previews | `<head>` |
| Open Graph + Twitter summary-large-image cards, with a real 1200×630 PNG | `<head>`, `assets/og-image.png` |
| JSON-LD: `Organization`, `WebSite`, `SoftwareApplication` with all five `Offer`s, and `FAQPage` | `<head>` |
| Semantic landmarks, one `<h1>`, ordered `<h2>`/`<h3>` | throughout |
| Skip link, focus-visible outlines, labelled nav and controls, alt/aria text on every graphic | throughout |
| `robots.txt` + `sitemap.xml` | root |
| Fonts preconnected and loaded non-blocking with a `<noscript>` fallback | `<head>` |
| No render-blocking JS; content readable with JS off | `assets/main.js` |
| Responsive from 320px up; wide content scrolls inside its own container | `assets/styles.css` |

The FAQ JSON-LD mirrors the visible `<details>` content word for word — keep them
in step if you edit either, or the structured data becomes invalid.

---

## Keeping the content honest

Every claim on the page was checked against the code before it was written. Two
rules to keep it that way:

1. **Prices** live in `src/lib/tierConfig.js` (`TIER_PRICING`, `TIER_LIMITS`,
   `BRC_PRICING`). They are duplicated in three places here — the plan cards, the
   `PRICING` object in `assets/main.js`, and the `offers` array in the JSON-LD.
   Change all three together.

2. **Features.** The page deliberately does *not* mention PDF report generation,
   an employee self-assessment portal, site/department-level views, an advanced
   analytics dashboard, an API, SSO or offline use — none of those exist in the
   product today. `docs/competitor-pain-point-audit.md` §6.4 explains why
   advertising absent features is the single most damaging thing this product
   could do. Add a claim here only after the feature ships.

   Similarly, only four standards are named as available — BRCGS Packaging
   Materials, ISO 9001, ISO 14001 and ISO 45001 — because those are the only ones
   with a clause library in `base44/functions/seedBrcClauses`. The remaining
   BRCGS standards are marked "in progress" both in the standards list and in the
   FAQ. Promote one only when `available: true` in `src/lib/standardsRegistry.js`.

---

## Local preview

```bash
cd site
python3 -m http.server 8080
# open http://127.0.0.1:8080
```

Root-relative asset paths (`/assets/…`) mean the site must be served from a web
root — opening `index.html` straight off disk will not load the stylesheet.
