# TripLoom Frontend

Frontend web application for **TripLoom**, an AI-assisted personalized travel itinerary planning and local service booking platform tailored for destinations in Da Nang and Hoi An, Vietnam.

## Project Overview

TripLoom Frontend implements the full customer, member, staff, and administrator web interfaces as a modular TypeScript Single-Page Application (SPA). The codebase is decoupled from storage implementation through a dual-adapter architecture (`mock` and `api`), allowing standalone interactive execution with seeded local fixtures during frontend development and direct integration with a Python/Django REST backend when API mode is enabled.

## Key Features

- **Public Destination Discovery & Services**: Curated home showcase with seasonal monthly recommendations, destination search and filtering by keyword, region, and category, destination detail galleries, public reviews, and local bookable travel services.
- **Authentication & Role-Based Access**: Customer registration with 6-digit email OTP verification, login, forgot/reset password flow, separate backoffice portal login, and staff invitation account activation.
- **AI Trip Planning & Itineraries**: Multi-step trip wizard, ranked destination recommendations, day-by-day itinerary generation, manual activity reordering/editing, single-day regeneration, itinerary saving, and contextual AI chat assistant.
- **Service Booking & SePay Payment Flow**: Booking confirmation with 15-minute reservation holds, live capacity checks, QR transfer payment screen with countdown timer, payment result tracking, and customer order cancellation rules.
- **Member Workspace**: Personal overview dashboard, saved favorites, submitted review management, booking history with detailed timeline, and read-first profile/password management.
- **Operations & Admin Backoffice**: KPI analytics dashboard, destination/category/service CRUD and visibility toggles, custom local multi-image uploader, booking support notes, SePay webhook reconciliation, review moderation, staff RBAC permission management, and system audit logs.

## Technology Stack

- **Language**: TypeScript 5 (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Bundler & Dev Server**: Vite 6
- **Styling**: Tailwind CSS 3 (`@tailwindcss/forms`) + CSS custom properties (`src/shared/styles/tokens.css`)
- **Testing**: Vitest 2 (unit and domain workflow tests)
- **Tooling**: PostCSS, Autoprefixer, GitHub Actions CI

## System Architecture

The application enforces strict separation between UI rendering, business services, API contracts, and data adapters:

```text
Pages & Shared Components (src/features/*/pages, src/shared/components)
        |
        v
Feature Services (src/features/*/*.service.ts)
        |
        v
DataSourceAdapter Interface (src/api/adapters/data-source.ts)
        |
        +---> mockAdapter (VITE_DATA_SOURCE=mock) -> LocalStorage Mock DB & Handlers
        |
        +---> apiAdapter  (VITE_DATA_SOURCE=api)  -> httpRequest (fetch + CSRF + cookies)
```

Key architectural principles:
- Route protection (`public`, `guest-only`, `authenticated`, `backoffice`, `permission`) is declared centrally in `src/app/bootstrap.ts` and enforced via `src/app/route-guards.ts`.
- UI components never calculate authoritative prices, permissions, payment status, or OTP deadlines independently in `api` mode.
- When `VITE_DATA_SOURCE=api` is configured, `api-adapter.ts` never silently falls back to mock data upon network or server failure.

## Project Structure

```text
.
├── .github/workflows/ci.yml      # GitHub Actions pipeline (typecheck, test, build)
├── docs/
│   ├── api-contract.md           # Proposed REST API contract for Django backend
│   ├── qa-report.md              # QA verification and audit summary
│   └── screen-map.json           # Stitch screen-to-route inventory mapping
├── public/
│   ├── favicon.svg
│   └── images/                   # Local SVG destination and service illustrations
├── src/
│   ├── api/
│   │   ├── adapters/             # data-source.ts, mock-adapter.ts, api-adapter.ts
│   │   ├── contracts/            # Shared TypeScript request/response interfaces
│   │   ├── errors.ts             # Normalized AppError mapping
│   │   └── http-client.ts        # Fetch wrapper with credentials, CSRF & timeouts
│   ├── app/                      # bootstrap.ts, router.ts, route-guards.ts, session-store.ts
│   ├── config/                   # constants.ts, env.ts
│   ├── features/                 # Feature modules (auth, profile, destinations, services,
│   │                             # trip-planning, itineraries, chat, favorites, reviews,
│   │                             # bookings, payments, admin-catalog, staff, system)
│   ├── layouts/                  # PublicShell, MemberShell, BackofficeShell
│   ├── mocks/                    # Mock seed fixtures, LocalStorage DB & domain handlers
│   ├── shared/                   # Reusable components, custom selects, styles & utilities
│   └── main.ts                   # Application bootstrap entrypoint
├── tests/                        # Vitest business logic & guard test suites
├── .env.example                  # Sample environment variables
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Getting Started

### Prerequisites

- **Node.js** >= 20.x (tested with Node.js v20+ / CI on Node 20)
- **npm** >= 10.x (on Windows PowerShell, use `npm.cmd` if execution policy restricts `npm.ps1`)

## Installation

```bash
git clone https://github.com/BiGatess/TripLoom-FE.git
cd TripLoom-FE
npm ci
```

## Environment Variables

Copy `.env.example` to `.env.local` for local configuration:

```env
# Data adapter mode: mock | api
VITE_DATA_SOURCE=mock

# Backend Django REST API base URL (used when VITE_DATA_SOURCE=api)
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Django CSRF cookie and header configuration
VITE_CSRF_COOKIE_NAME=csrftoken
VITE_CSRF_HEADER_NAME=X-CSRFToken

# Enables floating developer simulation tools (mock mode only)
VITE_ENABLE_DEV_TOOLS=true
```

Do not commit `.env` or `.env.local` files containing environment-specific secrets or endpoints.

## Development

Start the Vite development server (default `http://localhost:5173`):

```bash
npm run dev
```

Available verification commands:

```bash
# Strict TypeScript type checking
npm run typecheck

# Run Vitest unit test suite (7 test files, 21 tests)
npm test

# Watch mode for tests
npm run test:watch
```

### Mock Mode & Demo Accounts

When running with `VITE_DATA_SOURCE=mock`, the in-browser **Dev Tools** panel (bottom-left corner) provides controls to reset seeded `localStorage` data, inspect mock OTP codes, simulate SePay webhook events, and toggle network/AI/email failure flags.

| Role | ID | Email | Password | Permissions / Status |
|---|---|---|---|---|
| Customer | `USR001` | `minh.anh@example.com` | `TripLoom@123` | Full member flows (`LT001`, `BK001`, `BK002`, `RV001`) |
| Administrator | `ADM001` | `admin@triploom.vn` | `Admin@123` | Full backoffice access |
| Active Staff | `NV001` | `ha.tran@triploom.vn` | `Staff@123` | `STAFF_DESTINATION`, `STAFF_REVIEW` |
| Active Staff | `NV004` | `yen.do@triploom.vn` | `Staff@123` | `STAFF_PAYMENT_VIEW` |
| Invited Staff | `NV002` | `bao.le@triploom.vn` | *(set at `/kich-hoat-nhan-vien`)* | `INVITED` (initial activation code: `246810`) |
| Locked Staff | `NV003` | `huy.pham@triploom.vn` | `Staff@123` | `LOCKED` (login denied until unlocked) |

## Production Build

Run strict typechecking and build the optimized static bundle into `dist/`:

```bash
npm run build
```

Preview the production bundle locally (`http://localhost:4173`):

```bash
npm run preview
```

Because navigation relies on the browser History API, production static web servers (such as Nginx or Django static fallback) should route unknown non-asset paths to `index.html`:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Backend Integration

Set `VITE_DATA_SOURCE=api` and point `VITE_API_BASE_URL` to your Django REST backend. All requests automatically pass through `src/api/http-client.ts` with `credentials: 'include'`, CSRF token extraction, request timeouts, abort signal support, and standardized `AppError` handling. Endpoint schemas, enums, and ownership expectations are documented in [docs/api-contract.md](docs/api-contract.md).

## Git Branching Strategy

This repository follows a streamlined Git Flow model:

- `main`: Production-ready, verified releases tagged with Semantic Versioning (e.g., `v1.0.0`).
- `develop`: Integration branch where completed feature, fix, documentation, and CI branches are tested together before release.
- `feature/*`, `fix/*`, `refactor/*`, `docs/*`, `chore/*`, `test/*`, `ci/*`: Scoped working branches created from `develop` using Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `ci:`, `refactor:`).

All pushes and pull requests targeting `develop` or `main` are validated by GitHub Actions (`.github/workflows/ci.yml`) running `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
