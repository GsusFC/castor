'use client'

import React from 'react'
import { Copy, Check } from 'lucide-react'
import { BrandValidationResult } from '@/lib/ai/brand-validator'
import { BrandValidationBadge } from './BrandValidationBadge'
import { useState } from 'react'

interface SuggestionCardProps {
  text: string
  length: number
  onSelect: () => void
  brandValidation?: BrandValidationResult
  isSelected?: boolean
}

export function SuggestionCard({
  text,
  length,
  onSelect,
  brandValidation,
  isSelected = false,
}: SuggestionCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`relative rounded-lg border p-3 space-y-2 transition-all cursor-pointer group ${
        isSelected
          ? 'bg-primary/5 border-primary/50'
          : 'bg-muted/30 border-border hover:border-border/80 hover:bg-muted/50'
      }`}
      onClick={onSelect}
    >
      {/* Header: Brand Validation + Character Count */}
      <div className="flex items-start justify-between gap-2">
        {brandValidation && (
          <div className="flex-1">
            <BrandValidationBadge validation={brandValidation} compact={true} />
          </div>
        )}
        <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
          {length} chars
        </div>
      </div>

      {/* Text */}
      <p className="text-sm leading-relaxed break-words">{text}</p>

      {/* Footer: Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className="text-xs font-medium text-primary hover:underline"
        >
          Use this
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleCopy()
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-muted/50 hover:bg-muted text-muted-foreground"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
