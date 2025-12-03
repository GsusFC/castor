import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from "crypto"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(size = 21): string {
  return crypto.randomBytes(Math.ceil(size / 2)).toString('hex').slice(0, size)
}
