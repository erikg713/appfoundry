'use client'

import React, { useEffect, useState, FormEvent } from 'react'

type Organization = {
  id: string
  name: string
  slug?: string
  description?: string | null
  memberCount?: number
  createdAt?: string
}

type ApiError = {
  message: string
}

export default function Page(): JSX.Element {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState<boolean>(false)
  const [creating, setCreating] = useState<boolean>(false)
  const [newName, setNewName] = useState<string>('')
  const [newDescription, setNewDescription] = useState<string>('')

  useEffect(() => {
    let mounted = true
    async function loadOrgs() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/organizations', { method: 'GET' })
        if (!res.ok) {
          const err: ApiError = await res.json().catch(() => ({ message: res.statusText }))
          throw new Error(err.message || 'Failed to fetch organizations')
        }
        const data: Organization[] = await res.json()
        if (mounted) setOrgs(data)
      } catch (err: any) {
        if (mounted) setError(err?.message ?? 'Unknown error')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadOrgs()
    return () => {
      mounted = false
    }
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim()) {
      setError('Organization name is required')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const payload = { name: newName.trim(), description: newDescription.trim() || undefined }
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err: ApiError = await res.json().catch(() => ({ message: res.statusText }))
        throw new Error(err.message || 'Failed to create organization')
      }
      const created: Organization = await res.json()
      setOrgs((prev) => [created, ...prev])
      setNewName('')
      setNewDescription('')
      setShowCreate(false)
    } catch (err: any) {
      setError(err?.message ?? 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this organization? This action cannot be undone.')) return
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err: ApiError = await res.json().catch(() => ({ message: res.statusText }))
        throw new Error(err.message || 'Failed to delete organization')
      }
      setOrgs((prev) => prev.filter((o) => o.id !== id))
    } catch (err: any) {
      setError(err?.message ?? 'Unknown error')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage organizations: create, view members, and configure settings.
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            + New organization
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse p-4 border rounded bg-white/50 h-28" />
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <div className="p-6 border rounded text-center">
          <p className="mb-4">No organizations found.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Create your first organization
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <div key={org.id} className="p-4 border rounded bg-white shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-medium">{org.name}</h2>
                  {org.slug && <p className="text-xs text-muted-foreground">@{org.slug}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm">{org.memberCount ?? 0} member{(org.memberCount ?? 0) !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted-foreground">
                    {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : ''}
                  </p>
                </div>
              </div>
              {org.description && <p className="mt-3 text-sm text-muted-foreground">{org.description}</p>}
              <div className="mt-4 flex gap-2">
                <a
                  href={`/dashboard/organizations/${encodeURIComponent(org.id)}`}
                  className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
                >
                  Open
                </a>
                <button
                  onClick={() => handleDelete(org.id)}
                  className="text-sm px-3 py-1 border rounded text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Dialog onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <h3 className="text-lg font-medium">Create organization</h3>
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full border px-3 py-2 rounded"
                placeholder="Acme Inc"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Description (optional)</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full border px-3 py-2 rounded"
                placeholder="Short description"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 border rounded"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create organization'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  )
}

/**
 * Minimal accessible dialog component used inline to avoid external deps.
 * You can replace with your app's modal/dialog component (Radix UI, Headless UI, etc.)
 */
function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black opacity-40"
        aria-hidden
      />
      <div
        className="relative z-10 w-full max-w-xl bg-white rounded shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
          }
