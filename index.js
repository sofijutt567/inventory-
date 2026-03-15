require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// API Keys loading from .env
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

app.get('/', (req, res) => {
    res.send('🚀 PharmPro Multi-Key Parallel AI Engine is LIVE!');
});

// Helper function to call Groq API
async function callGroq(apiKey, subPrompt) {
    const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "system",
                content: `You are a Pharmacy Data Expert.
                Return ONLY JSON with root key "medicines". 
                Fields: name, power, qty, price, expiry (YYYY-MM-DD).
                Use real brand names. Realistic prices in PKR.`
            },
            { role: "user", content: subPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
    }, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 60000 
    });
    
    // Safety check for JSON parsing
    const content = response.data.choices[0].message.content;
    const data = typeof content === 'string' ? JSON.parse(content) : content;
    return data.medicines || [];
}

app.post('/api/process-medicine', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt empty hai!" });

    const match = prompt.match(/(\d+)/);
    const totalCount = match ? parseInt(match[1]) : 0;

    // --- PARALLEL LOGIC (NO CHANGES TO LOGIC) ---
    if (totalCount > 30 && API_KEYS.length > 1) {
        console.log(`⚡ Parallel Processing start for ${totalCount} items...`);
        const half = Math.ceil(totalCount / 2);
        const prompts = [
            `Generate ${half} popular medicines starting with letters A to M.`,
            `Generate ${totalCount - half} popular medicines starting with letters N to Z.`
        ];

        try {
            const tasks = [
                callGroq(API_KEYS[0], prompts[0]),
                callGroq(API_KEYS[1] || API_KEYS[0], prompts[1])
            ];

            const results = await Promise.all(tasks);
            const combinedData = [...results[0], ...results[1]];
            
            console.log(`✅ Parallel Success! Total items: ${combinedData.length}`);
            return res.json(combinedData);
        } catch (error) {
            console.error("Parallel Error, falling back to single key...");
        }
    }

    // --- FALLBACK ROTATION ---
    let lastError = null;
    for (let i = 0; i < API_KEYS.length; i++) {
        try {
            const data = await callGroq(API_KEYS[i], prompt);
            return res.json(data);
        } catch (error) {
            console.error(`❌ Key #${i+1} failed, trying next...`);
            lastError = error;
        }
    }

    res.status(500).json({ error: "Sari keys block hain.", details: lastError?.message });
});

// --- VERCEL EXPORT (Important) ---
module.exports = app;

// --- LOCAL SERVER START (Conditional) ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Local Server running on port ${PORT}`));
}
