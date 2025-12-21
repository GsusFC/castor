import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Deprecated auth endpoint. Use SIWN (/api/auth/siwn).',
      code: 'DEPRECATED',
    },
    { status: 410 }
  )
}
