# Figma → Claude → Vercel: step by step

This is how this portfolio went from a Figma frame to a live site, and how to repeat it.

---

## Part 1: Turn a Figma design into code with Claude

1. **Connect Figma to Claude.** In the Claude desktop app, open the Code tab and make sure the Figma connector is on (Settings → Connectors → Figma). Sign in to Figma when it asks.
2. **Copy a link to the exact frame.** In Figma, select the frame you want (here it's the "Ethan edits" frame). Right-click → **Copy link to selection**. The link must include `?node-id=…`.
3. **Open a project folder in Claude Code.** Pick an empty folder (this one is `~/Desktop/PortfolioV4`).
4. **Ask Claude to build it:**
   > Implement this design from Figma. <paste link>
5. **What Claude does:**
   - reads the layers, text, colors, spacing and animation data from Figma
   - downloads every image and SVG into `assets/`
   - writes `index.html`, `styles.css` and `script.js`
   - opens it in the browser pane and compares it with the Figma screenshot
6. **Iterate in plain English.** For example: "make the case-study cards link to /everlasting", "add an About page", "the title should be bigger on mobile".

What was built here:

| File | What it is |
|---|---|
| `index.html` | Work page: side nav, 3 case-study cards (Ever Lasting has an animated screen showreel), footer |
| `everlasting.html` | Ever Lasting Fabric Matchmaker case study, with a scroll-spy side menu |
| `playground.html` | Playground grid of projects with hover captions |
| `about.html` | About page: Spotify "currently listening", photo fan, experience table |
| `styles.css` | All styles: layouts matching the 1440px Figma frames, plus tablet and phone layouts |
| `script.js` | Toronto clock, photo puzzle, cursor pill, Spotify toggle, footer trail, typewriter header, case-study menu, version toggle, typing search bars |
| `assets/` | Images, GIFs, SVGs and fonts exported from Figma (case-study files are in `assets/everlasting-quiz/`) |

It's plain HTML/CSS/JS with **no build step**, so Vercel can serve it as-is. About 113 MB across 88 files.

---

## Part 2: Put the code on GitHub

Vercel deploys from a Git repo, so this is the easiest path.

1. **Install the command-line tools** (one time). Open Terminal and run:

```bash
xcode-select --install
```

This installs `git`. You only need Node.js (from https://nodejs.org, LTS version) if you want the Vercel CLI in Option B below.

2. **Create a GitHub account** at https://github.com if you don't have one.
3. **Create an empty repo** on GitHub: click **New repository**, name it `portfolio`, keep it empty (no README), then **Create**.
4. **Push this folder.** In Terminal:

```bash
cd ~/Desktop/PortfolioV4
```

```bash
git init && git add . && git commit -m "Portfolio from Figma"
```

```bash
git branch -M main && git remote add origin https://github.com/YOUR-USERNAME/portfolio.git && git push -u origin main
```

Or just ask Claude: *"init git and commit, then connect it to my GitHub repo `portfolio`"*. It can set this up once `git` is installed. The first push asks you to sign in to GitHub, which you do yourself.

---

## Part 3: Launch on Vercel

### Option A: Vercel dashboard (easiest, no terminal)

1. Go to https://vercel.com and **Sign up with GitHub**.
2. Click **Add New… → Project**.
3. Find your `portfolio` repo and click **Import**.
4. Settings:
   - **Framework Preset:** `Other`
   - **Build Command:** leave empty
   - **Output Directory:** leave empty (or `.`)
5. Click **Deploy**. About 30 seconds later you get a live URL like `portfolio-xyz.vercel.app`.
6. **Every future `git push` redeploys automatically.** Push to `main` for production; other branches get preview URLs.

### Option B: Vercel CLI (from Terminal or via Claude)

Needs Node.js installed, but no GitHub.

```bash
cd ~/Desktop/PortfolioV4 && npx vercel --prod
```

A browser window opens to log in. Then answer the prompts: set up and deploy → yes, link to existing project → no, directory → `./`, override settings → no. Run the same command again to publish updates.

---

## Part 4: Custom domain (optional)

1. In Vercel: **Project → Settings → Domains → Add** and type your domain (e.g. `kenpiquero.com`).
2. Vercel shows DNS records (usually an `A` record to `76.76.21.21` and a `CNAME` for `www` to `cname.vercel-dns.com`).
3. Add those records at your domain registrar. HTTPS is set up automatically.

---

## Updating the site later

1. Change the design in Figma.
2. In Claude: *"Update the site to match this Figma frame: <link>"*, or describe the change.
3. Check it in Claude's browser preview.
4. *"Commit and push"* → Vercel redeploys automatically.

## Notes and to-dos

- **Fonts:** headings use *Alte Haas Grotesk* (Regular and Bold, loaded from `assets/fonts/`); body text uses *Hanken Grotesk* from Google Fonts.
- **Big GIFs:** the Ever Lasting case study has three large GIFs in `assets/everlasting-quiz/`: `nav-entry.gif` (~23 MB), `catalogue-scroll.gif` (~20 MB) and `hero-quiz.gif` (~11 MB). They work, but converting them to MP4/WebM video would make the page load much faster, especially on phones.
- **Links:** Safe Guard and Dori Labs case studies aren't built yet; their cards show "coming soon..." and link to `#`.
- **Placeholder metrics:** some Ever Lasting impact numbers are estimates. Swap in real figures before sharing widely.
- **File names are case-sensitive on Vercel:** keep `src`/`href` paths matching file names exactly (e.g. `Screen-01.png` ≠ `screen-01.png`). They all match today.
