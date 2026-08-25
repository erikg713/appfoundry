"use client"

import * as React from "react"
import {
  AlertTriangle,
  Globe,
  Loader2,
  Lock,
  Save,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

export type OrganizationVisibility = "private" | "public"

export interface OrganizationSettingsData {
  id: string
  name: string
  slug: string
  description?: string | null
  website?: string | null
  visibility?: OrganizationVisibility
}

export interface OrganizationSettingsProps {
  organization: OrganizationSettingsData
  canManage?: boolean
  onSave?: (
    values: OrganizationSettingsData,
  ) => Promise<void> | void
  onDelete?: (
    organization: OrganizationSettingsData,
  ) => Promise<void> | void
  className?: string
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function OrganizationSettings({
  organization,
  canManage = false,
  onSave,
  onDelete,
  className,
}: OrganizationSettingsProps) {
  const [values, setValues] =
    React.useState<OrganizationSettingsData>({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description ?? "",
      website: organization.website ?? "",
      visibility: organization.visibility ?? "private",
    })

  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteConfirmation, setDeleteConfirmation] =
    React.useState("")

  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const updateValue = <
    K extends keyof OrganizationSettingsData,
  >(
    field: K,
    value: OrganizationSettingsData[K],
  ) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }))

    setSuccess(false)
    setError(null)
  }

  const handleSave = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (!onSave) return

    const name = values.name.trim()
    const slug = slugify(values.slug)

    if (name.length < 2) {
      setError(
        "Organization name must be at least 2 characters.",
      )
      return
    }

    if (!slug) {
      setError("Organization slug is required.")
      return
    }

    if (
      values.website &&
      !/^https?:\/\/.+/i.test(values.website.trim())
    ) {
      setError(
        "Website must be a valid HTTP or HTTPS URL.",
      )
      return
    }

    setError(null)
    setSuccess(false)
    setIsSaving(true)

    try {
      const nextValues: OrganizationSettingsData = {
        ...values,
        name,
        slug,
        description:
          values.description?.trim() || null,
        website:
          values.website?.trim() || null,
      }

      setValues(nextValues)

      await onSave(nextValues)
      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save organization settings.",
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    if (deleteConfirmation !== organization.name) {
      setError(
        "Enter the exact organization name to confirm deletion.",
      )
      return
    }

    setError(null)
    setIsDeleting(true)

    try {
      await onDelete(organization)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete organization.",
      )
      setIsDeleting(false)
    }
  }

  return (
    <div
      className={[
        "space-y-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!canManage && (
        <Alert>
          <Lock className="size-4" />

          <AlertTitle>Read-only settings</AlertTitle>

          <AlertDescription>
            You do not have permission to modify this
            organization.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />

          <AlertTitle>Something went wrong</AlertTitle>

          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <Save className="size-4" />

          <AlertTitle>Settings saved</AlertTitle>

          <AlertDescription>
            Your organization settings have been updated.
          </AlertDescription>
        </Alert>
      )}

      {/* General settings */}
      <Card>
        <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle>General</CardTitle>

            <CardDescription>
              Update your organization's basic information.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="organization-name">
                Organization name
              </Label>

              <Input
                id="organization-name"
                value={values.name}
                onChange={(event) =>
                  updateValue(
                    "name",
                    event.target.value,
                  )
                }
                disabled={!canManage || isSaving}
                placeholder="Acme Labs"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization-slug">
                Organization slug
              </Label>

              <Input
                id="organization-slug"
                value={values.slug}
                onChange={(event) =>
                  updateValue(
                    "slug",
                    slugify(event.target.value),
                  )
                }
                disabled={!canManage || isSaving}
                placeholder="acme-labs"
                maxLength={100}
              />

              <p className="text-xs text-muted-foreground">
                Your organization slug is used in AppFoundry
                URLs.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization-description">
                Description
              </Label>

              <Textarea
                id="organization-description"
                value={values.description ?? ""}
                onChange={(event) =>
                  updateValue(
                    "description",
                    event.target.value,
                  )
                }
                disabled={!canManage || isSaving}
                placeholder="Describe what this organization does."
                maxLength={500}
                rows={4}
              />

              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground">
                  {(values.description ?? "").length}/500
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization-website">
                Website
              </Label>

              <div className="relative">
                <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  id="organization-website"
                  type="url"
                  value={values.website ?? ""}
                  onChange={(event) =>
                    updateValue(
                      "website",
                      event.target.value,
                    )
                  }
                  disabled={!canManage || isSaving}
                  placeholder="https://example.com"
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="justify-end border-t">
            <Button
              type="submit"
              disabled={!canManage || isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}

              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Visibility */}
      <Card>
        <CardHeader>
          <CardTitle>Visibility</CardTitle>

          <CardDescription>
            Control who can discover your organization.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="organization-visibility">
              Organization visibility
            </Label>

            <Select
              value={values.visibility}
              onValueChange={(value) =>
                updateValue(
                  "visibility",
                  value as OrganizationVisibility,
                )
              }
              disabled={!canManage || isSaving}
            >
              <SelectTrigger
                id="organization-visibility"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4" />

                    <div>
                      <div className="font-medium">
                        Private
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Only organization members can access it.
                      </div>
                    </div>
                  </div>
                </SelectItem>

                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Globe className="size-4" />

                    <div>
                      <div className="font-medium">
                        Public
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Anyone with the organization URL can
                        discover it.
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      {canManage && onDelete && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">
              Danger zone
            </CardTitle>

            <CardDescription>
              Permanently delete this organization and its
              organization-level data.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <Separator />

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />

                <div className="space-y-1">
                  <h3 className="font-medium">
                    Delete organization
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone. All
                    organization membership, settings, and
                    organization-owned resources may be
                    permanently removed.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <Label htmlFor="delete-organization">
                  Type{" "}
                  <span className="font-semibold">
                    {organization.name}
                  </span>{" "}
                  to confirm.
                </Label>

                <Input
                  id="delete-organization"
                  value={deleteConfirmation}
                  onChange={(event) =>
                    setDeleteConfirmation(
                      event.target.value,
                    )
                  }
                  disabled={isDeleting}
                  placeholder={organization.name}
                  autoComplete="off"
                />
              </div>

              <Button
                type="button"
                variant="destructive"
                className="mt-4"
                onClick={handleDelete}
                disabled={
                  isDeleting ||
                  deleteConfirmation !==
                    organization.name
                }
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}

                {isDeleting
                  ? "Deleting..."
                  : "Delete organization"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default OrganizationSettings
