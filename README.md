# Good Pressure: pressure washing website

A one-page static site for **Good Pressure**, a pressure washing and soft washing business ("The good kind of pressure.").

The centrepiece is the hero. The page opens on a filthy concrete driveway with the headline pressure-washed into the grime (reverse graffiti). As you scroll, a spray nozzle cleans it row by row, leaving a wet sheen and flying droplets, until it's spotless. Every service card cleans itself as it scrolls into view: pebblecrete, terracotta roof, brick, merbau deck, solar panels and pavers. All of those surfaces are drawn procedurally with WebGL, so there are no images to load or license.

No build step and no dependencies. Plain HTML, CSS and JS, so it can be hosted anywhere for free.

## Live preview

**https://smuffinz99-prog.github.io/goodpressure/** is GitHub Pages from this repo's `main` branch. Every push to `main` redeploys it in about a minute.

Because the preview is public before the real details are in, it has three preview-only settings. Undo them at launch:

1. **Hidden from Google.** `index.html` and `privacy.html` each have a `<meta name="robots" content="noindex">` line marked `PREVIEW ONLY`. Delete both lines when you go live on your own domain, or the site won't show up in search.
2. **Reviews hidden.** The sample reviews section has a `hidden` attribute, and its two `Reviews` links are commented out. When you have real reviews, put them in, remove `hidden` and un-comment the links. Section numbers update by themselves.
3. **Phone `0491 570 156`.** This is a number the ACMA reserves for fiction, so nobody real gets calls from the preview. Swap in yours (see below).

## What's in here

| File | What it is |
| --- | --- |
| `index.html` | The whole site: hero, services, method/PSI gauge, before & after, process, instant estimate, reviews, service area, FAQ, quote form, footer |
| `assets/css/styles.css` | All styles. Brand colours are the variables at the top (`--ink`, `--aqua` ...) |
| `assets/js/surface-engine.js` | WebGL engine that draws the dirty and clean surfaces and the cleaning sweep |
| `assets/js/app.js` | Page behaviour. **`CONFIG` at the top holds the form delivery setting and the estimator prices** |
| `assets/img/` | Logo SVGs and PNGs, favicons, app icons, social share image |
| `brand.html` | Brand sheet: logo versions, colours, type and voice (not linked from the site) |
| `og.html` + `tools/make-assets.js` | Re-render the PNG logos, icons and social image after any brand change: `node tools/make-assets.js` |
| `privacy.html`, `404.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest` | The usual supporting files |
| `serve.js` | Tiny local preview server: `node serve.js` then open http://localhost:8013 |

## Before you go live: replace the placeholders

Search the project for each of these and swap in the real details:

- [ ] **Phone**: `0491 570 156` and `+61491570156` (`tel:` links, the structured data, and `CONFIG.phoneDisplay` in `app.js`)
- [ ] **Email**: `hello@goodpressure.com.au` (also `CONFIG.email` in `app.js`)
- [ ] **ABN**: `ABN 00 000 000 000` in the footer
- [ ] **City and suburbs**: the site says **Brisbane**. Change it in the hero eyebrow, `<title>`, meta description, structured data, the service-area section, the FAQ ("Brisbane's humidity") and the footer. Swap in your real suburb list.
- [ ] **Prices**: card "From $..." prices in `index.html` and the estimator prices in `CONFIG.services` (`app.js`). These are realistic starting points for AU, not quotes.
- [ ] **Reviews**: the three reviews are **samples** and are hidden on the preview. Replace them with real ones, with the customer's OK, then unhide the section. Publishing invented reviews is misleading conduct under the Australian Consumer Law, and the ACCC does act on it.
- [ ] **Search visibility**: delete the two `PREVIEW ONLY` noindex lines (see Live preview above).
- [ ] **Insurance and guarantee**: the site says "fully insured" and promises free re-cleans within 7 days. Only keep those if they're true for you.
- [ ] **Socials**: the Instagram, Facebook and TikTok links in the footer are `#`.
- [ ] **Quote form**: see below. Without it the form falls back to opening the visitor's email app.
- [ ] **Analytics**: the GoatCounter snippet points at `smuffinz.goatcounter.com`. Keep it, swap it for your own, or delete it.

### Make the quote form send to you

1. Go to https://web3forms.com, enter the email address that should receive quotes, and copy the access key.
2. Paste it into `CONFIG.web3formsKey` in `assets/js/app.js`.

Formspree works too: put the form URL in `CONFIG.formEndpoint`.

### Add real before & after photos

The before & after slider uses rendered surfaces until you have job photos. For any tab, add the two photos to `assets/img/jobs/` and put them on the tab button:

```html
<button role="tab" ... data-surface="concrete"
        data-before="assets/img/jobs/driveway-before.jpg"
        data-after="assets/img/jobs/driveway-after.jpg">Driveway</button>
```

Take both shots from the same spot, same angle, landscape. Real photos of your own work are the most persuasive thing you can put on this page.

## Domain

On 17 Nov 2026 the .au registry showed **goodpressure.com.au** and **goodpressure.au** as unregistered (`goodpressure.com` is taken).

- `.com.au` needs an ABN or a registered business name that matches or relates to the domain. Register "Good Pressure" as a business name with ASIC first, or alongside.
- Register through any auDA-accredited registrar, for example VentraIP, Crazy Domains or GoDaddy AU. Expect roughly $20 to $40 a year.
- It's worth grabbing `goodpressure.au` as well and forwarding it to the main domain.

## Hosting (free): connecting your domain

This repo already deploys to GitHub Pages. Once you own the domain:

1. In the repo, go to Settings → Pages → Custom domain, enter `goodpressure.com.au` and save. GitHub commits a `CNAME` file. Tick **Enforce HTTPS** once it's offered (it can take up to an hour).
2. At your registrar, add these DNS records:
   - four `A` records for `@`, pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`
   - a `CNAME` for `www`, pointing to `smuffinz99-prog.github.io`
3. The old `github.io/goodpressure` address redirects to your domain automatically, so links you've already shared keep working.

**Cloudflare Pages or Netlify** also work: drag and drop the folder, then add the custom domain in their dashboard.

## After launch

1. **Google Business Profile.** For a local trade business this matters more than the website. Set it up, add photos and ask every happy customer for a review.
2. **Google Search Console.** Add the domain and submit `sitemap.xml`.
3. Get a business email on your domain (Google Workspace or Zoho Mail).

## Tweaking the effects

- **Hero scroll length**: `--hero-run` in `styles.css` (default `290vh` of scrolling).
- **Number of cleaning passes, surface scale and wetness**: `SETTINGS` near the bottom of `surface-engine.js`.
- **Surface look** (dirt colours, lichen, leaves, oil stains): the GLSL blocks under `MATERIALS` in `surface-engine.js`.
- **Accessibility**: visitors who prefer reduced motion get a static hero, and devices without WebGL get a CSS fallback.
- **Preview helpers**: add `?y=1200` (pixel offset) or `?to=pricing` (section id) to the URL to jump straight to a scroll position.
