"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { OrgSwitcher } from "@/components/organizations/organization-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, X, LogOut, Settings as SettingsIcon } from "lucide-react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/projects", label: "Projects" },
  { href: "/dashboard/organizations", label: "Organizations" },
  { href: "/dashboard/settings", label: "Settings" },
];

function initials(name: string | null, email: string) {
  if (name) {
    return name
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function DashboardHeader({
  userName,
  userEmail,
  activeOrganizationId,
}: {
  userName: string | null;
  userEmail: string;
  activeOrganizationId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="bg-white border-b sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-8 min-w-0">
          {/* Mobile menu button */}
          <button
            type="button"
            className="sm:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/dashboard" className="font-bold tracking-tight shrink-0">
            AppFoundry
          </Link>

          <nav className="hidden sm:flex items-center gap-5 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition ${
                  isActive(link.href)
                    ? "text-black font-medium"
                    : "text-slate-600 hover:text-black"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <OrgSwitcher activeOrganizationId={activeOrganizationId} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-black/20"
                aria-label="Account menu"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {initials(userName, userEmail)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="truncate font-medium">{userName || "Account"}</div>
                <div className="truncate text-xs font-normal text-muted-foreground">
                  {userEmail}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="cursor-pointer">
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void handleSignOut();
                }}
                disabled={signingOut}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {signingOut ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile nav panel */}
      {mobileOpen && (
        <nav className="sm:hidden border-t bg-white px-4 py-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block px-2 py-2.5 text-sm rounded-lg ${
                isActive(link.href)
                  ? "bg-slate-100 font-medium text-black"
                  : "text-slate-600"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              void handleSignOut();
            }}
            className="block w-full text-left px-2 py-2.5 text-sm text-red-600 rounded-lg"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </nav>
      )}
    </header>
  );
}
