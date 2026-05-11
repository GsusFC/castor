import { GoogleGenerativeAI } from '@google/generative-ai'
import 'dotenv/config'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('No GEMINI_API_KEY found in .env')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(apiKey)

const models = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]

async function testModel(model: string) {
  console.log(`Testing model: ${model}...`)
  const start = Date.now()
  try {
    const result = await genAI.getGenerativeModel({ model }).generateContent('Say hello')
    const duration = Date.now() - start
    console.log(`OK (${duration}ms): ${result.response.text().trim().slice(0, 50)}...`)
    return true
  } catch (error: any) {
    const duration = Date.now() - start
    console.error(`FAILED (${duration}ms):`)
    if (error.status === 429) {
      console.error('   Quota Exceeded (429)')
    } else {
      console.error('   ' + (error.message || error))
    }
    return false
  }
}

async function runDiagnostics() {
  console.log('Gemini API Diagnostics')
  console.log('---')

  let successCount = 0
  for (const model of models) {
    if (await testModel(model)) {
      successCount++
    }
  }

  console.log('---')
  console.log(`Done. ${successCount}/${models.length} models working.`)
}

runDiagnostics()