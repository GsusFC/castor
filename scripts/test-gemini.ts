import { GoogleGenAI } from '@google/genai'
import 'dotenv/config'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('❌ No GEMINI_API_KEY found in .env')
  process.exit(1)
}

const genAI = new GoogleGenAI({ apiKey })

const models = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-pro',
]

async function testModel(model: string) {
  console.log(`\nTesting model: ${model}...`)
  const start = Date.now()
  try {
    const response = await genAI.models.generateContent({
      model,
      contents: 'Say hello',
    })
    const duration = Date.now() - start
    console.log(`✅ SUCCESS (${duration}ms): ${response.text?.trim().slice(0, 50)}...`)
    return true
  } catch (error: any) {
    const duration = Date.now() - start
    console.error(`❌ FAILED (${duration}ms):`)
    if (error.status === 429) {
      console.error('   Quota Exceeded (429)')
    } else {
      console.error('   ' + (error.message || error))
    }
    return false
  }
}

async function runDiagnostics() {
  console.log('🔍 Starting Gemini API Diagnostics...')
  console.log('-----------------------------------')
  
  let successCount = 0
  for (const model of models) {
    if (await testModel(model)) {
      successCount++
    }
  }

  console.log('\n-----------------------------------')
  console.log(`🏁 Diagnostics complete. ${successCount}/${models.length} models working.`)
}

runDiagnostics()
