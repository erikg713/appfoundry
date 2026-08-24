"use client"

import * as React from "react"
import { z } from "zod"
import { Loader2 } from "lucide-react"

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

export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(100, "Organization name must be 100 characters or fewer."),

  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters.")
    .max(100, "Slug must be 100 characters or fewer.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug can only contain lowercase letters, numbers, and hyphens.",
    ),

  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),

  website: z
    .string()
    .trim()
    .url("Enter a valid website URL.")
    .optional()
    .or(z.literal("")),
})

export type OrganizationFormValues = z.infer<typeof organizationSchema>

export interface OrganizationFormOrganization {
  id?: string
  name?: string | null
  slug?: string | null
  description?: string | null
  website?: string | null
}

export interface OrganizationFormProps {
  organization?: OrganizationFormOrganization | null
  onSubmit: (
    values: OrganizationFormValues,
  ) => Promise<void> | void
  onCancel?: () => void
  submitLabel?: string
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

export function OrganizationForm({
  organization,
  onSubmit,
  onCancel,
  submitLabel,
  className,
}: OrganizationFormProps) {
  const isEditing = Boolean(organization?.id)

  const [values, setValues] =
    React.useState<OrganizationFormValues>({
      name: organization?.name ?? "",
      slug: organization?.slug ?? "",
      description: organization?.description ?? "",
      website: organization?.website ?? "",
    })

  const [errors, setErrors] = React.useState<
    Partial<Record<keyof OrganizationFormValues, string>>
  >({})

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [slugManuallyEdited, setSlugManuallyEdited] =
    React.useState(isEditing)

  const updateField = <K extends keyof OrganizationFormValues>(
    field: K,
    value: OrganizationFormValues[K],
  ) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }))

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
  }

  const handleNameChange = (name: string) => {
    setValues((current) => ({
      ...current,
      name,
      ...(slugManuallyEdited
        ? {}
        : {
            slug: slugify(name),
          }),
    }))

    setErrors((current) => ({
      ...current,
      name: undefined,
      slug: undefined,
    }))
  }

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const result = organizationSchema.safeParse(values)

    if (!result.success) {
      const nextErrors: Partial<
        Record<keyof OrganizationFormValues, string>
      > = {}

      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof OrganizationFormValues

        if (!nextErrors[field]) {
          nextErrors[field] = issue.message
        }
      }

      setErrors(nextErrors)
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      await onSubmit(result.data)
    } catch (error) {
      console.error("Failed to save organization:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className={className}>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>
            {isEditing
              ? "Edit organization"
              : "Create organization"}
          </CardTitle>

          <CardDescription>
            {isEditing
              ? "Update your organization's information."
              : "Create an organization for your AppFoundry workspace."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="organization-name">
              Organization name
            </Label>

            <Input
              id="organization-name"
              name="name"
              value={values.name}
              onChange={(event) =>
                handleNameChange(event.target.value)
              }
              placeholder="Acme Labs"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={
                errors.name
                  ? "organization-name-error"
                  : undefined
              }
            />

            {errors.name && (
              <p
                id="organization-name-error"
                className="text-sm text-destructive"
              >
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-slug">
              Organization slug
            </Label>

            <div className="flex items-center">
              <span className="rounded-l-md border border-r-0 bg-muted px-3 py-2 text-sm text-muted-foreground">
                /
              </span>

              <Input
                id="organization-slug"
                name="slug"
                value={values.slug}
                onChange={(event) => {
                  setSlugManuallyEdited(true)
                  updateField(
                    "slug",
                    slugify(event.target.value),
                  )
                }}
                placeholder="acme-labs"
                className="rounded-l-none"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.slug)}
                aria-describedby={
                  errors.slug
                    ? "organization-slug-error"
                    : undefined
                }
              />
            </div>

            {errors.slug && (
              <p
                id="organization-slug-error"
                className="text-sm text-destructive"
              >
                {errors.slug}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Use lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-description">
              Description
            </Label>

            <Textarea
              id="organization-description"
              name="description"
              value={values.description ?? ""}
              onChange={(event) =>
                updateField(
                  "description",
                  event.target.value,
                )
              }
              placeholder="What does this organization build?"
              rows={4}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description
                  ? "organization-description-error"
                  : undefined
              }
            />

            <div className="flex justify-between gap-4">
              {errors.description ? (
                <p
                  id="organization-description-error"
                  className="text-sm text-destructive"
                >
                  {errors.description}
                </p>
              ) : (
                <span />
              )}

              <span className="text-xs text-muted-foreground">
                {(values.description ?? "").length}/500
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization-website">
              Website
            </Label>

            <Input
              id="organization-website"
              name="website"
              type="url"
              value={values.website ?? ""}
              onChange={(event) =>
                updateField(
                  "website",
                  event.target.value,
                )
              }
              placeholder="https://example.com"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.website)}
              aria-describedby={
                errors.website
                  ? "organization-website-error"
                  : undefined
              }
            />

            {errors.website && (
              <p
                id="organization-website-error"
                className="text-sm text-destructive"
              >
                {errors.website}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2 border-t">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}

            {submitLabel ??
              (isEditing
                ? "Save changes"
                : "Create organization")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default OrganizationForm
