import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in .env.local');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    console.log('Fetching available models...');
    try {
        // Access the model manager via the class if needed, or check docs. 
        // GoogleGenerativeAI doesn't have listModels directly usually, it's on the client manager.
        // Actually in the node SDK it might be different. 
        // Let's try to infer from typical usage or use the basic fetch if needed, 
        // but the SDK usually provides `getGenerativeModel`.
        // Checking documentation memory: v1beta has listModels.
        // The SDK exposes it via `GoogleGenerativeAI` instance? No, usually not directly.
        // Let's try to just hit the REST endpoint if the SDK doesn't obviously expose it, 
        // OR assume the user has a recent SDK.
        // A common pattern in this SDK (0.x/1.x) might not expose listing easily.
        // Let's try to use a raw fetch to the API to be sure.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log('✅ Available Models:');
            data.models.forEach((m: any) => {
                console.log(`- ${m.name} (${m.displayName})`);
            });
        } else {
            console.log('❌ No models found or error:', data);
        }
    } catch (error: any) {
        console.error('❌ Failed to list models:', error.message);
    }
}

listModels().catch(console.error);
