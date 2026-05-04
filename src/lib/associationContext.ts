import { cookies } from 'next/headers'

const COOKIE_NAME = 'currentAssociationId'

export async function getCurrentAssociationId(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}

