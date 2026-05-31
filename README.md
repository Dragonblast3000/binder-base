# Binder Base — deploy in ~10 minutes

This folder is a complete, ready-to-deploy website. It already builds. You do **not** need to edit any code to get it live.

## Fastest path: Vercel (free)

### 1. Install Node.js
If you don't have it, grab the LTS version from https://nodejs.org (v18 or newer).

### 2. Test it locally (optional but reassuring)
In a terminal, inside this folder:
```bash
npm install
npm run dev
```
Open the URL it prints (usually http://localhost:5173). The app works right now using a small built-in sample of cards (search "Blue-Eyes", "Solemn", "Ash"). Your binders save in your browser.

### 3. Get the full card database (recommended)
```bash
npm run build-db
```
This downloads every card once and writes `cards.json`. Move it into the `public/` folder:
```bash
mv cards.json public/cards.json
```
Now search covers all ~13,000 cards instead of the sample. (Skip this and the app still works on the sample set.)

### 4. Put it on GitHub
- Create a free account at https://github.com if needed.
- Make a new empty repository.
- Push this folder to it. If you're new to git:
```bash
git init
git add .
git commit -m "Binder Base"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

### 5. Deploy on Vercel
- Go to https://vercel.com and sign in with GitHub.
- Click **Add New → Project**, pick your repo.
- Vercel auto-detects Vite. Leave everything default. Click **Deploy**.
- ~30 seconds later you have a live URL like `binder-base.vercel.app`.

Every time you `git push`, it redeploys automatically.

---

## Even faster (no GitHub): drag-and-drop

If you just want it live this minute and don't care about auto-updates:

```bash
npm install
npm run build
```
This creates a `dist/` folder. Then:
- Go to https://app.netlify.com/drop
- Drag the `dist` folder onto the page.
- It's live instantly on a random URL you can rename.

(You'll re-drag a new `dist` each time you change something — that's the trade-off vs the GitHub route.)

---

## What works out of the box
- Create / delete / name binders — saved in the browser (localStorage).
- Layouts (3×3, 4×3, 4×4, 2×2) and page counts.
- Add cards with quantity, then click slots to place them.
- Configurable auto-organise (drag rules to set priority).
- Print/export at real card size with cut lines.

## Good to know
- **Storage is per-browser.** Binders won't sync across devices. Fine for personal use; see DEPLOYMENT-GUIDE.md for adding accounts later.
- **Images:** the app hotlinks card art and falls back to a styled placeholder if an image is blocked. For a public app, re-host images (YGOPRODeck asks you not to hotlink at volume) — `npm run build-db` also writes `image-urls.txt` to help.
