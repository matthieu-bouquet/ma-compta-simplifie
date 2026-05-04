import { redirect } from 'next/navigation'

export default function AssociationDetailRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/parametres/entites/${params.id}`)
}
