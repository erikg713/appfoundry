# AppFoundry

**AI App Making Platform** — Turn ideas into production-ready, monetizable apps with natural language.

Better than Emergent, Base44, and Replit in ownership, reliability, and creator monetization.

## Vision

- Multi-agent AI that plans, codes, tests, and deploys full-stack apps
- True code ownership + export
- Built-in multi-tenancy (organizations / workspaces)
- Marketplace for templates & components
- Monetization tools for the apps you ship

## Tech Stack (MVP)

- **Framework**: Next.js 15 (App Router)
- **Auth & Multi-tenancy**: Better Auth + Organization plugin
- **Database**: PostgreSQL + Prisma
- **UI**: Tailwind CSS + shadcn/ui
- **File Storage**: Cloudflare R2 (planned)
- **Payments**: Stripe (planned)
- **AI**: Multi-agent orchestration (coming next)

## Getting Started

```bash
npm install
cp .env.example .env.local
# Fill in DATABASE_URL and Better Auth secrets
npx prisma db push
npm run dev
```

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

## Roadmap

- [x] Repo scaffold
- [ ] Better Auth + Organization multi-tenancy
- [ ] Project model + dashboard
- [ ] Basic AI chat → code generation
- [ ] Multi-agent pipeline
- [ ] Deploy + preview
- [ ] Marketplace
- [ ] Billing & credits

## License

MIT (for now)
