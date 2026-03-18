# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (HMR)
npm run build     # Production build → dist/
npm run lint      # ESLint validation
npm run preview   # Preview production build locally
```

No test runner is configured in this project.

## Architecture

**Stack:** React 19 + Vite, Supabase (auth + database), React Router v7, i18next (ES/EN/PT), Recharts, Stripe, QR code generation.

### Entry Points
- `src/main.jsx` → wraps app in `BrowserRouter`
- `src/App.jsx` (2,600 lines) → root component with two routes:
  - `/feedback` → public feedback form (`Feedback.jsx`)
  - `/*` → protected `AdminPanel` (requires Supabase auth session)

### Multi-Tenant Architecture
Every user belongs to a tenant. `src/hooks/useTenant.js` is the central hook — it resolves `tenant_id` from the `Usuarios` table for the logged-in user and stores it in localStorage (`saas_tenant_config`). A zero UUID triggers the onboarding wizard. Every Supabase query must include `tenant_id` for data isolation; Supabase RLS enforces this at the DB level.

### State Management
No Redux or Context API. `AdminPanel` in `App.jsx` owns all shared state (`session`, `rawData`, `stores`, `areas`, `filters`, `notifications`, `theme`, `masterMode`) and passes it as props. Filtering is done via chained `useMemo` hooks: date → store → area/sentiment/channel.

### Service Layer (`src/services/`)
Thin wrappers around Supabase queries. Each service is a plain JS module (not a class):
- `userService.js` — user CRUD + Supabase Auth sync via Edge Functions
- `storeService.js` — store management with store-area junction
- `areaService.js` — area catalog
- `configService.js` — snapshot/restore catalog state
- `kpiService.js` — monthly NPS/volume goals

### Key Database Tables
`Usuarios`, `Tiendas_Catalogo`, `Areas_Catalogo`, `Tienda_Areas` (junction), `Area_Preguntas`, `Feedback`, `Issues`, `Alerts`, `Metas_KPI`, `Config_Snapshots`, `Auditoria`

### Routing / Navigation
Path-based tab selection inside `AdminPanel` — `useLocation()` maps paths to active tabs. No nested `<Routes>`; navigation is `useNavigate()` calls that update the URL, which drives which panel renders.

### Feedback Collection Flow
Public URL: `{VITE_FEEDBACK_URL}/?tid=X&t=store_id&a=area_id&id_qr=W`
Device fingerprinting enforces a 12-hour cooldown (bypassed in master mode). `QRGenerator` in `AdminPanel` generates these URLs and prints QR codes.

### Theming & Styling
CSS custom properties in `src/index.css` for light/dark mode. Dark mode applied via `data-theme="dark"` on `document.documentElement`. Theme persisted in localStorage. Glassmorphism aesthetic in dark mode.

### Internationalization
`src/i18n/i18n.js` configures i18next with browser language detection; locales in `src/i18n/locales/` (en/es/pt). Use `useTranslation()` hook, `t('namespace.key')`.

### Plan Tiers
`src/config/planLimits.js` defines Starter/Growth/Pro/Enterprise limits (`maxStores`, `maxAreas`, `maxMonthlyResponses`, feature flags). Check these limits before adding features that affect resource caps.

## Environment Variables
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_FEEDBACK_URL       # URL of the public feedback app
VITE_STRIPE_PUBLISHABLE_KEY
```
See `.env.example` for the full list.
