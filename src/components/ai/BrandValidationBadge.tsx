'use client'

import React from 'react'
import { BrandValidationResult } from '@/lib/ai/brand-validator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle2, AlertCircle, XCircle, Info } from 'lucide-react'

interface BrandValidationBadgeProps {
  validation: BrandValidationResult
  compact?: boolean
}

export function BrandValidationBadge({ validation, compact = false }: BrandValidationBadgeProps) {
  const categoryConfig = {
    perfect: {
      icon: CheckCircle2,
      color: 'bg-green-100 text-green-700 border-green-300',
      label: 'Perfect fit',
      emoji: '✨',
    },
    good: {
      icon: CheckCircle2,
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      label: 'Matches your brand',
      emoji: '👌',
    },
    acceptable: {
      icon: AlertCircle,
      color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      label: 'Mostly aligned',
      emoji: '⚠️',
    },
    off_brand: {
      icon: XCircle,
      color: 'bg-red-100 text-red-700 border-red-300',
      label: 'Off-brand',
      emoji: '❌',
    },
  }

  const config = categoryConfig[validation.category]
  const Icon = config.icon

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{validation.coherenceScore}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2">
              <p className="font-semibold">{config.label}</p>
              <p className="text-sm">{validation.feedback}</p>
              {validation.violations.length > 0 && (
                <div className="text-xs">
                  <p className="font-semibold mb-1">Issues:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.violations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validation.strengths.length > 0 && (
                <div className="text-xs">
                  <p className="font-semibold mb-1">Strengths:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.color} text-sm`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold">{config.label}</div>
              <div className="text-xs opacity-75">Score: {validation.coherenceScore}%</div>
            </div>
            <div className="text-lg">{config.emoji}</div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-sm">
          <div className="space-y-3">
            <div>
              <p className="font-semibold mb-1">{validation.feedback}</p>
            </div>

            {validation.violations.length > 0 && (
              <div>
                <p className="font-semibold text-red-300 mb-2">Issues to consider:</p>
                <ul className="space-y-1 list-disc list-inside text-sm">
                  {validation.violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            )}

            {validation.strengths.length > 0 && (
              <div>
                <p className="font-semibold text-green-300 mb-2">What works well:</p>
                <ul className="space-y-1 list-disc list-inside text-sm">
                  {validation.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 border-t border-opacity-20 border-current">
              <div className="flex items-center gap-1 text-xs text-opacity-75 text-current">
                <Info className="w-3 h-3" />
                Brand coherence score: {validation.coherenceScore}%
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
