# FreshStart Pressure Washing: pressure washing website

A one-page static site for **FreshStart Pressure Washing**, a pressure washing and soft washing business ("A fresh start for every surface.").

The centrepiece is the hero: a real photo of a filthy concrete driveway in front of a garage. As you scroll, a pressure-washer pass cleans it strip by strip, with a wet sheen, foam and flying droplets, until it's spotless. The service cards show plain clean photos, and the before & after slider uses the before/after pairs (driveway, brick wall, deck, pavers).

> **The photos are placeholders.** They're free stock photos (credits in [CREDITS.md](CREDITS.md)), and the "before" versions have dirt added digitally. Swap in real photos of your own jobs before launch. It's one command per surface, see [Add your own photos](#add-your-own-photos).

No build step and no dependencies. Plain HTML, CSS and JS, so it can be hosted anywhere for free.

**Built for phones:** about 300 KB loads before the hero is ready (images are WebP, sized per device). Everything below the hero loads as you scroll. The hero drops its render resolution automatically on slow phones, and visitors without WebGL or with reduced motion get still photos.

## Live preview

**https://smuffinz99-prog.github.io/freshstart/** is GitHub Pages from this repo's `main` branch. Every push to `main` redeploys it in about a minute.

Because the preview is public before the real details are in, it has three preview-only settings. Undo them at launch:

1. **Hidden from Google.** `index.html` and `privacy.html` each have a `<meta name="robots" content="noindex">` line marked `PREVIEW ONLY`. Delete both lines when you go live on your own domain, or the site won't show up in search.
2. **Reviews hidden.** The sample reviews section has a `hidden` attribute, and its two `Reviews` links are commented out. When you have real reviews, put them in, remove `hidden` and un-comment the links. Section numbers update by themselves.
3. **No phone number.** The site is email-only at the owner's request.

## What's in here

| File | What it is |
| --- | --- |
| `index.html` | The whole site: hero, about, quote form, services, before & after, reviews (hidden), FAQ, footer |
| `assets/css/styles.css` | All styles. Brand colours are the variables at the top (`--ink`, `--aqua` ...) |
| `assets/js/surface-engine.js` | WebGL engine for the hero: reveals the clean photo over the dirty one with the pressure-washer pass |
| `assets/js/app.js` | Page behaviour. **`CONFIG` at the top holds the form delivery setting; `PHOTOS` holds the photo setup** |
| `assets/img/photos/` | The before/after photo pairs (WebP): `<slot>-<before\|after>-<720\|1280>.webp`, plus the hero's desktop and mobile versions |
| `tools/photos.js` | Converts your own before/after photos into those files: `node tools/photos.js deck before.jpg after.jpg` |
| `assets/img/` | Logo SVGs and PNGs, favicons, app icons, social share image |
| `assets/fonts/` | Archivo and JetBrains Mono, self-hosted so the page doesn't wait on Google's servers (open font licence included) |
| `CREDITS.md` | Who took the placeholder photos |
| `brand.html` | Brand sheet: logo versions, colours, type and voice (not linked from the site) |
| `og.html` + `tools/make-assets.js` | Re-render the PNG logos, icons and social image after any brand change: `node tools/make-assets.js` |
| `privacy.html`, `404.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest` | The usual supporting files |
| `serve.js` | Tiny local preview server: `node serve.js` then open http://localhost:8013 |

## Before you go live: replace the placeholders

Search the project for each of these and swap in the real details:

- [x] **Phone**: removed at the owner's request (22 Nov 2026). Contact is email only.
- [ ] **Email**: `freshstartpressurewashing11@gmail.com` (also `CONFIG.email` in `app.js`)

- [x] **Hero stats**: 500+ jobs, 100% satisfaction, 10+ years (confirmed true by the owner 22 Nov 2026). Update the numbers as they grow (index.html, search for hero__stats).
- [ ] **ABN**: `ABN 00 000 000 000` in the footer
- [ ] **City and suburbs**: the site says **Brisbane**. Change it in the hero eyebrow, `<title>`, meta description, structured data, the FAQ ("Brisbane's humidity") and the footer.
- [ ] **Photos**: every before/after pair is a stock photo with digitally added dirt. Replace them with your own jobs (see below). Showing stock photos as your own results would be misleading.
- [ ] **Reviews**: the three reviews are **samples** and are hidden on the preview. Replace them with real ones, with the customer's OK, then unhide the section. Publishing invented reviews is misleading conduct under the Australian Consumer Law, and the ACCC does act on it.
- [ ] **Search visibility**: delete the two `PREVIEW ONLY` noindex lines (see Live preview above).
- [ ] **Insurance and guarantee**: the site says "fully insured" and promises free re-cleans within 7 days. Only keep those if they're true for you.
- [ ] **Socials**: the Instagram, Facebook and TikTok links in the footer are `#`.
- [ ] **Quote form**: wired to FormSubmit, but click the activation email after the first request (see below).
- [ ] **Analytics**: the GoatCounter snippet points at `smuffinz.goatcounter.com`. Keep it, swap it for your own, or delete it.

### Quote emails via your Gmail (recommended)

FormSubmit (the backup below) reported quotes as sent but they never reached the inbox in testing, so the
reliable route is a tiny free Google script that makes **your own Gmail send each quote to itself**, photos attached.
The code is in `tools/quote-mailer.gs`.

1. Signed in as **freshstartpressurewashing11@gmail.com**, open https://script.google.com and click **New project**.
2. Delete the sample code, paste the whole of `tools/quote-mailer.gs`, and click **Save** (name it "FreshStart quotes").
3. Click **Deploy > New deployment**, pick **Web app** (gear icon), set **Execute as: Me** and **Who has access: Anyone**, click **Deploy**.
4. Click **Authorize access**, choose the account, then **Advanced > Go to FreshStart quotes (unsafe)** and **Allow**. ("Unsafe" only means Google hasn't reviewed your own private script.)
5. Copy the **Web app URL** (ends in `/exec`) into `CONFIG.quoteScriptUrl` in `assets/js/app.js`.

If the script ever fails, the form automatically falls back to FormSubmit so the request isn't lost.

### Backup: FormSubmit

The form posts to [FormSubmit](https://formsubmit.co) (free, no account) and every request, with up to 6 customer photos attached, is emailed to `freshstartpressurewashing11@gmail.com`. Photos are shrunk in the browser to about 150 KB each, so they always fit under FormSubmit's 10 MB limit.

1. **Activate it once.** The very first quote request sends an activation email to that inbox. Open it and click the confirm link. Until then, nothing is delivered.
2. **Hide the address (optional, recommended).** After activating, FormSubmit emails a random string. Put it in place of the email address in the form's `action` in `index.html` (`https://formsubmit.co/<string>`) and in `CONFIG.quoteTo` in `app.js`, so spam bots can't read the address from the page.
3. To change who receives quotes, change the address in both of those places and activate again.

After sending, customers land back on the site with a "Request sent" message.

### Add your own photos

Real before/after photos of your own work are the most persuasive thing on this page, and the cleaning effect works with any pair.

1. **Shoot the pair.** Before you start, take a photo. When you're done, stand in exactly the same spot and take the same shot again. Landscape works best for everything except the hero. Clean the lens, and shoot in shade or overcast light if you can so the two shots match.
2. **Convert them** (needs Node and Edge or Chrome, both already on this PC):
   ```
   node tools/photos.js driveway before.jpg after.jpg
   ```
   Slots: `driveway`, `brick`, `deck`, `pavers` (the service cards and slider tabs) and `hero`. Each run writes the WebP files into `assets/img/photos/` under the names the site already uses. Nothing else to change.
3. **Hero only:** the tool prints a small change to make in `PHOTOS.hero` in `app.js`: switch the strips from "follow the driveway joints" to "run straight across".

If you want the slider to show a different photo pair to its card, put the files anywhere and add `data-before="..." data-after="..."` to that tab button in `index.html`.

## Domain

Check **freshstartpressurewashing.com.au** (and the shorter **freshstartpressure.com.au**) at a registrar such as VentraIP or Crazy Domains before you print anything. The site currently uses `freshstartpressurewashing.com.au` as a placeholder.

- `.com.au` needs an ABN or a registered business name that matches or relates to the domain. Register "FreshStart Pressure Washing" as a business name with ASIC first, or alongside.
- Register through any auDA-accredited registrar, for example VentraIP, Crazy Domains or GoDaddy AU. Expect roughly $20 to $40 a year.
- It's worth grabbing `freshstartpressurewashing.au` as well and forwarding it to the main domain.

## Hosting (free): connecting your domain

This repo already deploys to GitHub Pages. Once you own the domain:

1. In the repo, go to Settings → Pages → Custom domain, enter `freshstartpressurewashing.com.au` and save. GitHub commits a `CNAME` file. Tick **Enforce HTTPS** once it's offered (it can take up to an hour).
2. At your registrar, add these DNS records:
   - four `A` records for `@`, pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`
   - a `CNAME` for `www`, pointing to `smuffinz99-prog.github.io`
3. The old `github.io/freshstart` address redirects to your domain automatically, so links you've already shared keep working.

**Cloudflare Pages or Netlify** also work: drag and drop the folder, then add the custom domain in their dashboard.

## After launch

1. **Google Business Profile.** For a local trade business this matters more than the website. Set it up, add photos and ask every happy customer for a review.
2. **Google Search Console.** Add the domain and submit `sitemap.xml`.
3. Get a business email on your domain (Google Workspace or Zoho Mail).

## Tweaking the effects

- **Hero scroll length**: `--hero-run` in `styles.css` (default `290vh` of scrolling).
- **Number of cleaning strips**: `st.rows` in `initHero` (`app.js`).
- **Wet look and spray**: `wetDark` in the hero's draw call (lower is darker), and the particle counts in `emitSpray`.
- **Hero strip direction**: `PHOTOS.hero.slab` can hold four corners of one concrete slab in the original photo to line the strips up with driveway joints. It is `null` for the current photo, so they run straight across the screen.
- **Accessibility**: visitors who prefer reduced motion get still photos, and devices without WebGL get the clean photo with no effect.
- **Preview helpers**: add `?y=1200` (pixel offset) or `?to=services` (section id) to the URL to jump to a scroll position. Add `?perf=1` and the hero logs its per-frame cost to `window.__gpFrames`.
