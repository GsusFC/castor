'use client'

import { X } from 'lucide-react'
import { Tweet, TweetSkeleton, TweetNotFound } from 'react-tweet'
import { cn } from '@/lib/utils'
import type { BaseRendererProps, RemovableProps } from '../types'

interface TweetRendererProps extends BaseRendererProps, RemovableProps {
  tweetId: string
}

export function TweetRenderer({ 
  tweetId, 
  className,
  onRemove,
  showRemove = false,
}: TweetRendererProps) {
  return (
    <div className={cn('relative rounded-lg overflow-hidden group [&>div]:!my-0', className)}>
      <Tweet 
        id={tweetId}
        fallback={<TweetSkeleton />}
        onError={() => <TweetNotFound />}
      />

      {/* Remove button */}
      {showRemove && onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
          aria-label="Eliminar"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
