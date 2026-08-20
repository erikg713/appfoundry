# AppFoundry

AI App-Making Platform — Turn ideas into production-ready, monetizable apps with natural language.

AppFoundry helps creators, founders, and teams ship full-stack applications faster using AI-assisted planning, coding, testing, and deployment while preserving true code ownership and exportability.

Why AppFoundry?

- Multi-agent workflows that plan, scaffold, code, and test full-stack apps.
- True code ownership: exportable project source so creators retain control.
- Built-in multi-tenancy for organizations and workspaces.
- Marketplace for templates, components, and monetization tools.

Features (MVP)

- Project scaffolding and templates
- Authentication and organization-level access
- PostgreSQL persistence via Prisma
- Tailwind CSS + shadcn/ui for UI primitives
- AI-assisted code generation and developer workflows (coming)

Tech stack (MVP)

- Framework: Next.js 15 (App Router)
- Auth & Multi-tenancy: Better Auth + Organization plugin
- Database: PostgreSQL + Prisma
- UI: Tailwind CSS + shadcn/ui
- File storage: Cloudflare R2 (planned)
- Payments & billing: Stripe (planned)
- AI: Multi-agent orchestration (roadmap)

Quick start (Development)

Prerequisites

- Node.js 20+ and npm or pnpm
- PostgreSQL (local or remote)
- A Better Auth account / secrets (for auth integration)

Local setup

1. Install dependencies

```bash
npm install
# or
# pnpm install
```

2. Copy and configure environment variables

```bash
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL and Better Auth secrets
```

3. Prepare the database

```bash
npx prisma db push
# or run migrations if you prefer
# npx prisma migrate dev
```

4. Run the dev server

```bash
npm run dev
# or
# pnpm dev
```

Project structure

```
appfoundry/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (sign-in, sign-up)
│   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── projects/       # User projects
│   │   ├── organizations/  # Org management
│   │   └── settings/
│   ├── api/                # API routes
│   │   └── auth/           # Better Auth handler
│   ├── layout.tsx
│   └── page.tsx            # Landing page
├── components/             # UI components
│   ├── ui/                 # shadcn components
│   ├── auth/
│   └── organizations/
├── lib/
│   ├── auth.ts             # Better Auth config
│   ├── auth-client.ts      # Client-side auth
│   ├── db.ts               # Prisma client
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── public/
├── .env.example
├── package.json
└── README.md
```

Configuration

- .env.example contains the environment variables used by the app. At minimum set:
  - DATABASE_URL — Postgres connection string
  - BETTER_AUTH_CLIENT_ID / BETTER_AUTH_CLIENT_SECRET (or equivalent)

Development notes

- The app uses Prisma for DB schema; prefer `prisma migrate` for production workflows.
- Tailwind CSS is configured for JIT; update the config if adding new directories.
- UI primitives live under `components/ui` (shadcn-style).

Roadmap

- [x] Repo scaffold
- [ ] Better Auth + Organization multi-tenancy
- [ ] Project model + dashboard
- [ ] Basic AI chat → code generation
- [ ] Multi-agent pipeline
- [ ] Deploy & preview environments
- [ ] Marketplace for templates & components
- [ ] Billing, payments & creator monetization

Contributing

Contributions are welcome. Suggested next steps:

- Open an issue to propose big changes or features.
- Submit a branch-based pull request with a clear description and tests for non-trivial behavior.

If you'd like, I can add CONTRIBUTING.md, CODE_OF_CONDUCT.md, and a PR template.

License

MIT (for now)

Contact

For questions or to collaborate: create an issue or reach out to the repository owner.
# AppFoundry

**AI App-Making Platform** — turn ideas into production-ready, monetizable apps with natural language.

AppFoundry helps creators, founders, and teams ship full-stack applications faster using AI-assisted planning, coding, testing, and deployment, while preserving true code ownership and exportability.

## Why AppFoundry?

- **Multi-agent workflows** that plan, scaffold, code, test, and iterate full-stack applications.
- **True code ownership** — every project is fully exportable source code the creator controls.
- **Built-in multi-tenancy** for organizations, workspaces, and team collaboration.
- **Marketplace** for templates, components, and monetization tools so creators can ship and earn.

## Features (MVP)

- Project scaffolding + templates
- Authentication + organization-level access control
- PostgreSQL persistence via Prisma
- Tailwind CSS + shadcn/ui component library
- AI-assisted code generation and developer workflows *(in progress)*

## Roadmap

- [ ] Project model + dashboard
- [ ] Basic AI chat → code generation
- [ ] Multi-agent pipeline
- [ ] Deploy & preview environments
- [ ] Marketplace for templates & components
- [ ] Billing, payments & creator monetization

## Tech Stack (MVP)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Auth | Better Auth (organization multi-tenancy) |
| Database | PostgreSQL + Prisma |
| UI | Tailwind CSS + shadcn/ui |
| Language | TypeScript |

## Project Structure

```
appfoundry/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (sign-in, sign-up)
│   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── projects/       # User projects
│   │   ├── organizations/  # Org management
│   │   └── settings/
│   ├── api/                # API routes
│   │   └── auth/           # Better Auth handler
│   ├── layout.tsx
│   └── page.tsx             # Landing page
├── components/              # UI components
│   ├── ui/                  # shadcn components
│   ├── auth/
│   └── organizations/
├── lib/
│   ├── auth.ts               # Better Auth config
│   ├── auth-client.ts        # Client-side auth
│   ├── db.ts                  # Prisma client
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── public/
├── .env.example
├── package.json
└── README.md
```

## Getting Started

1. Clone the repository.
2. Copy `.env.example` to `.env` and fill in the required values.
3. Install dependencies: `npm install` (or `pnpm` / `yarn`).
4. Run database migrations: `npx prisma migrate dev`.
5. Start the development server: `npm run dev`.

## Contributing

Contributions are welcome.

- Open an issue to propose larger features or architectural changes.
- Submit a branch-based pull request with a clear description and tests for non-trivial behavior.

## License

MIT (for now)

## Contact

For questions, bug reports, or feature requests, open a GitHub issue or start a discussion in the repo.
