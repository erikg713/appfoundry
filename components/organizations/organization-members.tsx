'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrganizationMembers } from '@/components/organizations'
import { useToast } from '@/hooks/use-toast'

interface OrganizationMembersWrapperProps {
  organization: any
  members: any[]
  session: any
  currentUserCanManage: boolean
}

/**
 * API utility for organization member operations
 */
const organizationMembersAPI = {
  invite: async (organizationId: string, email: string, role: string) => {
    const response = await fetch(
      `/api/organizations/${organizationId}/members`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      }
    )

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error ?? 'Failed to send invitation.')
    }

    return response.json()
  },

  updateRole: async (organizationId: string, memberId: string, role: string) => {
    const response = await fetch(
      `/api/organizations/${organizationId}/members/${memberId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to update member role.')
    }

    return response.json()
  },

  remove: async (organizationId: string, memberId: string) => {
    const response = await fetch(
      `/api/organizations/${organizationId}/members/${memberId}`,
      {
        method: 'DELETE',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to remove member.')
    }

    return response.json()
  },
}

export function OrganizationMembersWrapper({
  organization,
  members,
  session,
  currentUserCanManage,
}: OrganizationMembersWrapperProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleInvite = useCallback(
    async (email: string, role: string) => {
      setIsLoading(true)
      try {
        await organizationMembersAPI.invite(organization.id, email, role)
        toast({
          title: 'Success',
          description: `Invitation sent to ${email}`,
        })
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred'
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    },
    [organization.id, router, toast]
  )

  const handleRoleChange = useCallback(
    async (member: any, role: string) => {
      setIsLoading(true)
      try {
        await organizationMembersAPI.updateRole(organization.id, member.id, role)
        toast({
          title: 'Success',
          description: `${member.name}'s role updated`,
        })
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred'
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    },
    [organization.id, router, toast]
  )

  const handleRemove = useCallback(
    async (member: any) => {
      setIsLoading(true)
      try {
        await organizationMembersAPI.remove(organization.id, member.id)
        toast({
          title: 'Success',
          description: `${member.name} removed from organization`,
        })
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An error occurred'
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    },
    [organization.id, router, toast]
  )

  return (
    <OrganizationMembers
      organizationId={organization.id}
      members={members}
      currentUserId={session.user.id}
      canManage={currentUserCanManage}
      isLoading={isLoading}
      onInvite={handleInvite}
      onRoleChange={handleRoleChange}
      onRemove={handleRemove}
    />
  )
}
