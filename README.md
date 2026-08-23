# AppFoundry #
-----------------
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-20+-brightgreen)]()
[![Status](https://img.shields.io/badge/status-alpha-orange)]()

AI App-Making Platform — turn ideas into production-ready, monetizable apps using natural language.

AppFoundry helps creators, founders, and teams ship full‑stack applications faster using AI-assisted planning, scaffolding, coding, testing, and deployment — while preserving true code ownership and exportability.

Table of contents
- [Why AppFoundry?](#why-appfoundry)
- [Features (MVP)](#features-mvp)
- [Tech stack (MVP)](#tech-stack-mvp)
- [Project structure](#project-structure)
- [Quick start (Development)](#quick-start-development)
  - [Prerequisites](#prerequisites)
  - [Local setup](#local-setup)
  - [Database](#database)
  - [Run the app](#run-the-app)
- [Environment variables](#environment-variables)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)
- [Contact](#contact)

Why AppFoundry?
- Multi-agent workflows that plan, scaffold, code, test, and iterate full-stack applications.
- True code ownership — projects are exportable source code that creators control.
- Built-in multi-tenancy for organizations, workspaces, and team collaboration.
- Marketplace for templates, components, and monetization tools.

Features (MVP)
- Project scaffolding and templates
- Authentication and organization-level access control
- PostgreSQL persistence via Prisma
- Tailwind CSS + shadcn/ui primitives
- AI-assisted code generation and developer workflows (in progress)

Tech stack (MVP)
- Framework: Next.js (App Router)
- Auth & multi-tenancy: Better Auth + organization plugin (planned integration)
- Database: PostgreSQL + Prisma
- UI: Tailwind CSS + shadcn/ui
- Language: TypeScript
- Storage: Cloudflare R2 (planned)
- Billing: Stripe (planned)

Project structure
```
appfoundry/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (sign-in, sign-up)
│   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── projects/
│   │   ├── organizations/
│   │   └── settings/
│   ├── api/                # API routes (e.g., auth handlers)
│   ├── layout.tsx
│   └── page.tsx            # Landing or marketing page
├── components/             # UI components (shadcn-style)
│   ├── ui/
│   ├── auth/
│   └── organizations/
├── lib/                    # Helpers, db client, auth config
│   ├── auth.ts
│   ├── auth-client.ts
│   ├── db.ts
│   └── utils.ts
├── prisma/                 # Prisma schema & migrations
│   └── schema.prisma
├── public/
├── .env.example
├── package.json
└── README.md
```

Quick start (Development)

Prerequisites
- Node.js 20+
- npm or pnpm
- PostgreSQL (local or remote)
- Better Auth account / credentials (for auth integration)

Local setup

1. Clone the repo
```bash
git clone https://github.com/erikg713/appfoundry.git
cd appfoundry
```

2. Install dependencies
```bash
npm install
# or
# pnpm install
```

3. Copy and configure environment variables
```bash
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL and Better Auth secrets
```

Environment variables
(keep this list in sync with `.env.example`) — examples:
- DATABASE_URL=postgresql://user:pass@localhost:5432/appfoundry
- BETTER_AUTH_CLIENT_ID=...
- BETTER_AUTH_CLIENT_SECRET=...
- NEXT_PUBLIC_APP_URL=http://localhost:3000

Database
- For development, use Prisma:
```bash
npx prisma migrate dev --name init
# or if you prefer to push schema without migrations:
# npx prisma db push
```
- To inspect the DB schema:
```bash
npx prisma studio
```

Run the app
```bash
npm run dev
# or
# pnpm dev
```
Open http://localhost:3000

Testing
- Add tests and run:
```bash
npm test
# or your chosen test runner (Vitest/Jest)
```
(There are no tests yet — adding tests is on the roadmap.)

Deployment
- Recommended: Vercel for Next.js (App Router) — configure environment variables in the Vercel dashboard.
- Alternatives: Docker + any cloud provider.
- Ensure Prisma migrations run in your deployment pipeline or use a managed DB with migrations applied prior to release.

Roadmap
- [x] Repo scaffold
- [ ] Better Auth + organization multi-tenancy
- [ ] Project model + dashboard
- [ ] Basic AI chat → code generation
- [ ] Multi-agent pipeline
- [ ] Deploy & preview environments
- [ ] Marketplace for templates & components
- [ ] Billing, payments & creator monetization

Contributing
- Welcome! Please:
  1. Open an issue for large changes or feature requests.
  2. Create a branch per feature/fix and open a PR.
  3. Add tests for non-trivial changes.
- Consider adding CONTRIBUTING.md, CODE_OF_CONDUCT.md, and PR templates (I can add those for you).

Security
- For sensitive issues, please use a private security disclosure channel (e.g., a security email) or open a GitHub Security Advisory.
- Do not commit secrets or .env files.

Suggestions & housekeeping
- Remove duplicate or experimental content from the README (this file).
- Keep `.env.example` up to date with required variables and example values.
- Add CI (GitHub Actions) to run lint, typecheck, tests, and Prisma migrations.
- Add a small demo screenshot or link to a live preview if available.
- Add badges for CI, coverage, and license.

License
MIT (for now) — see LICENSE file.

Contact
For questions, bug reports, or feature requests, open a GitHub issue or create a discussion in this repository.
```
