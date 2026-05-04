'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const COOKIE_NAME = 'currentAssociationId'
const EXERCICE_COOKIE = 'currentExerciceId'

export async function setCurrentAssociationId(associationId: string | null) {
  const store = await cookies()
  if (!associationId) {
    store.delete(COOKIE_NAME)
    store.delete(EXERCICE_COOKIE)
  } else {
    store.set(COOKIE_NAME, associationId, {
      path: '/',
      sameSite: 'lax',
    })
    // Changement de contexte → on reset l'exercice courant
    store.delete(EXERCICE_COOKIE)
  }

  revalidatePath('/')
}

export async function setCurrentExerciceId(exerciceId: string | null) {
  const store = await cookies()
  if (!exerciceId) {
    store.delete(EXERCICE_COOKIE)
  } else {
    store.set(EXERCICE_COOKIE, exerciceId, {
      path: '/',
      sameSite: 'lax',
    })
  }
  revalidatePath('/')
}

