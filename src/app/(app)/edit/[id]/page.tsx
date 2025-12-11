import { redirect } from 'next/navigation'

interface EditPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPage({ params }: EditPageProps) {
  const { id } = await params
  redirect(`/studio?edit=${id}`)
}
