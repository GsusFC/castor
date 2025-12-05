'use client'

import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { CastItem, Account, Channel, ReplyToCast } from './types'
import { CastPreview } from './CastPreview'

interface PreviewPopoverProps {
  casts: CastItem[]
  account: Account | null
  channel: Channel | null
  replyTo: ReplyToCast | null
  hasContent: boolean
}

export function PreviewPopover({
  casts,
  account,
  channel,
  replyTo,
  hasContent,
}: PreviewPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", !hasContent && "opacity-40 cursor-not-allowed")}
          disabled={!hasContent}
          aria-label="Vista previa del cast"
        >
          <Eye className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      {hasContent && (
        <PopoverContent className="w-80 p-0" align="end">
          <CastPreview
            casts={casts}
            account={account}
            channel={channel}
            replyTo={replyTo}
            compact
          />
        </PopoverContent>
      )}
    </Popover>
  )
}
