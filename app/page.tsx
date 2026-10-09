"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Users,
  Wallet,
  ArrowRight,
  Check,
  ChevronDown,
  Bot,
  FileCode2,
  Rocket,
} from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Describe it, get an app",
    text: "Type what you want in plain English. A pipeline of AI agents plans the architecture, writes the code, adds tests, and prepares deployment — streaming progress live.",
  },
  {
    icon: Users,
    title: "Multi-tenant workspaces",
    text: "Organizations with owners, admins, and members. Personal projects stay private; team projects stay shared. Switch workspaces in one click.",
  },
  {
    icon: Wallet,
    title: "You own the output",
    text: "Every generation produces real source files you can browse, copy, and take anywhere. No lock-in, no black boxes — the code is yours.",
  },
  {
    icon: Bot,
    title: "Five-agent pipeline",
    text: "Planner, Architect, Coder, Tester, and Deployer agents each do their job in sequence, with live output you can watch as it happens.",
  },
  {
    icon: FileCode2,
    title: "Full-stack scaffolds",
    text: "Generations produce complete project scaffolds — routes, data models, and UI — ready to extend in your own editor.",
  },
  {
    icon: Rocket,
    title: "Built to ship",
    text: "Projects move from draft to generating to ready with clear statuses, generation history, and per-run file browsers.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Create a project",
    text: "Give it a name and describe the app you want in a few sentences. That's the whole spec.",
  },
  {
    n: "2",
    title: "Watch agents build it",
    text: "Planner, Architect, Coder, Tester, and Deployer stream their work live — plan, code, tests, deploy notes.",
  },
  {
    n: "3",
    title: "Take the code",
    text: "Browse every generated file, copy what you need, and keep building. It's yours.",
  },
];

const EXAMPLES = [
  {
    title: "SaaS dashboard",
    prompt: "A subscription analytics dashboard with MRR charts, churn tables, and team workspaces.",
    tag: "Analytics",
  },
  {
    title: "Booking site",
    prompt: "A booking site for a dog-grooming business: services, calendar slots, and email confirmations.",
    tag: "Marketplace",
  },
  {
    title: "Internal CRM",
    prompt: "A simple CRM with contacts, deals, and a pipeline board. Teammates can be invited by email.",
    tag: "Internal tool",
  },
  {
    title: "Portfolio + blog",
    prompt: "A designer portfolio with case-study pages and a markdown blog, dark mode included.",
    tag: "Content",
  },
];

const FAQS = [
  {
    q: "What do I actually get from a generation?",
    a: "A set of real source files — routes, components, data models — produced by a five-agent pipeline (Planner, Architect, Coder, Tester, Deployer). You can browse every file in the workspace and copy the code out.",
  },
  {
    q: "Do I need to know how to code?",
    a: "No. You describe what you want in plain English and the agents do the building. If you do code, you can take the scaffold further in your own editor.",
  },
  {
    q: "How do organizations work?",
    a: "Create a workspace for your team, invite members by email, and assign admin or member roles. Projects live inside a workspace — or in your personal space if you prefer to work solo.",
  },
  {
    q: "Is there a limit on generations?",
    a: "Yes — to keep AI costs sustainable, each account gets 10 generations per hour and 50 per day. That's plenty for real building.",
  },
  {
    q: "Who owns the generated code?",
    a: "You do. Everything the agents produce is yours to use, modify, and ship — no lock-in.",
  },
  {
    q: "What does it cost?",
    a: "AppFoundry is free while in this early phase. If paid plans arrive later, early builders will hear first.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-sm sm:text-base">{q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight">AppFoundry</div>
          <nav className="flex items-center gap-4 sm:gap-6">
            <Link
              href="#how-it-works"
              className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-black"
            >
              How it works
            </Link>
            <Link
              href="#faq"
              className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-black"
            >
              FAQ
            </Link>
            <Link href="/sign-in" className="text-sm font-medium hover:underline">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-medium bg-black text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100 rounded-full px-3 py-1 mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              AI agents that build full-stack apps
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-900 leading-tight">
              Build apps with AI.
              <br />
              <span className="text-slate-500">Own them completely.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed">
              AppFoundry turns natural language into production-ready full-stack
              apps. Describe what you want, watch five AI agents plan, code, and
              test it live — then take the source and ship it.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/sign-up"
                className="w-full sm:w-auto inline-flex items-center justify-center bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition"
              >
                Start building free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium border border-slate-200 hover:bg-slate-50 transition"
              >
                How it works
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> Real source code
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> Team workspaces
              </span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">
            Everything you need to go from idea to app
          </h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border bg-white">
                <f.icon className="h-6 w-6 text-violet-600 mb-3" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-slate-600 text-sm leading-relaxed">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-y bg-slate-50/80"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">
              From prompt to app in three steps
            </h2>
            <div className="mt-10 grid sm:grid-cols-3 gap-5">
              {STEPS.map((s) => (
                <div key={s.n} className="p-6 rounded-2xl border bg-white">
                  <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm mb-4">
                    {s.n}
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-2 text-slate-600 text-sm leading-relaxed">
                    {s.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Examples */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">
            What people build with AppFoundry
          </h2>
          <p className="mt-3 text-center text-slate-600 max-w-xl mx-auto text-sm sm:text-base">
            Real prompts, real scaffolds. Try one of these ideas as your first
            project.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 gap-5">
            {EXAMPLES.map((e) => (
              <div key={e.title} className="p-6 rounded-2xl border bg-white">
                <span className="inline-block text-xs font-medium bg-slate-100 text-slate-600 rounded-full px-2.5 py-0.5 mb-3">
                  {e.tag}
                </span>
                <h3 className="font-semibold">{e.title}</h3>
                <p className="mt-2 text-slate-600 text-sm leading-relaxed italic">
                  “{e.prompt}”
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition"
            >
              Build yours now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t bg-slate-50/80">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center">
              Questions, answered
            </h2>
            <div className="mt-10 space-y-3">
              {FAQS.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid gap-8 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="font-bold text-lg tracking-tight">AppFoundry</div>
            <p className="mt-2 text-sm text-slate-500 max-w-xs">
              Natural-language app building with AI agents. Describe it, watch
              it get built, own the code.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Product</h3>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <Link href="#features" className="hover:text-black">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="hover:text-black">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="#faq" className="hover:text-black">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Account</h3>
            <ul className="space-y-2 text-sm text-slate-500">
              <li>
                <Link href="/sign-in" className="hover:text-black">
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/sign-up" className="hover:text-black">
                  Sign up
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/erikg713/appfoundry"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-black"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t py-6 text-center text-sm text-slate-400">
          © {new Date().getFullYear()} AppFoundry. Built for builders who want ownership.
        </div>
      </footer>
    </div>
  );
}
