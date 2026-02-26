#!/usr/bin/env node

const siteId = process.env.NETLIFY_SITE_ID
const authToken = process.env.NETLIFY_AUTH_TOKEN

if (!siteId || !authToken) {
  console.error('Missing NETLIFY_SITE_ID or NETLIFY_AUTH_TOKEN')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${authToken}`,
  'Content-Type': 'application/json',
}

const fetchDeploys = async () => {
  const url = `https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=20`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to list deploys (${res.status}): ${body}`)
  }
  return res.json()
}

const restoreDeploy = async (deployId) => {
  const url = `https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deployId}/restore`
  const res = await fetch(url, { method: 'POST', headers })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to restore deploy ${deployId} (${res.status}): ${body}`)
  }
  return res.json()
}

const run = async () => {
  const deploys = await fetchDeploys()

  if (!Array.isArray(deploys) || deploys.length < 2) {
    throw new Error('Not enough deploy history to rollback')
  }

  const current = deploys[0]
  const candidate = deploys.find((d) => d.id !== current.id && d.state === 'ready')

  if (!candidate) {
    throw new Error('No previous ready deploy found for rollback')
  }

  console.log(`Current deploy: ${current.id} (${current.state})`)
  console.log(`Rollback target: ${candidate.id} (${candidate.state})`)

  await restoreDeploy(candidate.id)
  console.log(`Rollback triggered to deploy ${candidate.id}`)
}

run().catch((error) => {
  console.error('[ROLLBACK] failed', error)
  process.exit(1)
})
