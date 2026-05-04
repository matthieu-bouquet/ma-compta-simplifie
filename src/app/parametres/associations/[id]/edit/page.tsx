import { redirect } from 'next/navigation'

export default function EditAssociationRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/parametres/entites/${params.id}/edit`)
}

