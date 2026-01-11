'use client'

import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type ReplyStrategy = 'agree' | 'disagree' | 'add_value' | 'humor' | 'question'

interface ReplyStrategySelectorProps {
  selected: ReplyStrategy | null
  onChange: (strategy: ReplyStrategy) => void
}

const STRATEGIES: Record<ReplyStrategy, { label: string; emoji: string; description: string }> = {
  agree: {
    label: 'Agree',
    emoji: '👍',
    description: 'Show alignment and support',
  },
  disagree: {
    label: 'Disagree',
    emoji: '🤔',
    description: 'Respectfully challenge the idea',
  },
  add_value: {
    label: 'Add Value',
    emoji: '💡',
    description: 'Contribute new insight or perspective',
  },
  humor: {
    label: 'Humor',
    emoji: '😄',
    description: 'Make it funny and engaging',
  },
  question: {
    label: 'Question',
    emoji: '❓',
    description: 'Ask thoughtful follow-ups',
  },
}

export function ReplyStrategySelector({ selected, onChange }: ReplyStrategySelectorProps) {
  const strategies: ReplyStrategy[] = ['agree', 'disagree', 'add_value', 'humor', 'question']

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase">Reply Strategy</p>
      <div className="flex flex-wrap gap-2">
        {strategies.map((strategy) => {
          const config = STRATEGIES[strategy]
          const isSelected = selected === strategy

          return (
            <TooltipProvider key={strategy}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onChange(strategy)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                    }`}
                  >
                    <span>{config.emoji}</span>
                    <span>{config.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{config.description}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
    </div>
  )
}
