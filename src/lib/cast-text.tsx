'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type TokenType = 'text' | 'url' | 'mention' | 'channel' | 'ticker'

type Token = {
  type: TokenType
  value: string
  start: number
  end: number
}

type RenderVariant = 'highlight' | 'interactive'

type InteractiveHandlers = {
  onMentionClick?: (username: string) => void
  onChannelClick?: (channelId: string) => void
  onTickerClick?: (ticker: string) => void
  onTokenClickStopPropagation?: (event: { stopPropagation: () => void }) => void
}

type RenderOptions = {
  variant: RenderVariant
  className?: string
  interactive?: InteractiveHandlers
}

const URL_REGEX = /https?:\/\/[\w\-._~:/?#[\[\]@!$&'()*+,;=%]+/gi
const MENTION_REGEX = /@[a-zA-Z0-9_]+/g
const CHANNEL_REGEX = /\/[a-zA-Z0-9_-]+/g
const TICKER_REGEX = /\$[a-zA-Z][a-zA-Z0-9]{1,14}/g

const isWordChar = (char: string | undefined) => {
  if (!char) return false
  return /[A-Za-z0-9_]/.test(char)
}

const normalizeUrlMatch = (raw: string) => raw.replace(/[.,;:!?)]+$/, '')

const getMatchList = (text: string): Token[] => {
  const matches: Token[] = []

  {
    const regexCopy = new RegExp(URL_REGEX.source, URL_REGEX.flags)
    let match: RegExpExecArray | null
    while ((match = regexCopy.exec(text)) !== null) {
      const raw = match[0]
      const normalized = normalizeUrlMatch(raw)
      const start = match.index
      const end = start + normalized.length
      matches.push({ type: 'url', value: normalized, start, end })
    }
  }

  {
    const regexCopy = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
    let match: RegExpExecArray | null
    while ((match = regexCopy.exec(text)) !== null) {
      const start = match.index
      const before = text[start - 1]
      if (isWordChar(before)) continue
      matches.push({ type: 'mention', value: match[0], start, end: start + match[0].length })
    }
  }

  {
    const regexCopy = new RegExp(CHANNEL_REGEX.source, CHANNEL_REGEX.flags)
    let match: RegExpExecArray | null
    while ((match = regexCopy.exec(text)) !== null) {
      const start = match.index
      const before = text[start - 1]
      if (isWordChar(before)) continue
      matches.push({ type: 'channel', value: match[0], start, end: start + match[0].length })
    }
  }

  {
    const regexCopy = new RegExp(TICKER_REGEX.source, TICKER_REGEX.flags)
    let match: RegExpExecArray | null
    while ((match = regexCopy.exec(text)) !== null) {
      const start = match.index
      const before = text[start - 1]
      if (isWordChar(before)) continue
      matches.push({ type: 'ticker', value: match[0], start, end: start + match[0].length })
    }
  }

  const priority: Record<TokenType, number> = {
    url: 4,
    mention: 3,
    channel: 2,
    ticker: 1,
    text: 0,
  }

  matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return priority[b.type] - priority[a.type]
  })

  const accepted: Token[] = []
  let lastEnd = -1
  for (const m of matches) {
    if (m.start < lastEnd) continue
    accepted.push(m)
    lastEnd = m.end
  }

  return accepted
}

export const renderCastText = (text: string, options: RenderOptions): ReactNode => {
  const { variant, className, interactive } = options

  if (!text) return null

  const matches = getMatchList(text)
  if (matches.length === 0) {
    return <span className={cn('text-foreground', className)}>{text}</span>
  }

  const nodes: ReactNode[] = []
  let cursor = 0

  for (const m of matches) {
    if (m.start > cursor) {
      nodes.push(
        <span key={`text-${cursor}`} className={cn('text-foreground', className)}>
          {text.slice(cursor, m.start)}
        </span>
      )
    }

    if (m.type === 'url') {
      if (variant === 'interactive') {
        nodes.push(
          <a
            key={`url-${m.start}`}
            href={m.value}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation()
              interactive?.onTokenClickStopPropagation?.(e)
            }}
            className={cn('text-primary/80 underline break-all', className)}
          >
            {m.value}
          </a>
        )
      } else {
        nodes.push(
          <span key={`url-${m.start}`} className={cn('text-primary/80 underline break-all', className)}>
            {m.value}
          </span>
        )
      }
      cursor = m.end
      continue
    }

    if (m.type === 'mention') {
      const username = m.value.slice(1)
      if (variant === 'interactive') {
        nodes.push(
          <button
            key={`mention-${m.start}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              interactive?.onTokenClickStopPropagation?.(e)
              interactive?.onMentionClick?.(username)
            }}
            className={cn('text-primary font-medium hover:underline', className)}
            aria-label={`Open profile @${username}`}
          >
            {m.value}
          </button>
        )
      } else {
        nodes.push(
          <span key={`mention-${m.start}`} className={cn('text-primary font-medium', className)}>
            {m.value}
          </span>
        )
      }
      cursor = m.end
      continue
    }

    if (m.type === 'channel') {
      const channelId = m.value.slice(1).toLowerCase()
      if (variant === 'interactive') {
        nodes.push(
          <button
            key={`channel-${m.start}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              interactive?.onTokenClickStopPropagation?.(e)
              interactive?.onChannelClick?.(channelId)
            }}
            className={cn('text-blue-400 font-medium hover:underline', className)}
            aria-label={`Open channel /${channelId}`}
          >
            {m.value}
          </button>
        )
      } else {
        nodes.push(
          <span key={`channel-${m.start}`} className={cn('text-blue-400 font-medium', className)}>
            {m.value}
          </span>
        )
      }
      cursor = m.end
      continue
    }

    if (m.type === 'ticker') {
      const ticker = m.value.slice(1)
      if (variant === 'interactive') {
        if (interactive?.onTickerClick) {
          nodes.push(
            <button
              key={`ticker-${m.start}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                interactive?.onTokenClickStopPropagation?.(e)
                interactive.onTickerClick?.(ticker)
              }}
              className={cn('text-green-400 font-medium hover:underline', className)}
              aria-label={`Open $${ticker}`}
            >
              {m.value}
            </button>
          )
        } else {
          const href = `https://farcaster.xyz/~/token/${ticker.toLowerCase()}`
          nodes.push(
            <a
              key={`ticker-${m.start}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation()
                interactive?.onTokenClickStopPropagation?.(e)
              }}
              className={cn('text-green-400 font-medium hover:underline', className)}
              aria-label={`Open token $${ticker}`}
            >
              {m.value}
            </a>
          )
        }
      } else {
        nodes.push(
          <span key={`ticker-${m.start}`} className={cn('text-green-400 font-medium', className)}>
            {m.value}
          </span>
        )
      }
      cursor = m.end
      continue
    }
  }

  if (cursor < text.length) {
    nodes.push(
      <span key={`text-${cursor}`} className={cn('text-foreground', className)}>
        {text.slice(cursor)}
      </span>
    )
  }

  return nodes
}
