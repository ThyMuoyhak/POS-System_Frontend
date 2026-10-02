# POS-System_Frontend

React point-of-sale front end for the **POS-System_backend** FastAPI service
(<https://github.com/ThyMuoyhak/POS-System_backend>): cash and ABA PayWay KHQR
checkout, catalogue and stock, orders, reporting, user administration and
settings. Created with Create React App (`react-scripts` 5) in plain JavaScript
with no extra UI libraries.

## Screens

| Screen | What it does |
| --- | --- |
| POS | cart, quantity/discount edits, cash or KHQR checkout with live payment polling |
| Products / Categories | catalogue, prices, stock adjustments |
| Orders | recent and older orders, receipt reprint, mark paid, cancel |
| Data | JSON backup download, import (merge or replace), factory reset |
| Security | users and roles, audit trail, own password change |
| Settings | merchant credentials, currency, decimals, ABA urls, demo mode |

## Requirements

* Node.js 18+ with npm (20 LTS is the safest pairing with `react-scripts` 5)
* The backend running on <http://127.0.0.1:8000>:
  `cd ../backend_api; python -m uvicorn main:app --port 8000`

## Setup

```powershell
npm install
copy .env.example .env      # adjust if your backend runs elsewhere
```

### Environment variables

| Variable | Value in `.env.example` | Meaning |
| --- | --- | --- |
| `REACT_APP_API_BASE` | `http://127.0.0.1:8000` | base url of the FastAPI backend, no trailing slash |
| `REACT_APP_ALLOW_MANUAL_CONFIRM` | `false` | shows the test-only "mark as paid" button in checkout; leave it off in production. The code falls back to `true` when the variable is unset. |

`.env` is git-ignored on purpose — every machine keeps its own copy. Create React
App inlines these values at build time, so restart `npm start` (or rebuild) after
changing them.

## Run

```powershell
npm start        # development server on http://localhost:3000
npm run build    # production bundle in build/
npm test         # jest through react-scripts
```

Sign in with an account from the backend. On a fresh backend the very first start
creates `admin` and writes its password to `backend_api/initial_admin_password.txt`;
change it from the Security screen afterwards.

## Deploy to Netlify

`netlify.toml` in the repository root carries the whole deployment, so the site
can be created without touching the build settings:

| Setting | Value | Why |
| --- | --- | --- |
| Build command | `npm ci && npm run build` | `npm ci` installs exactly what `package-lock.json` pins |
| Publish directory | `build` | Create React App output |
| `NODE_VERSION` | `20` | the LTS pairing `react-scripts` 5 is tested against |
| `REACT_APP_API_BASE` | `https://pos-system-backend-4aeo.onrender.com` | the deployed FastAPI service, no trailing slash |
| `REACT_APP_ALLOW_MANUAL_CONFIRM` | `false` | keeps the test-only "mark as paid" button out of production |
| `GENERATE_SOURCEMAP` | `false` | the source map is only useful to you |

Settings in `netlify.toml` win over the same setting in the Netlify UI, so edit
the file rather than the dashboard. Nothing here is a secret — Create React App
inlines `REACT_APP_*` values into the bundle, where anybody can read them.

### Option A — connect the Git repository (recommended)

1. Netlify → **Add new site → Import an existing project → GitHub** →
   `ThyMuoyhak/POS-System_Frontend`.
2. Branch `main`, **base directory empty** (the repository root *is* the front
   end); leave the build command and publish directory as the file sets them.
3. Deploy. Every push to `main` rebuilds and republishes the site.

### Option B — drag and drop a local build

```powershell
$env:REACT_APP_API_BASE='https://pos-system-backend-4aeo.onrender.com'
$env:REACT_APP_ALLOW_MANUAL_CONFIRM='false'
npm ci; npm run build
```

Then drop the `build` folder on <https://app.netlify.com/drop>. No variables are
supplied for you this way, so they must be set in the shell **before**
`npm run build` — Create React App's `.env` files do not override variables that
are already set.

### Finish the wiring on the backend

The browser enforces CORS, so the Render service has to name the Netlify origin.
On Render → your service → **Environment**, add (the origin must match exactly:
scheme and host, **no trailing slash**):

```ini
CORS_ORIGINS=https://glittery-pony-05abee.netlify.app
FRONTEND_BASE_URL=https://glittery-pony-05abee.netlify.app
ABA_SUCCESS_URL=https://glittery-pony-05abee.netlify.app/?payment=success
ABA_CANCEL_URL=https://glittery-pony-05abee.netlify.app/?payment=cancel
```

Save — Render redeploys by itself. The two ABA urls are where the gateway sends
the **customer's phone**, so a `localhost` value there means the customer never
comes back to the till. Still running the dev server? Keep both origins:

```ini
CORS_ORIGINS=https://glittery-pony-05abee.netlify.app,http://localhost:3000,http://127.0.0.1:3000
```

Deploy previews and branch deploys use their own origins
(`https://<deploy-id>--glittery-pony-05abee.netlify.app`); to let those in as well, set
`POS_CORS_ORIGIN_REGEX=^https://([a-z0-9-]+--)?glittery-pony-05abee\.netlify\.app$`.

### Check the deployment

1. The site opens on the sign-in screen, not on a CORS error.
2. DevTools → Network: `/api/auth/login` is sent to the Render host and answers
   `200`. "blocked by CORS policy" means `CORS_ORIGINS` does not list the origin
   the browser is on.
3. On a free Render instance the first request after ~15 idle minutes takes
   30-60 s while the service wakes up; sign-in simply looks slow that once.

### If the build fails

**`npm error code EUSAGE` / "`npm ci` can only install packages when your
package.json and package-lock.json ... are in sync"** — the lockfile drifted away
from what the dependency ranges allow. It has happened once here: `typescript` is
an optional peer of `react-scripts` (which asks for `^3.2.1 || ^4`), and an
`npm install` under Node 22+ (npm 11) floated it to `7.0.2`, while the npm 10 that
ships with Netlify's Node 20 still wants `4.9.5`. Netlify validates the lock
*before* installing, so the build stops there and the site keeps its previous
deploy. Re-pin the lock with the npm major Netlify uses, then push it:

```powershell
npx --yes npm@10 install --package-lock-only   # rewrites the lock, not node_modules
npx --yes npm@10 ci                            # proves Netlify's step will pass
```

**A variable in the Netlify UI disagrees with `netlify.toml`.** For builds the
file wins — Netlify documents that "environment variables set in `netlify.toml`
override environment variables set with the same key name using the Netlify UI,
CLI, and API" — so a stale duplicate is harmless until the day that line leaves
the file. Delete the duplicate in the UI, or give it the same value; `true` is
never the right value for `REACT_APP_ALLOW_MANUAL_CONFIRM` in production.

## Notes

* The UI stores the bearer token in `localStorage` and clears it on any 401, so a
  revoked or expired session drops straight back to the sign-in screen.
* `npm run build` output (`build/`) and `node_modules/` are never committed.
* Never put merchant secrets in `REACT_APP_*` variables: anything bundled into the
  front end is readable by anyone with the browser. The ABA signing secret belongs
  in the backend (`backend_api/.env`).
