import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, FileText, Brain, Users, Plus } from 'lucide-react'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { db, accounts, accountKnowledgeBase, accountDocuments, accountMembers, userStyleProfiles } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { ContextEditor } from './ContextEditor'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AccountContextPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()
  
  if (!session) {
    redirect('/login')
  }

  // Obtener cuenta
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, id),
  })

  if (!account) {
    notFound()
  }

  // Verificar permisos: owner o miembro con canEditContext
  const isOwner = account.ownerId === session.userId
  const membership = await db.query.accountMembers.findFirst({
    where: and(
      eq(accountMembers.accountId, id),
      eq(accountMembers.userId, session.userId)
    ),
  })

  const canEdit = isOwner || membership?.canEditContext || membership?.role === 'admin'
  const canView = isOwner || !!membership

  if (!canView) {
    redirect('/accounts')
  }

  // Obtener perfil de estilo automático de Neynar (si existe)
  const styleProfile = await db.query.userStyleProfiles.findFirst({
    where: eq(userStyleProfiles.fid, account.fid),
  })

  // Obtener knowledge base
  const knowledgeBase = await db.query.accountKnowledgeBase.findFirst({
    where: eq(accountKnowledgeBase.accountId, id),
  })

  // Obtener documentos
  const documents = await db.query.accountDocuments.findMany({
    where: eq(accountDocuments.accountId, id),
    orderBy: (docs, { desc }) => [desc(docs.addedAt)],
  })

  const canViewMembers = isOwner || membership?.role === 'admin'
  const members = canViewMembers
    ? await db.query.accountMembers.findMany({
        where: eq(accountMembers.accountId, id),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              displayName: true,
              pfpUrl: true,
            },
          },
        },
      })
    : []

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 py-4 bg-background/80 backdrop-blur-lg border-b border-border/50 mb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/accounts"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            {account.pfpUrl && (
              <img src={account.pfpUrl} alt="" className="w-10 h-10 rounded-full" />
            )}
            <div>
              <h1 className="text-xl font-semibold">Contexto de @{account.username}</h1>
              <p className="text-sm text-muted-foreground">
                {members.length > 0 
                  ? `${members.length} miembros · ${documents.length} documentos`
                  : `${documents.length} documentos`
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      <ContextEditor
        accountId={id}
        account={account}
        knowledgeBase={knowledgeBase}
        documents={documents}
        members={members}
        canEdit={canEdit}
        canManageMembers={canViewMembers}
        styleProfile={styleProfile}
      />
    </div>
  )
}
