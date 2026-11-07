export const MAX_TARGET_ROLES = 8
export const TARGET_ROLE_MIN = 2
export const TARGET_ROLE_MAX = 80

export function normalizeTargetRoles(input: unknown): { roles: string[] | null; error: string | null } {
  if (!Array.isArray(input)) {
    return { roles: null, error: 'Add at least one target role.' }
  }

  const roles: string[] = []
  const seen = new Set<string>()

  for (const item of input) {
    if (typeof item !== 'string') continue
    const title = item.trim().replace(/\s+/g, ' ')
    if (!title) continue
    if (title.length < TARGET_ROLE_MIN || title.length > TARGET_ROLE_MAX) {
      return {
        roles: null,
        error: `Each target role must be ${TARGET_ROLE_MIN} to ${TARGET_ROLE_MAX} characters.`,
      }
    }
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    roles.push(title)
    if (roles.length > MAX_TARGET_ROLES) {
      return { roles: null, error: `Save up to ${MAX_TARGET_ROLES} target roles.` }
    }
  }

  if (roles.length === 0) {
    return { roles: null, error: 'Add at least one target role.' }
  }

  return { roles, error: null }
}
