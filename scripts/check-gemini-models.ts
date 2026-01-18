import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName: string) {
    console.log(`\nTesting model: ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "Hello"');
        const response = await result.response;
        console.log(`✅ Model ${modelName} works!`);
        return true;
    } catch (error: any) {
        console.log(`❌ Model ${modelName} failed: ${error.message.split(':')[0]}`);
        return false;
    }
}

async function main() {
    await testModel('gemini-3-flash-preview');
    await testModel('gemini-3-pro-preview');
    await testModel('gemini-2.5-flash');
}

main().catch(console.error);
