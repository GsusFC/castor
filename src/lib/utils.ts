import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const diffMinutes = Math.round(diff / 60000)
  const diffHours = Math.round(diff / 3600000)
  const diffDays = Math.round(diff / 86400000)

  if (Math.abs(diffMinutes) < 60) {
    return diffMinutes > 0 ? `en ${diffMinutes}m` : `hace ${Math.abs(diffMinutes)}m`
  }
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `en ${diffHours}h` : `hace ${Math.abs(diffHours)}h`
  }
  return diffDays > 0 ? `en ${diffDays}d` : `hace ${Math.abs(diffDays)}d`
}
