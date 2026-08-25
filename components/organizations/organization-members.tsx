<OrganizationMembers
  organizationId={organization.id}
  members={members}
  currentUserId={session.user.id}
  canManage={currentUserCanManage}
  onInvite={async (email, role) => {
    const response = await fetch(
      `/api/organizations/${organization.id}/members`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          role,
        }),
      },
    )

    if (!response.ok) {
      const data = await response.json().catch(() => null)

      throw new Error(
        data?.error ?? "Failed to send invitation.",
      )
    }

    router.refresh()
  }}
  onRoleChange={async (member, role) => {
    const response = await fetch(
      `/api/organizations/${organization.id}/members/${member.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      },
    )

    if (!response.ok) {
      throw new Error("Failed to update member role.")
    }

    router.refresh()
  }}
  onRemove={async (member) => {
    const response = await fetch(
      `/api/organizations/${organization.id}/members/${member.id}`,
      {
        method: "DELETE",
      },
    )

    if (!response.ok) {
      throw new Error("Failed to remove member.")
    }

    router.refresh()
  }}
/>

<OrganizationMembers
  organizationId={organization.id}
  members={members}
  currentUserId={session.user.id}
  canManage={currentUserCanManage}
  onInvite={async (email, role) => {
    const response = await fetch(
      `/api/organizations/${organization.id}/members`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          role,
        }),
      },
    )

    if (!response.ok) {
      const data = await response.json().catch(() => null)

      throw new Error(
        data?.error ?? "Failed to send invitation.",
      )
    }

    router.refresh()
  }}
  onRoleChange={async (member, role) => {
    const response = await fetch(
      `/api/organizations/${organization.id}/members/${member.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      },
    )

    if (!response.ok) {
      throw new Error("Failed to update member role.")
    }

    router.refresh()
  }}
  onRemove={async (member) => {
    const response = await fetch(
      `/api/organizations/${organization.id}/members/${member.id}`,
      {
        method: "DELETE",
      },
    )

    if (!response.ok) {
      throw new Error("Failed to remove member.")
    }

    router.refresh()
  }}
/>
