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

## Notes

* The UI stores the bearer token in `localStorage` and clears it on any 401, so a
  revoked or expired session drops straight back to the sign-in screen.
* `npm run build` output (`build/`) and `node_modules/` are never committed.
* Never put merchant secrets in `REACT_APP_*` variables: anything bundled into the
  front end is readable by anyone with the browser. The ABA signing secret belongs
  in the backend (`backend_api/.env`).
