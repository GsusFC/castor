'use client'

import { CastItem, Account, Channel, ReplyToCast, LinkEmbed } from './types'
import { cn } from '@/lib/utils'
import { renderCastText } from '@/lib/cast-text'

interface CastPreviewProps {
  casts: CastItem[]
  account: Account | null
  channel: Channel | null
  replyTo: ReplyToCast | null
  compact?: boolean
}

export function CastPreview({ casts, account, channel, replyTo, compact = false }: CastPreviewProps) {
  if (!account) return null

  return (
    <div className={cn(
      "bg-card overflow-hidden",
      !compact && "border rounded-xl"
    )}>
      {!compact && (
        <div className="px-4 py-3 bg-muted border-b">
          <h3 className="text-sm font-medium text-foreground">Vista previa</h3>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Reply context */}
        {replyTo && (
          <div className="flex items-start gap-2 pb-3 border-b border-dashed">
            <div className="w-0.5 h-full bg-gray-200 ml-4" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {replyTo.author.pfpUrl && (
                  <img
                    src={replyTo.author.pfpUrl}
                    alt=""
                    className="w-5 h-5 rounded-full"
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  Respondiendo a @{replyTo.author.username}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                {replyTo.text}
              </p>
            </div>
          </div>
        )}

        {/* Casts */}
        {casts.map((cast, index) => (
          <div
            key={cast.id}
            className={cn(
              "relative",
              index > 0 && "pt-4 border-t"
            )}
          >
            {/* Thread line */}
            {casts.length > 1 && index < casts.length - 1 && (
              <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-200" />
            )}

            <div className="flex gap-3">
              {/* Avatar */}
              {account.pfpUrl ? (
                <img
                  src={account.pfpUrl}
                  alt=""
                  className="w-10 h-10 rounded-full shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-foreground truncate">
                    {account.displayName || account.username}
                  </span>
                  <span className="text-muted-foreground text-sm truncate">
                    @{account.username}
                  </span>
                  {channel && (
                    <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      /{channel.name}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="text-foreground whitespace-pre-wrap break-words">
                  {cast.content ? renderCastText(cast.content, { variant: 'highlight' }) : (
                    <span className="text-muted-foreground italic">Sin contenido...</span>
                  )}
                </div>

                {/* Link previews */}
                {cast.links.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {cast.links.filter(l => !l.loading && !l.error && l.title).map((link) => (
                      <div
                        key={link.url}
                        className="border rounded-lg overflow-hidden bg-muted"
                      >
                        {link.image && (
                          <div className="aspect-[2/1] bg-muted overflow-hidden max-h-32">
                            <img
                              src={link.image}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-xs text-muted-foreground">{link.siteName}</p>
                          <p className="text-sm font-medium text-foreground line-clamp-1">
                            {link.title}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Media */}
                {cast.media.length > 0 && (
                  <div className={cn(
                    "mt-3 gap-2",
                    cast.media.length === 1 ? "block" : "grid grid-cols-2"
                  )}>
                    {cast.media.map((m) => (
                      <div
                        key={m.preview}
                        className="rounded-lg overflow-hidden bg-muted"
                      >
                        {m.type === 'image' ? (
                          <img
                            src={m.preview}
                            alt=""
                            className="w-full h-auto max-h-48 object-cover"
                          />
                        ) : (
                          <video
                            src={m.preview}
                            className="w-full h-auto max-h-48 object-cover"
                            controls={false}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
