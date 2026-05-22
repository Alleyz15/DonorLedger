// config/gemini.js
//
// Single Gemini client. ai.service.js is the only consumer.
// Section 14 — model is read from env (default gemini-1.5-flash, free tier).

import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from './env.js'

const client = new GoogleGenerativeAI(env.gemini.apiKey)

export const geminiModel = client.getGenerativeModel({
  model: env.gemini.model,
  // Forcing JSON output reduces the markdown-fence cleanup we have to do,
  // but the parse-safe fallback in ai.service.js still handles surprises.
  generationConfig: {
    temperature: 0.2,
    responseMimeType: 'application/json',
  },
})

export default geminiModel
