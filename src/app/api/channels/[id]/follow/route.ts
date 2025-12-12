import { NextRequest, NextResponse } from 'next/server'
import { neynar } from '@/lib/farcaster/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params
    const { signerUuid } = await request.json()

    if (!signerUuid) {
      return NextResponse.json({ error: 'signer_uuid is required' }, { status: 400 })
    }

    await neynar.followChannel({
      signerUuid,
      channelId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error following channel:', error)
    return NextResponse.json(
      { error: 'Failed to follow channel' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: channelId } = await params
    const { signerUuid } = await request.json()

    if (!signerUuid) {
      return NextResponse.json({ error: 'signer_uuid is required' }, { status: 400 })
    }

    await neynar.unfollowChannel({
      signerUuid,
      channelId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error unfollowing channel:', error)
    return NextResponse.json(
      { error: 'Failed to unfollow channel' },
      { status: 500 }
    )
  }
}
