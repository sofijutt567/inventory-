require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. API Keys Loading
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

app.get('/', (req, res) => {
    res.send('🚀 PharmPro Multi-Key (No-Expiry Mode) is LIVE!');
});

// 2. Helper function to call Groq API
async function callGroq(apiKey, subPrompt) {
    const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "system",
                content: `You are a Pharmacy Data Expert. 
                STRICT RULES:
                1. Return ONLY JSON with root key "medicines".
                2. Fields MUST be: name, power, qty, price.
                3. DO NOT generate or include "expiry" field. 
                4. Use real Pakistani brand names and realistic PKR prices.
                5. Return exactly the number of medicines requested.`
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
    
    // Clean data: Ensure no expiry field sneaks in
    const cleanedMedicines = (data.medicines || []).map(({ expiry, ...rest }) => rest);
    return cleanedMedicines;
}

// 3. Main Processing Route
app.post('/api/process-medicine', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt empty hai!" });

    const match = prompt.match(/(\d+)/);
    const totalCount = match ? parseInt(match[1]) : 0;

    // --- PARALLEL LOGIC (30+ items) ---
    if (totalCount > 30 && API_KEYS.length > 1) {
        console.log(`⚡ Parallel Processing for ${totalCount} items (No Expiry Mode)`);
        
        const half = Math.ceil(totalCount / 2);
        const prompts = [
            `Generate ${half} popular medicines (Alphabet A-M). No expiry field.`,
            `Generate ${totalCount - half} popular medicines (Alphabet N-Z). No expiry field.`
        ];

        try {
            const tasks = [
                callGroq(API_KEYS[0], prompts[0]),
                callGroq(API_KEYS[1] || API_KEYS[0], prompts[1])
            ];

            const results = await Promise.all(tasks);
            const combinedData = [...results[0], ...results[1]];
            
            console.log(`✅ Parallel Success! Items: ${combinedData.length}`);
            return res.json(combinedData);
        } catch (error) {
            console.error("Parallel Error, trying fallback...");
        }
    }

    // --- FALLBACK ROTATION ---
    let lastError = null;
    for (let i = 0; i < API_KEYS.length; i++) {
        try {
            console.log(`Using Key #${i+1} for: ${prompt}`);
            const data = await callGroq(API_KEYS[i], prompt);
            return res.json(data);
        } catch (error) {
            console.error(`❌ Key #${i+1} failed.`);
            lastError = error;
        }
    }

    res.status(500).json({ error: "All keys failed.", details: lastError?.message });
});

// --- VERCEL EXPORT ---
module.exports = app;

// --- LOCAL SERVER START ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Local Server running on port ${PORT}`));
}
