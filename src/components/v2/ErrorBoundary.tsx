'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] px-6 text-center gap-3">
          <AlertTriangle className="w-8 h-8 text-destructive/60" />
          <p className="text-sm font-medium text-foreground">
            {this.props.fallbackTitle || 'Something went wrong'}
          </p>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="mt-1">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
