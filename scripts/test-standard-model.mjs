
import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'

// Explicitly load .env.local
const result = config({ path: '.env.local' })

if (result.error) {
    console.log('Error loading .env.local:', result.error)
} else {
    console.log('Loaded .env.local')
}

async function testModel() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        console.error('No GEMINI_API_KEY found inside .env.local')
        process.exit(1)
    }

    console.log(`API Key loaded. Length: ${apiKey.length}`)
    console.log(`First 5 chars: ${apiKey.slice(0, 5)}`)

    const genAI = new GoogleGenerativeAI(apiKey)
    // Use the new standard model
    const modelName = 'gemini-3-flash'
    const model = genAI.getGenerativeModel({ model: modelName })

    try {
        console.log(`Testing model: ${modelName}`)
        const result = await model.generateContent('Say "OK"')
        console.log('Success:', result.response.text())
    } catch (error) {
        console.error('Error generating content:', error.message)
        // Print full error if possible
        if (error.response) {
            console.error('Response status:', error.response.status)
            console.error('Response body:', JSON.stringify(error.response, null, 2))
        }
    }
}

testModel()
