import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Deprecated auth endpoint. Use SIWF (/api/auth/verify).',
      code: 'DEPRECATED',
    },
    { status: 410 }
  )
}
