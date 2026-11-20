# Fairway · Golf scorecard

A phone-first golf notebook built with React, TypeScript, Vite and plain CSS.
No account, backend, router or UI framework. Course pars belong to each tee.

## Run locally

Use Node 20 LTS (see `.nvmrc`):

```sh
nvm install
nvm use
npm ci
npm run dev
```

```sh
npm run lint
npm test -- --run
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

`npm test` starts Vitest watch mode. Preview serves the production build, not source.

## On the course

1. Add a 9- or 18-hole course; name its tees and set each tee's pars (3–6) and optional yardages.
2. Start a round with a course, tee and optional comma-separated partners.
3. Use +/- to score, or **Mark par**. On an unscored hole +/- starts from par, so one tap records a birdie/bogey. Clear hole restores an unplayed score.
4. Tap **PAR** to edit the round's par. Optionally also update the underlying course tee.
5. Toggle **Scorecard** for Out/In/Total and notes. Totals include scored holes only; E means even. Nine-hole rounds show Out/Total, not an empty In.

Changes auto-save to this browser's localStorage. Round pars are copied at start:
later course edits do not change old rounds. Course deletion keeps rounds; their
course/tee labels and yardages are then unavailable. A storage error is shown
when writes fail. There is no sync or export yet: clearing browser data deletes
the notebook. Private browsing may not retain it.

## Install / PWA-lite

The relative manifest, PNG icons, viewport, theme color and Apple standalone
metadata support Add to Home Screen (Safari: Share → Add to Home Screen;
Chrome: its install/add shortcut menu). Serve over HTTPS outside localhost.
This is intentionally PWA-lite: there is no service worker or guaranteed
offline cold-start. Open the app before losing connectivity and keep the tab
open; scoring and saving do not need a network. Fonts fall back to system fonts.

## GitHub Pages

Create a GitHub repository named `golf-scorecard`, add it as a remote, then
push/merge to main when ready. In repository Settings → Pages choose **GitHub
Actions** as source. `.github/workflows/deploy.yml` builds on main, uploads
`dist`, and deploys using the official Pages actions. PR CI runs lint, tests,
and a build. No remote is configured by this scaffold.

Base is configurable, never hardcoded in Vite:

```sh
VITE_BASE=/golf-scorecard/ npm run build
# or (CLI takes precedence)
npm run build -- --base=/golf-scorecard/
```

Use `/` for a root/custom-domain deployment. Navigation is React state, so
there are no nested URLs or Pages refresh 404s. Refresh returns home, with
saved rounds ready to resume.

## Where to extend

- `src/types.ts`: course, tee, round and notebook interfaces.
- `src/storage.ts`: versioned key and load/save boundary; replace with an API
  or add migrations here. v1 currently supports this app's own saved shape.
- `src/scoring.ts`: pure scoring/segment math; tests cover nulls and Out/In.
- `src/App.tsx`: home, new-round form, state navigation and persistence.
- `src/CourseEditor.tsx`: course/tee grid and copy helper.
- `src/Scorecard.tsx`: hole scoring, round par overrides and table summary.
- `src/index.css`, `src/App.css`: global foundation and screen styles.
- `public/manifest.webmanifest`: installation metadata; keep paths relative.

Good next additions: JSON export/import, course search, handicaps, an offline
service worker, and a migration/validation layer before syncing external data.
