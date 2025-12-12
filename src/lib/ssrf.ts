import dns from 'node:dns/promises'
import net from 'node:net'

export type DnsLookup = (hostname: string) => Promise<ReadonlyArray<{ address: string }>>

export const isPrivateOrLocalIp = (ip: string): boolean => {
  if (net.isIP(ip) === 4) {
    if (ip.startsWith('10.')) return true
    if (ip.startsWith('127.')) return true
    if (ip.startsWith('169.254.')) return true
    if (ip.startsWith('192.168.')) return true

    const parts = ip.split('.').map(n => Number(n))
    if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
    if (parts.length === 4 && parts[0] === 0) return true
  }

  if (net.isIP(ip) === 6) {
    const normalized = ip.toLowerCase()
    if (normalized === '::1') return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    if (normalized.startsWith('fe80')) return true
  }

  return false
}

export const isBlockedHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase()
  if (host === 'localhost') return true
  if (host.endsWith('.localhost')) return true
  return false
}

const defaultLookup: DnsLookup = async (hostname) => dns.lookup(hostname, { all: true })

export const assertUrlIsSafe = async (
  targetUrl: URL,
  options?: {
    lookup?: DnsLookup
  }
): Promise<void> => {
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS URLs are supported')
  }

  if (targetUrl.username || targetUrl.password) {
    throw new Error('URL credentials are not allowed')
  }

  if (!targetUrl.hostname) {
    throw new Error('Invalid hostname')
  }

  if (isBlockedHostname(targetUrl.hostname)) {
    throw new Error('Hostname is not allowed')
  }

  const ipType = net.isIP(targetUrl.hostname)
  if (ipType) {
    if (isPrivateOrLocalIp(targetUrl.hostname)) {
      throw new Error('Target IP is not allowed')
    }
    return
  }

  const lookup = options?.lookup ?? defaultLookup
  const results = await lookup(targetUrl.hostname)
  if (!results.length) {
    throw new Error('Unable to resolve hostname')
  }

  for (const r of results) {
    if (isPrivateOrLocalIp(r.address)) {
      throw new Error('Target IP is not allowed')
    }
  }
}
