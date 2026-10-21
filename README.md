# Govt Jobs Finder — All-India Government Jobs

One codebase for an **Android app, iOS app and SEO website** that lists Indian government job openings from official central, state and UT recruitment sites. A monitor checks those sites every few hours and turns new notices into draft jobs for you to review.

> **Status:** built step by step. ✅ Part 1 (sources + verify script), ✅ Part 2 (monitor), ✅ Part 3 (app & website screens) and ✅ Part 4 (SEO + website deploy) ✅ Part 5 (push notifications), ✅ Part 6 (admin panel) and ✅ Part 7 (monetization) are done.

---

## 1. Local setup

You need:

- **Node.js 24 (LTS)**, or at least 22.3. Download the LTS version from <https://nodejs.org> and check with `node -v`.
- **Git** — <https://git-scm.com>.

```bash
git clone <your-repo-url> govt-jobs-finder
cd govt-jobs-finder
npm install
npm test            # should print "Tests  147 passed"
```

## 2. Project layout (so far)

```
src/
  app/                          # every screen = one file (Expo Router); also the website's pages
    (tabs)/                     # Home, Search, Saved, Tools, More (bottom tabs in the apps)
    jobs/[slug].tsx             # job page, e.g. /jobs/uppsc-pcs-recruitment-2026
    state/[state].tsx  category/[category].tsx  qualification/[qualification].tsx
    admit-card.tsx  answer-key.tsx  result.tsx
    tools/                      # age calculator, eligibility, photo resizer, images→PDF, CGPA
    onboarding.tsx              # first-launch questions
    about, contact, privacy, terms, disclaimer
    _layout.tsx / _layout.web.tsx   # app layout (tabs) / website layout (header + footer)
  components/                   # shared UI (cards, buttons, job list, filters…)
  config/app.ts                 # app name, website URL, Play Store link — edit before launch
  core/                         # job logic shared by app, website and scripts (no UI)
  lib/                          # settings, saved jobs, API fetching, reminders, i18n, tools
  server/data.ts                # build-time only: turns data/jobs/published into pages + JSON API
public/api/                     # generated JSON API (npm run build:api) — not committed
data/
  sources/central.json          # central bodies (UPSC, SSC, RRBs, banks, defence, PSUs…)
  sources/states/<code>.json    # one file per state/UT, e.g. up.json, tn.json, dl.json
  seen-links/<source-id>.json   # links the monitor has already seen, per source
  monitor/github.json|local.json  # per-source health (failures in a row, last error)
  jobs/drafts|published|rejected/
config/monitor.json             # monitor settings: exclude words, limits, User-Agent
reports/source-health.md        # written by `npm run verify-sources`
.github/workflows/monitor.yml   # runs the monitor every 3 hours
scripts/
  monitor/                      # the monitor (links, PDFs, drafts, Telegram)
  verify-sources.ts             # checks every source URL
  validate-sources.ts           # checks the JSON files for mistakes
  lib/                          # shared helpers (HTTP client, source loading, config)
src/core/                       # constants & types shared by scripts and the app
tests/                          # unit tests (vitest)
```

## 3. Sources

A **source** is one official web page the monitor watches, such as SSC's home page or UPPSC's notice board.

### The source format

```json
{
  "id": "ssc",
  "name": "Staff Selection Commission",
  "url": "https://ssc.gov.in/",
  "level": "central",
  "state": null,
  "category": "SSC",
  "linkFilter": ["notice", "notification", "recruitment", "advt", "vacancy", ".pdf"],
  "priority": "high",
  "enabled": true,
  "verified": false
}
```

| Field | Meaning |
|---|---|
| `id` | Unique short name: lowercase letters, digits and dashes. Never change it once the monitor has run, because the seen-links file is named after it. |
| `url` | The page to watch. `""` if not known yet, and then `enabled` must be `false`. |
| `level` | `central`, `state` or `ut`. It must match the file the source is in. |
| `state` | State/UT code (e.g. `UP`, `TN`, `DL`), or `null` in `central.json`. |
| `category` | One of: SSC, UPSC, Railway, Bank, Defence, Police, Teaching, PSU, PSC, Subordinate Services, Health, High Court, Electricity, Other. |
| `linkFilter` | A link counts as a job link if its URL or text contains one of these words. |
| `priority` | `high` = checked every monitor run; `normal` = every second run. |
| `enabled` | `false` = the monitor skips it. |
| `verified` | Set **automatically** by `verify-sources`. Don't edit it by hand. |
| `finalUrl`, `lastVerifiedAt` | Set automatically by `verify-sources`. |
| `notes` | Free text, e.g. a TODO. |

State/UT codes: AP, AR, AS, BR, CG, GA, GJ, HR, HP, JH, KA, KL, MP, MH, MN, ML, MZ, NL, OD, PB, RJ, SK, TN, TG, TR, UP, UK, WB (states); AN, CH, DD, DL, JK, LA, LD, PY (UTs).

### What's pre-filled

- **Central (82):** UPSC, SSC, the RRB apply portal and all 21 RRBs, 16 RRC zones, IBPS, SBI, RBI, NABARD, LIC, Army, Navy, Air Force (Agniveervayu, AFCAT, careers), CRPF, BSF, CISF, ITBP, SSB, Assam Rifles, NTA, KVS, NVS, DRDO + RAC, ISRO, BARC, AIIMS, ESIC, EPFO, India Post (GDS + main), FCI, ONGC, NTPC, BHEL, IOCL, GAIL, SAIL, Coal India, POWERGRID, BEL, HAL, Employment News, NCS.
- **States & UTs (189):** for each of the 36 states/UTs, the PSC, staff/subordinate selection board, police recruitment board, teacher board, health board, high court, power utility and recruitment portal, wherever an official URL was known with confidence.
- **54 TODO entries** have `"url": ""` and `"enabled": false`. These are bodies that exist but whose official URL couldn't be confirmed. Domains were never guessed. `reports/source-health.md` lists them all.
- A shared high court is listed once, under the state where it sits (e.g. Gauhati HC under Assam, Punjab & Haryana HC under Punjab), and its name says which other states it covers.

### Adding or fixing a source

1. Open the right file, e.g. `data/sources/states/up.json`.
2. Copy an existing entry inside `"sources": [ … ]` and change it. Use only official URLs: `.gov.in`, `.nic.in`, or a domain linked from an official government page.
3. Check the file for mistakes:
   ```bash
   npm run validate-sources
   ```
4. Check that the URL works:
   ```bash
   npm run verify-sources -- --only=your-new-id
   ```
5. Commit and push.

### `npm run verify-sources`

Opens every source URL (following redirects, 30 s timeout, 2 retries, at most 5 at a time, with a 1–2 s gap between requests to the same site) and then:

- sets `"verified": true` for sources that answer with HTTP 200, and `false` for the rest;
- records `finalUrl` (after redirects) and `lastVerifiedAt`;
- writes **`reports/source-health.md`**, which lists failing sources, redirects, non-`.gov.in` domains to confirm by hand, and TODOs.

A full run takes about 4 minutes. Options:

```bash
npm run verify-sources -- --only=ssc,upsc     # just these ids
npm run verify-sources -- --state=UP          # one state (or --state=central)
npm run verify-sources -- --unverified        # re-check only the failing ones
npm run verify-sources -- --dry-run           # don't change any files
```

**Why some sources fail:** many Indian government servers time out for some networks, block cloud and foreign IPs, or are simply down for a while. If a site opens in your browser, leave it enabled; the monitor (Part 2) can run from your own PC for exactly these sites. Some sites (e.g. UPSC) refuse requests that don't look like a browser. The monitor identifies itself honestly by default, and you can change the identity with the `MONITOR_USER_AGENT` environment variable.

**Certificate warnings (⚠️):** many government sites have a misconfigured HTTPS certificate or use very old TLS settings. Browsers tolerate this but Node.js refuses by default. Since we only read public pages, the script retries such sites in a lenient mode and flags them in the report. They still count as verified.

## 4. The monitor

`npm run monitor` visits the official source pages and finds new job notices:

1. It picks the sources to check. **High**-priority sources run every time; **normal** ones run every second run.
2. It downloads each page (5 at a time, 30 s timeout, 2 retries, a 1–2 s gap between requests to the same site) and obeys each site's `robots.txt`.
3. It keeps links that contain one of the source's `linkFilter` words or that point to a PDF, and drops anything on the `exclude` list in `config/monitor.json` (tenders, RTI, holiday lists, circulars, site menus…).
4. A link is **new** if it isn't in `data/seen-links/<source-id>.json` yet.
5. Each new link becomes a **draft job** in `data/jobs/drafts/`. For PDFs under 10 MB, it reads the text and looks for the number of posts, the dates, the age limit, the fee and the qualification. It only fills a field when the PDF says it, and stores the exact sentence each value came from in `extraction.evidence`, so you can check it. Anything not found stays empty and shows as "See official notification".
6. It sends **one Telegram message** for the whole run: Central first, then by state, then any **sources needing attention** (failing 3 runs in a row, or loading but showing no job links).

Safety rules built in:

- **First run on a source = baseline.** All its current links are recorded, so you don't get hundreds of old alerts. The GitHub workflow runs with `--seed=3`, which also saves that source's **3 newest notices as drafts** on its first run, so you have real jobs to review straight away (one Telegram summary, not one alert each).
- **Site redesigns:** if a single source suddenly has more than 25 new links (`maxNewLinksPerSource`), it is re-baselined and mentioned in Telegram instead of creating 25+ drafts.
- **Time limit:** no new sources are started after 17 minutes (`timeBudgetMinutes`). A full run of all ~220 sources takes about 8 minutes.
- **Sources that keep failing** get one attempt instead of three, so they don't use up the time budget.
- **Nothing is ever public automatically.** Drafts stay drafts until you publish them (Part 6).

### Draft job format

```json
{
  "id": "3f9a1c0b2e",
  "slug": "uppbpb-up-police-constable-recruitment-2026-3f9a1c",
  "status": "draft",
  "title": "UP Police Constable Recruitment 2026",
  "organization": "UP Police Recruitment & Promotion Board",
  "sourceId": "uppbpb", "level": "state", "state": "UP", "category": "Police",
  "postName": null,
  "vacancies": 1250,
  "qualifications": ["12th"],
  "ageLimit": "18–25 years",
  "fee": null,
  "dates": { "notification": null, "applyStart": null, "lastDate": "2026-11-30", "exam": null },
  "howToApply": null,
  "links": { "notification": "https://…/constable-2026.pdf", "official": "https://uppbpb.gov.in/", "apply": null },
  "foundAt": "2026-10-20T09:00:00.000Z",
  "extraction": {
    "method": "pdf-regex",
    "fields": ["dates.lastDate", "vacancies", "ageLimit", "qualifications"],
    "evidence": { "vacancies": "Total No. of Posts: 1,250", "…": "…" }
  }
}
```

### Step 1: create the Telegram bot (5 minutes, free)

1. In Telegram, open **@BotFather** and send `/newbot`. Pick a name and a username ending in `bot`.
2. BotFather replies with a **token** like `123456789:AAH…`. That is your `TELEGRAM_BOT_TOKEN`. Keep it secret.
3. Open your new bot and press **Start**, or send it any message. A bot can't message you until you've messaged it.
4. To get your chat ID, open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser and find `"chat":{"id":123456789`. That number is your `TELEGRAM_CHAT_ID`.
5. Test it from your PC:
   ```bash
   export TELEGRAM_BOT_TOKEN=123456789:AAH...
   export TELEGRAM_CHAT_ID=123456789
   npm run monitor -- --only=ssc,uppsc
   ```
   The first run is a baseline, so no message is sent. Run it again later; if a new notice has appeared, you get a message.

This private chat is only for you, the admin. Your public Telegram/WhatsApp channels for users come in Part 7.

### Step 2: run it on GitHub Actions every 3 hours (free)

1. Create a repository on GitHub and push this project to it. **Keep the repository public.** Public repos get unlimited free Actions minutes, while private repos get 2,000 minutes a month, which this would use up. The repo contains only public government links and no secrets.
2. Edit `config/monitor.json` and replace `YOUR-GITHUB-USERNAME` in `userAgent` with your GitHub username. This tells site owners who is visiting and how to reach you.
3. In the repository, go to **Settings → Secrets and variables → Actions → New repository secret** and add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
4. Go to **Settings → Actions → General → Workflow permissions** and choose **Read and write permissions**. This lets the monitor commit its results.
5. Go to the **Actions** tab, choose **Monitor official sources**, then **Run workflow**. The first run baselines every source and takes about 8 minutes. After that it runs by itself every 3 hours (00:00, 03:00, … UTC) and commits changes with messages like `[CF-Pages-Skip] monitor: 14 new links — SSC, UPPSC, TNPSC, +5 more`. Drafts are never public, so set the build watch paths in §6 to stop Cloudflare rebuilding the site for these commits. The `[CF-Pages-Skip]` prefix does the same if you ever use Cloudflare Pages instead of Workers.

Each run commits to `data/`. Run `git pull` before editing anything locally.

### Step 3 (optional): run on your own PC for sites that block GitHub

Many Indian government websites block or time out for cloud servers such as GitHub's. They often work fine from a normal Indian internet connection. For those:

```bash
git pull
npm run monitor:local
```

This runs **only the sources currently failing on GitHub**, then commits and pushes the results. Your PC keeps its own health file (`data/monitor/local.json`), so it never conflicts with GitHub's. If a source works from your PC, GitHub's failures for it are not reported as "needing attention" for 3 days. Running `npm run monitor:local` once a day is plenty. You can schedule it with Task Scheduler on Windows or `cron` on Mac/Linux.

### Monitor options

```bash
npm run monitor -- --dry-run          # check everything, print results, change nothing, send nothing
npm run monitor -- --only=ssc,bpsc    # just these sources
npm run monitor -- --state=UP         # one state (or --state=central)
npm run monitor -- --all              # ignore priority, run every enabled source
npm run monitor -- --no-pdf           # don't download PDFs
npm run monitor -- --only-failing     # only sources failing on GitHub
npm run monitor -- --push             # commit + push when done
```

### Settings (`config/monitor.json`)

| Setting | Default | Meaning |
|---|---|---|
| `userAgent` | `GovtJobsFinder/1.0 (+github…)` | How the monitor identifies itself. The `MONITOR_USER_AGENT` environment variable overrides it. |
| `concurrency` | 5 | Pages fetched at once |
| `timeoutMs` / `retries` | 30000 / 2 | Per-request timeout and retries |
| `hostGapMs` | 1000–2000 | Wait between two requests to the same site |
| `timeBudgetMinutes` | 17 | Stop starting new sources after this |
| `attentionAfterFailures` | 3 | Failed runs in a row before a source is listed as needing attention |
| `maxNewLinksPerSource` | 25 | More new links than this at once → re-baseline instead of alerting |
| `pdf` | on, 10 MB, 40 per run, first 10 pages | PDF reading limits |
| `exclude` | tender, RTI, holiday, circular… | Links containing these words are never job links |

### When a source "needs attention"

- **Timeout / connection refused / HTTP 403:** the site may block GitHub. Try `npm run monitor:local`. If it fails from your PC too, check the site in a browser and fix the `url`, or set `"enabled": false`.
- **No job links found:** the page loads but has no matching links. Either the site builds its page with JavaScript (e.g. ssc.gov.in), or the `url` is a home page without notices. Change `url` to the site's "What's New" or "Notices" page and check again with `npm run monitor -- --only=<id> --dry-run`.
- **Re-baselined:** the site was redesigned. Check it once by hand for anything new.

## 5. The app and website (one codebase)

The same code in `src/app` runs as the **Android app**, the **iOS app** and the **website**. The website is pre-rendered: every job, state, category and qualification page is a real HTML file that Google can read.

### How the data flows

1. A job is published when its JSON file is in `data/jobs/published/` with `"status": "published"` (the admin panel in Part 6 does this for you).
2. `npm run build:api` turns the published jobs into a static JSON API in `public/api/`: `/api/jobs/latest.json`, `/api/jobs/state/UP.json`, `/api/jobs/<slug>.json`, and the same for categories, qualifications and admit-card/answer-key/result.
3. The **website** build (`npm run build:web`) pre-renders every page with that data and publishes the JSON API alongside it.
4. The **apps** download the JSON API from your website (`siteUrl` in `src/config/app.ts`). New jobs therefore appear in the apps without releasing a new app version. Everything the apps download is cached, so saved jobs and recently opened pages work offline.

**Sample data:** five sample published jobs and three sample drafts are included (`"sample": true`). They are shown **only** when building with `SAMPLE_JOBS=1`, which `npm start`, `npm run ios`, `npm run android` and `npm run web` do for you. Real builds (`npm run build:web`) never include them. Delete the `sample-*.json` files once you have real jobs.

### Before you start: set your details

Edit `src/config/app.ts`: app name, `siteUrl` (your Cloudflare Pages address or domain, set up in Part 4), Play Store link and contact email.

### Run it

```bash
npm start           # starts the dev server and shows a QR code
```

- **On your own phone (easiest):** install **Expo Go** from the Play Store or App Store, then scan the QR code (Android: inside Expo Go; iPhone: with the Camera app). Your phone and computer must be on the same Wi-Fi.
- **Android emulator:** install [Android Studio](https://developer.android.com/studio), open **Device Manager** and create a virtual device (e.g. Pixel 8, latest Android). Start it, then run `npm run android`.
- **iOS simulator (Mac only):** install **Xcode** from the Mac App Store, open it once to finish setup, then run `npm run ios`.
- **Website:** `npm run web` opens it in your browser at http://localhost:8081.

Changes you save in the code appear immediately.

Expo Go is enough for everything except push notifications and ads, which need a "development build" (see §7).

### Build the website

```bash
npm run build:web          # → dist/ (all pages, sitemaps, the JSON API)
npm run build:web:sample   # same, including the sample jobs
npx serve dist             # preview it at http://localhost:3000
```

Deploying is covered in the next section.

### What's in the app

- **Onboarding** (first launch): language, states (plus "Central government"), job categories, qualification. Stored on the device only; no login. Change it any time under **More → My preferences**.
- **Home:** search, *For you* (matches your preferences), *New today*, *Closing soon*, *Latest jobs*, quick links to admit cards / answer keys / results, and browse by state, category and qualification.
- **Search:** search text plus filters (Central/State, state, category, qualification, closing in 7 days).
- **Job page:** post, organisation, state, vacancies, qualification, age limit, fee, important dates, how to apply, official notification / apply / website buttons, and the status timeline (Notification → Apply → Admit Card → Answer Key → Result). Buttons: **Save**, **WhatsApp** share, **Remind me** (app: notifications 3 days and 1 day before, and on the last date; website: adds it to your calendar). Anything unknown shows "See official notification".
- **Saved:** saved jobs are stored in full, so they work offline, and get an "Updated" badge when the job changes (e.g. admit card released).
- **State, category, qualification, Admit Card, Answer Key and Result pages.** Expired jobs move to an "Expired" section but stay online.
- **Tools** (all on-device, nothing uploaded): age calculator, age eligibility with category relaxation (editable values), photo & signature resizer (exact pixels and KB), images to PDF, CGPA to percentage.
- **About, Contact, Privacy Policy, Terms, Disclaimer.** The website footer always says it is not a government website.
- **Light/dark mode** (follows the phone, or choose under More), and **English + Hindi**.

### Adding a language

UI text lives in `src/lib/i18n/`. `en.ts` has every string. `hi.ts` currently translates the main navigation and labels; anything missing falls back to English automatically. To add a language (e.g. Tamil), copy `hi.ts` to `ta.ts`, translate the strings, and add it to `LANGUAGES` and `dictionaries` in `src/lib/i18n/index.ts`. Job content itself stays in English.

## 6. SEO and deploying the website

### What the build does for search engines

`npm run build:web` runs three steps: `build:api` (JSON API), `expo export` (pre-renders every page) and `scripts/postbuild-web.ts`. The last step:

- **Sitemaps:** `sitemap.xml` (index) → `sitemap-jobs.xml`, `sitemap-states.xml`, `sitemap-categories.xml` (categories, qualifications, admit card/answer key/result) and `sitemap-pages.xml`. Large lists are split automatically.
- **`robots.txt`** allows everything except the JSON API, and points to the sitemap.
- **Structured data:** every open job has Google **JobPosting** markup (title, description, organisation, state, vacancies, education, `validThrough` = end of the last date). Expired jobs keep their page but drop the markup, as Google requires. Pages also have breadcrumb markup, and the home page has WebSite/Organization markup.
- **Unique title, description and canonical URL** on every page. **The build fails** if two pages share a title or description, or if a page is missing one. The output tells you which page to fix.
- **Personal pages** (Saved, Settings, Onboarding, Search) are marked `noindex`.
- **Speed:** the small stylesheet is inlined, the app's JavaScript loads right after the first paint, icons are inline SVG, and `_headers` caches hashed files for a year. Measured with Lighthouse (mobile): **Performance 97–99, Accessibility 100, Best Practices 100, SEO 100** on the home, job, state, category, admit card and tool pages.
- Removes Expo's development-only pages from the output and adds a `404.html`.

Clean URLs work out of the box: `dist/jobs/uppsc-pcs-2026.html` is served at `/jobs/uppsc-pcs-2026`, and unknown pages get `404.html`.

### Deploy to Cloudflare (free)

The repo includes `wrangler.jsonc`, so Cloudflare deploys it as a **Worker with static assets**. `npx wrangler deploy` always runs our full build (`npm run build:web`) first. A tiny Worker script (`worker/index.ts`) handles only the admin login (`/oauth/*`) and website push (`/push/*`); everything else is served as static files.

1. **Set your address.** In `src/config/app.ts`, `siteUrl` must be your site's address. It's currently `https://govt-jobs-finder.21-anshul-k.workers.dev`. Canonical links, sitemaps, the admin login and the apps all use it.
2. In <https://dash.cloudflare.com> go to **Workers & Pages → Create → Import a repository**, and pick this GitHub repo. The Worker **name must be `govt-jobs-finder`** (the `name` in `wrangler.jsonc`).
3. Under the Worker's **Settings → Build**:
   - **Build command:** leave it **empty**. Wrangler runs the build itself, and a second build command would only build twice.
   - **Deploy command:** `npx wrangler deploy`
   - **Build watch paths → Exclude:** `data/seen-links/*`, `data/monitor/*`, `data/jobs/drafts/*`, `data/jobs/rejected/*`, `reports/*`. The monitor's commits (every 3 hours) then don't rebuild the site for nothing.
   - If a build ever fails with a Node.js version error, add a build variable `NODE_VERSION` = `24`.
4. From now on, every push that changes the site deploys automatically, for example publishing a job in the admin panel.

**Daily rebuild:** the **Daily website rebuild** workflow pushes an empty commit every morning (06:00 IST), which makes Cloudflare rebuild. This keeps "expired" labels and Google markup current. Nothing to set up.

**Your own domain (optional):** Worker → **Settings → Domains & Routes → Add → Custom domain**. A domain is the only cost (around ₹700–900/year for a `.in`). Update `siteUrl` afterwards.

### Tell Google about the site

1. Open [Google Search Console](https://search.google.com/search-console), add your site as a **URL prefix** property, and verify it. The easiest method is the **HTML tag**: add the `<meta name="google-site-verification" …>` tag to `src/app/+html.tsx` inside `<head>`, push, then click Verify.
2. Under **Sitemaps**, submit `sitemap.xml`.
3. Test a job page with Google's [Rich Results Test](https://search.google.com/test/rich-results). It should show a valid **Job posting**.
4. Check **Pages** and **Enhancements → Job postings** in Search Console every week or two.

New sites usually take a few weeks to rank. Publishing jobs quickly and accurately, with your own clear summaries, is what matters most.

## 7. Push notifications

### How they work (no database)

When a user picks their states, categories and qualification, the app subscribes the phone to matching **Firebase Cloud Messaging (FCM) topics**, for example `state_UP`, `central`, `cat_police` (or `cat_all`), `qual_12th` (or `qual_any`), and `job_<id>` for each saved job. Nothing is stored on any server we run.

| When | Who gets it | Sent by |
|---|---|---|
| A job is published | Users whose states/categories/qualification match it, using the same rule as the app's *For you*. Example: "New: UP Police Constable 2026 — 12,000 posts. Last date 15 Nov." | `.github/workflows/publish.yml` |
| 3 days before a last date, 09:00 IST | The same matching users: "Last 3 days to apply" | `.github/workflows/push-reminders.yml` |
| A published job gets an admit card, answer key or result | Users who **saved** that job | `publish.yml` |
| "Remind me" on a job | That user (scheduled on the phone, no server) | the app |

The publish workflow waits until the website shows the new job (Cloudflare takes a few minutes) before sending, so tapping the notification always works. Sample jobs are never announced, and a job is not announced if its last date has already passed. FCM is free with no message limit.

Users can switch alerts on or off under **More → Job alerts**. The app asks for permission at the end of onboarding, right after explaining why.

### Step 1: Create a Firebase project (free)

1. Go to <https://console.firebase.google.com> → **Add project**. Google Analytics: on (it's used for app analytics in Part 7).
2. **Android:** click **Add app → Android**, package name `in.govtjobsfinder.app` (or whatever is in `app.json` → `android.package`). Download **`google-services.json`** into the project root.
3. **iOS** (can wait until you launch on iOS): **Add app → Apple**, bundle ID from `app.json` → `ios.bundleIdentifier`. Download **`GoogleService-Info.plist`** into the project root. For iOS push you also need an **APNs key**: in [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list), create a key with *Apple Push Notifications service*, then upload it in Firebase → Project settings → **Cloud Messaging → Apple app configuration**.
4. Commit both files. They identify your Firebase project and are not secret, but in Google Cloud → Credentials, restrict the API key to your app. As soon as these files exist, `app.config.ts` switches Firebase on automatically.

### Step 2: Let GitHub send notifications

1. Firebase → Project settings → **Service accounts → Generate new private key**. A JSON file downloads. **This one is a secret: never commit it.** `.gitignore` already blocks the usual names.
2. In GitHub → repository **Settings → Secrets and variables → Actions**, add a secret named `FIREBASE_SERVICE_ACCOUNT` and paste the **entire contents** of that JSON file. Then delete the file from your computer.

Without this secret, both workflows run in *dry-run* mode: they print what they would send and send nothing.

### Step 3: Build the app with push (development build)

Expo Go can't receive remote push (it doesn't include Firebase). Build your own development app once; afterwards you keep using `npm start` as before.

```bash
npm install -g eas-cli
eas login                          # free Expo account
eas build:configure                # first time only; keep the existing eas.json
eas build --profile development --platform android
```

When it finishes (about 15 minutes on the free tier), open the link on your Android phone and install the app. Then run `npm start` and open the project from that app instead of Expo Go. On a Mac, `npx expo run:android` or `npx expo run:ios` builds on your own computer instead.

### Step 4: Test it

- **Quick test:** in Firebase → **Messaging → Create campaign → Firebase Notification messages**, write a message, choose **Topic** `all` as the target, and send it. Your phone should show it.
- **Matching test:** pick *Uttar Pradesh* in onboarding, then send a test to topic `state_UP`.
- **Dry runs on your computer:**
  ```bash
  SAMPLE_JOBS=1 npm run push:reminders -- --dry-run      # what today's reminders would be
  npm run push:published -- --before HEAD~1 --after HEAD --dry-run   # what the last commit would announce
  ```

### Web push (experimental, off by default)

The website can also send browser notifications. Browsers can't subscribe to FCM topics themselves, so a small free route on your Cloudflare Worker (`functions/push/subscribe.ts`) does it for them using your service account.

1. In Firebase, **Add app → Web** and copy the config values into `src/config/firebase-web.ts`. Under **Cloud Messaging → Web Push certificates**, generate a key pair and paste it as `vapidKey`.
2. In Cloudflare → `govt-jobs-finder` → **Settings → Variables and secrets**, add `FIREBASE_SERVICE_ACCOUNT` (type: *Secret*) with the same JSON as in step 2.
3. Set `webPush: true` in `src/config/features.ts`, push, and test in Chrome: open **Settings** on the site → Job alerts → On.

This uses Google's topic-subscription API from Cloudflare. It hasn't been tested end-to-end with a real Firebase project yet, so try it on a test project first. Leaving it off has no effect on the apps.

## 8. Admin panel (review and publish jobs)

Your admin panel is at **`https://<your-site>/admin/`**. It's [Decap CMS](https://decapcms.org): a free editor that saves straight to your GitHub repo, so there's still no database. Only GitHub accounts with write access to the repository can log in.

| Collection | What's in it |
|---|---|
| **Draft jobs** | New notices found by the monitor. Sort by date found, state, category or title; group by state or category; filter central jobs. |
| **Published jobs** | Live on the website and in the apps. |
| **Rejected** | Not jobs, or duplicates. Kept so they're never alerted again. |
| **Sources — Central / States & UTs** | The official pages the monitor watches. |
| **Sponsored & books** | Sponsored coaching cards and affiliate book links (used in Part 7). |

### One-time setup (10 minutes, free)

You need the website deployed on Cloudflare first (§6), with `siteUrl` in `src/config/app.ts` set to its address.

1. **Create a GitHub OAuth app:** GitHub → your profile picture → **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Application name: `Govt Jobs Admin`
   - Homepage URL: your site, e.g. `https://govt-jobs-finder.21-anshul-k.workers.dev`
   - Authorization callback URL: your site + `/oauth/callback`, e.g. `https://govt-jobs-finder.21-anshul-k.workers.dev/oauth/callback`
   - Click **Register application**, copy the **Client ID**, then click **Generate a new client secret** and copy it.
2. **Add both values to Cloudflare:** Workers & Pages → `govt-jobs-finder` → **Settings → Variables and secrets** → **Add**:
   - `GITHUB_OAUTH_CLIENT_ID` = the client ID
   - `GITHUB_OAUTH_CLIENT_SECRET` = the secret

   Choose type **Secret** for both, and add them under *Variables and secrets*, **not** under Build → Variables (build variables don't exist while the site runs).
3. Click **Deploy** after adding them (Cloudflare asks), so the new values take effect.
4. Open `https://<your-site>/admin/` and click **Login with GitHub**.

The small login helper (`functions/oauth/`, routed by `worker/index.ts`) runs free on your Cloudflare Worker.

### Reviewing a draft

1. Open **Draft jobs** and pick one. Read **Automatic checks**: it lists every value the monitor filled in and the exact sentence it came from. These can be wrong; for example, a date in the PDF may not be the last date.
2. Open the **official notification** link and check everything against it.
3. Fix the fields:
   - **Title:** rewrite it in your own words, e.g. "IBPS PO Recruitment 2026".
   - **Post, vacancies, qualification, age limit, fee and dates:** fill them in or correct them.
   - **How to apply:** add it if you can.
   - **Unknown values:** leave them empty. The site then shows "See official notification".
4. Set **Status**:
   - **Published:** it goes live.
   - **Rejected:** not a job (tender, circular, list of officers…).
   - Leave it as **Draft** to decide later.
5. Click the blue button at the top (**Publish → Publish now**).

   > ⚠️ Decap's top button is called "Publish", but it only **saves** your changes. Whether the job goes live is decided by the **Status** field.

Within a few minutes, the **Publish jobs** workflow (`.github/workflows/publish.yml`) runs:

- **Published jobs** are checked and moved to `data/jobs/published/`, stamped with the publish time and given a "Notification" timeline entry. Cloudflare rebuilds the website and JSON API, and matching users get a push notification.
- **A job missing something essential** (organisation, official links, or the state for a state job) is **not** published. It stays in Drafts, and its **Admin notes** say what to fix.
- **Rejected jobs** move to `data/jobs/rejected/`. The website isn't rebuilt for this.

To **unpublish** a job, open it under Published jobs, set Status back to Draft (or Rejected) and save.

### Publishing or rejecting many drafts at once

The admin panel edits one job at a time. To act on many, use GitHub: **Actions → Bulk update drafts → Run workflow**.

- **Action:** publish or reject.
- **Filters (all optional):**
  - source IDs (e.g. `ssc,ibps,bpsc`)
  - states (e.g. `UP,BR` or `central`)
  - words the title must contain (e.g. `recruitment,advt,vacancy`)
  - words to skip (e.g. `calendar,annexure`)
  - a maximum number of jobs
- **Dry run** is ticked by default: the run page lists exactly which drafts would go live, which would stay in Drafts (and why), and changes nothing. Untick it to apply.
- **Notifications** are off by default, so users don't get dozens of alerts at once.

Published this way, jobs go through the same checks as single publishing. They keep their automatic titles and values, though, so spot-check them on the site afterwards. A good routine: first **reject** the noise in bulk (e.g. source IDs `la-admin,ld-admin,dd-admin,ch-admin`), then **publish** the official recruitment bodies (e.g. `ssc,ibps,hssc,uppsc`).

### Admit card, answer key and result updates

Open the job under **Published jobs** → **Status timeline** → **Add**. Choose the stage (e.g. *Admit Card*), the date and the official link, then save. The job's page updates, it appears on the Admit Card / Answer Key / Result pages, and **everyone who saved it gets a notification**.

### Sources, sponsored cards and books

- **Sources:** add, fix or disable the pages the monitor watches. The **Check data files** workflow tells you if something is wrong (e.g. a duplicate ID). Run `npm run verify-sources` afterwards to check new URLs.
- **Sponsored & books:** add coaching cards (always labelled *Sponsored*) and affiliate book links. They're shown in the app and on the site from Part 7.

### Try the admin on your computer (optional)

```bash
npm run admin:local     # terminal 1: lets the admin edit files on your computer, no login
npm run web             # terminal 2
```

Then open <http://localhost:8081/admin/index.html> and click **Login**. Changes are saved straight into your local files (commit and push them yourself). Press Ctrl+C in both terminals to stop.

## 9. Monetization

Every money feature has a switch in **`src/config/monetization.ts`**, and **all are off** until you turn them on and add your IDs. Nothing costs money to set up. Google, the app stores and Razorpay take a share of what you earn instead.

| Feature | Where | Switch |
|---|---|---|
| Ads in the apps (AdMob): banner below lists, native ad every ~7 jobs, full-screen ad at most every 4 minutes (never on app open), rewarded ads | Android/iOS | `ads.enabled` + `ads.admob` |
| Ads on the website (AdSense): in-list, below lists, desktop sidebar | Web | `ads.enabled` + `ads.adsense` |
| Pro subscription (₹49/month, ₹299/year) | Apps: RevenueCat. Web: Razorpay | `pro.enabled` |
| Recommended books (affiliate) and Sponsored coaching cards | Job, state, category pages | `affiliate` / `sponsored` (content comes from the admin panel) |
| Telegram / WhatsApp channel buttons | Home, job page, More | `community` |
| Analytics | Firebase Analytics (apps), GA4 (web) | `analytics` |
| Daily quiz and mock tests | `/quiz` | `quiz` |

**Pro benefits:** no ads; new-job alerts **first** (free users get them `freeAlertDelayMinutes` later); unlimited saved jobs and reminders (free: 10 and 5); a **PDF summary** of any job; the **"Eligible for me"** filter (date of birth + category relaxation + qualification, entered under More → My details and kept on the device); the **exam calendar** (`/calendar`); and full mock tests. Free users can **watch a rewarded ad** to use the Pro tools for 24 hours (apps). While `pro.enabled` is off, all of these tools are free for everyone with no limits.

Ads, Pro (in the apps) and analytics use native code, so after turning them on, **make a new app build** (`eas build`, §10). Website changes go live with the next deploy.

### AdMob (app ads)

1. Sign up at <https://admob.google.com>. Go to **Apps → Add app** (Android; add iOS later), copy the **App ID** (`ca-app-pub-…~…`), and put it in `ads.admob.androidAppId`.
2. Under that app, create 4 **ad units** and copy their IDs into `ads.admob.android`: **Banner**, **Native advanced**, **Interstitial** and **Rewarded**.
3. **Privacy & messaging**: create a **European regulations (GDPR)** message, and for iOS an **IDFA explainer**. The app shows Google's consent form automatically where it's required, before any ad.
4. Set `ads.enabled: true` and rebuild the app. In development builds Google's **test ads** are always used. Never tap your own real ads, or Google may suspend your account.
5. The website build creates **`/app-ads.txt`** for you. Use your website address as the "developer website" in Play Console so AdMob can find it.

### AdSense (website ads)

1. Apply at <https://adsense.google.com> with your site address. Approval needs real content, so publish some jobs first.
2. Copy your publisher ID (`ca-pub-…`) into `ads.adsense.client`. Then create 3 **display ad units** (in-list, below-list, sidebar) and put their IDs in `ads.adsense.slots`.
3. In AdSense, go to **Privacy & messaging** and set up the consent message for EEA/UK visitors.
4. Set `ads.enabled: true` and push. The build creates **`/ads.txt`** automatically. The AdSense script loads only after the page has appeared, so it doesn't hurt your speed score much. Expect Lighthouse performance to drop a little once real ads load; that's normal.

### Pro in the apps (Google Play + RevenueCat)

1. **Play Console** (needs your $25 developer account and the app uploaded at least to internal testing, see §10): go to **Monetise → Products → Subscriptions** and create `pro_monthly` (₹49, 1 month) and `pro_yearly` (₹299, 1 year), then activate them.
2. **RevenueCat** (free until you earn $2,500/month): <https://app.revenuecat.com> → create a project → add the **Play Store app** (package `in.govtjobsfinder.app`) and upload the Google service-account credentials it asks for (RevenueCat's guide walks you through it).
3. In RevenueCat:
   - Create the **entitlement** `pro`, and attach both products to it.
   - Create the **offering** `default` with packages *Monthly* and *Annual*.
4. Copy the **public Android API key** into `pro.revenueCat.androidApiKey`, set `pro.enabled: true`, and rebuild.
5. Test with a **license tester** account (Play Console → Settings → License testing), so test purchases are free.

For iOS later: create the same two subscriptions in App Store Connect, add the iOS app in RevenueCat, and put the iOS key in `iosApiKey`.

### Pro on the website (Razorpay)

1. Sign up at <https://razorpay.com> and complete KYC. Start in **Test mode**.
2. Go to **Subscriptions → Plans** and create a monthly plan (₹49) and a yearly plan (₹299). Copy their `plan_…` IDs.
3. Go to **Settings → API keys → Generate key**.
4. In Cloudflare → Worker `govt-jobs-finder` → **Settings → Variables and secrets**, add these as **Secret**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_MONTHLY_PLAN_ID`, `RAZORPAY_YEARLY_PLAN_ID`. They never go into the code.
5. Keep `pro.razorpay.enabled: true` and `pro.enabled: true`, then push. Visitors buy on `/pro`. Because there are no accounts, Pro is remembered in that browser; on another device they restore it with the subscription ID from Razorpay's email.
6. When everything works in Test mode, switch the four values to your **Live** keys and plans.

### Sponsored cards and books

Add them in the admin panel under **Sponsored & books**:
- **Sponsored cards** can target categories and states and have start and end dates. They're always shown with a "Sponsored" label, and on the website their links are marked `rel="sponsored"`, as Google requires.
- **Books** match a job by words in its title (e.g. "SSC GD") or by category. Use your Amazon Associates or Flipkart affiliate links.

### Community channels

Create a public **Telegram channel** and a **WhatsApp channel** (separate from your private admin bot), and put their invite links in `community.telegramUrl` and `community.whatsappUrl`.

### Analytics

- **Apps:** in Firebase → **Analytics**, enable Google Analytics for the project. Then set `analytics.enabled: true` and rebuild.
- **Website:** add the GA4 measurement ID (`G-…`) from Firebase → Project settings → your web app to `analytics.webMeasurementId`.

It records the installs (automatic), `job_view`, `job_save`, `job_share`, `reminder_set`, `push_open`, `ad_impression`, `paywall_view`, `purchase`, `rewarded_unlock` and `quiz_complete` events. See them in Firebase → Analytics → Events.

### Mock tests

`/quiz` shows a **free daily quiz** (the same questions for everyone that day) and full practice sets (Pro). Add question banks in the admin panel under **Quizzes**. The included set is a small sample; it's hidden automatically once you add a real one.

## 10. Releasing the apps

### Over-the-air updates (EAS Update)

Small fixes to screens and text can reach users without a store review:

```bash
eas init                 # once: links the project to your Expo account
eas update:configure     # once: adds the update settings to app.json
eas update --branch production --message "Fix job page typo"
```

Updates only apply to builds made **after** `eas update:configure`. Changes to native code (adding a library, AdMob IDs, Firebase files) still need a new store build.

### Android: build and publish on Google Play

1. Pay the one-time **$25** at <https://play.google.com/console> and create the app.
2. Build the release bundle: `eas build --profile production --platform android` (about 15–20 minutes). It produces an `.aab` file.
3. In Play Console, complete:
   - **Store listing:** name, short and full description, screenshots, icon.
   - **App content:** privacy policy URL `https://<your-site>/privacy`; **Ads: Yes** if ads are on; target audience **18+**; content rating questionnaire; **Data safety** (see below).
4. Go to **Testing → Internal testing → Create release**, upload the `.aab`, and test on your phone. Then **Production → Create release**.
5. Next time: `eas submit --platform android` uploads the build for you (it needs a Play service-account key the first time; EAS explains each step).

### Data safety (Play Console) / App Privacy (App Store)

Answer according to which features you've switched on. With everything on:

| Data type | Collected? | Why | Shared with |
|---|---|---|---|
| Device or other IDs (advertising ID) | Yes | Advertising, analytics | Google (AdMob, Firebase) |
| App interactions (pages opened, buttons used) | Yes | Analytics | Google (Firebase) |
| Approximate location (from IP, by the ad SDK) | Yes | Advertising | Google (AdMob) |
| Diagnostics (ad SDK crash/performance data) | Yes | Advertising | Google (AdMob) |
| Purchase history (subscription status) | Yes | App functionality | RevenueCat, Google Play / Apple |
| Name, email, phone, precise location, contacts | **No** | | |
| Photos and files (photo resizer, images to PDF) | **No**: processed only on the device, never uploaded | | |
| Date of birth / category ("Eligible for me") | **No**: stays on the device | | |

Also: data is **encrypted in transit** (HTTPS); users **can't request deletion** because nothing is stored against them (uninstalling removes local data, and the advertising ID can be reset in phone settings). Google's own AdMob and Firebase "data disclosure" pages list the exact items, so check them when filling in the form, as SDKs change.

## 11. Tests

```bash
npm test            # unit tests
npm run typecheck   # TypeScript type check
```
