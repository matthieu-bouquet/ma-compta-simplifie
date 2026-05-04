import { cookies } from 'next/headers'

const COOKIE_NAME = 'currentExerciceId'

export async function getCurrentExerciceId(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_NAME)?.value ?? null
}

