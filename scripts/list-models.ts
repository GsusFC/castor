import { GoogleGenerativeAI } from '@google/generative-ai'
import 'dotenv/config'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('❌ No GEMINI_API_KEY found')
  process.exit(1)
}

// Configurar API
const genAI = new GoogleGenerativeAI(apiKey)

async function listModels() {
  console.log('🔍 Listing available models for this API Key...')
  try {
    // Hack para acceder a listModels que no está expuesto directamente en el SDK de alto nivel a veces
    // Pero en versiones recientes sí. Probemos lo básico:
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    console.log('API Key seems valid format.')
    
    // Intento de inferir modelos probando uno por uno los más comunes
    const candidates = [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.0-pro',
      'gemini-pro',
      'gemini-pro-vision'
    ]

    for (const modelName of candidates) {
      process.stdout.write(`Testing ${modelName}... `)
      try {
        const m = genAI.getGenerativeModel({ model: modelName })
        const result = await m.generateContent('Hi')
        const response = await result.response
        console.log(`✅ OK! Response: ${response.text().slice(0, 20)}...`)
      } catch (err: any) {
        if (err.message.includes('404')) console.log('❌ Not Found')
        else if (err.message.includes('429')) console.log('⚠️ Quota Exceeded (but exists)')
        else console.log(`❌ Error: ${err.message.split('\n')[0]}`)
      }
    }

  } catch (error: any) {
    console.error('FATAL ERROR:', error)
  }
}

listModels()
