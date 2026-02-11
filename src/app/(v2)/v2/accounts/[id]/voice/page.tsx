import { redirect, notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth'
import { db, accounts, accountKnowledgeBase, accountMembers, userStyleProfiles } from '@/lib/db'
import { VoiceSettingsV2Client } from './voice-settings-v2-client'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function VoiceSettingsPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')

  const [account, membership, knowledgeBase] = await Promise.all([
    db.query.accounts.findFirst({
      where: eq(accounts.id, id),
    }),
    db.query.accountMembers.findFirst({
      where: and(eq(accountMembers.accountId, id), eq(accountMembers.userId, session.userId)),
    }),
    db.query.accountKnowledgeBase.findFirst({
      where: eq(accountKnowledgeBase.accountId, id),
    }),
  ])

  if (!account) notFound()

  const isOwner = account.ownerId === session.userId
  const canView = isOwner || !!membership
  const canEdit = isOwner || membership?.canEditContext || membership?.role === 'admin'

  if (!canView) redirect('/v2/accounts')

  const styleProfile = account.ownerId
    ? await db.query.userStyleProfiles.findFirst({
        where: eq(userStyleProfiles.userId, account.ownerId),
      })
    : null

  return (
    <VoiceSettingsV2Client
      user={{
        username: session.username,
        displayName: session.displayName,
        pfpUrl: session.pfpUrl,
      }}
      account={{
        id: account.id,
        username: account.username,
        displayName: account.displayName,
        pfpUrl: account.pfpUrl,
        type: account.type,
        voiceMode: account.voiceMode,
      }}
      knowledgeBase={
        knowledgeBase
          ? {
              brandVoice: knowledgeBase.brandVoice,
              bio: knowledgeBase.bio,
              expertise: knowledgeBase.expertise,
              alwaysDo: knowledgeBase.alwaysDo,
              neverDo: knowledgeBase.neverDo,
              hashtags: knowledgeBase.hashtags,
              defaultTone: knowledgeBase.defaultTone,
              defaultLanguage: knowledgeBase.defaultLanguage,
            }
          : null
      }
      styleProfile={
        styleProfile
          ? {
              tone: styleProfile.tone,
              avgLength: styleProfile.avgLength,
              languagePreference: styleProfile.languagePreference,
              topics: styleProfile.topics,
              sampleCasts: styleProfile.sampleCasts,
            }
          : null
      }
      canEdit={!!canEdit}
    />
  )
}
