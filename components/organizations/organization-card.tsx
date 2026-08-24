"use client"

import * as React from "react"
import Link from "next/link"
import {
  Building2,
  ChevronRight,
  Globe2,
  MoreHorizontal,
  Users,
} from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface Organization {
  id: string
  name: string
  slug?: string | null
  description?: string | null
  logoUrl?: string | null
  website?: string | null
  memberCount?: number
  projectCount?: number
  plan?: string | null
  createdAt?: string | Date | null
}

export interface OrganizationCardProps {
  organization: Organization
  href?: string
  showActions?: boolean
  onEdit?: (organization: Organization) => void
  onDelete?: (organization: Organization) => void
  className?: string
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function formatPlan(plan?: string | null) {
  if (!plan) return null

  return plan
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDate(date?: string | Date | null) {
  if (!date) return null

  const parsed = date instanceof Date ? date : new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed)
}

export function OrganizationCard({
  organization,
  href,
  showActions = true,
  onEdit,
  onDelete,
  className,
}: OrganizationCardProps) {
  const destination =
    href ??
    (organization.slug
      ? `/organizations/${organization.slug}`
      : `/organizations/${organization.id}`)

  const plan = formatPlan(organization.plan)
  const createdAt = formatDate(organization.createdAt)

  return (
    <Card
      className={[
        "group relative overflow-hidden transition-all",
        "hover:-translate-y-0.5 hover:shadow-md",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {organization.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organization.logoUrl}
                alt={`${organization.name} logo`}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">
                {getInitials(organization.name)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <CardTitle className="truncate">
              {organization.name}
            </CardTitle>

            {organization.slug && (
              <CardDescription className="truncate">
                @{organization.slug}
              </CardDescription>
            )}
          </div>
        </div>

        {showActions && (onEdit || onDelete) && (
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Actions for ${organization.name}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(organization)}>
                    Edit organization
                  </DropdownMenuItem>
                )}

                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDelete(organization)}
                    >
                      Delete organization
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {organization.description ? (
          <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
            {organization.description}
          </p>
        ) : (
          <p className="min-h-10 text-sm italic text-muted-foreground">
            No description provided.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {plan && (
            <Badge variant="secondary">
              {plan}
            </Badge>
          )}

          {organization.website && (
            <Badge variant="outline" className="gap-1">
              <Globe2 className="size-3" />
              Website
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4" />
              <span className="text-xs">Members</span>
            </div>

            <p className="mt-1 text-lg font-semibold">
              {organization.memberCount ?? 0}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="size-4" />
              <span className="text-xs">Projects</span>
            </div>

            <p className="mt-1 text-lg font-semibold">
              {organization.projectCount ?? 0}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-between border-t bg-muted/20">
        <div className="text-xs text-muted-foreground">
          {createdAt ? `Created ${createdAt}` : "Organization"}
        </div>

        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href={destination}>
            Open
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default OrganizationCard
