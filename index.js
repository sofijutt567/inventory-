  require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. API KEYS LOADING ---
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

app.get('/', (req, res) => {
    res.send('🚀 PharmPro Parallel Engine (Alphabet-Split Mode) is LIVE!');
});

// --- 2. HELPER: CALL GROQ ---
async function callSingleGroq(apiKey, subPrompt) {
    try {
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a Pharmacy Data Expert. 
                    STRICT RULES:
                    - Return ONLY JSON with root key "medicines".
                    - Fields: name, power, qty, price.
                    - DO NOT include "expiry" or any dates.
                    - Format: {"medicines": [{"name":"MedName","power":"500mg","qty":50,"price":100}]}`
                },
                { role: "user", content: subPrompt }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        }, {
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            timeout: 45000 
        });
        
        const content = response.data.choices[0].message.content;
        return typeof content === 'string' ? JSON.parse(content) : content;
    } catch (error) {
        console.error(`Key Error: ${error.message}`);
        return null;
    }
}

// --- 3. MAIN ROUTE: PARALLEL PROCESSING ---
app.post('/api/process-medicine', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is empty" });

    const match = prompt.match(/\d+/);
    const totalTarget = match ? parseInt(match[0]) : 10;

    // --- LOGIC: AGAR 20 SE ZYADA ITEMS HAIN TO 5 KEYS PAR DIVIDE KARO ---
    if (totalTarget >= 20 && API_KEYS.length > 1) {
        console.log(`⚡ Splitting ${totalTarget} items across ${API_KEYS.length} keys...`);
        
        const perKeyTarget = Math.ceil(totalTarget / API_KEYS.length);
        const alphaGroups = ["A to E", "F to J", "K to O", "P to T", "U to Z"];

        // Parallel tasks create karna
        const tasks = API_KEYS.map((key, index) => {
            const group = alphaGroups[index] || "A to Z";
            const subPrompt = `Generate exactly ${perKeyTarget} unique medicines starting with letters ${group}. No expiry.`;
            return callSingleGroq(key, subPrompt);
        });

        try {
            const results = await Promise.all(tasks);
            let combinedMedicines = [];
            let uniqueNames = new Set();

            results.forEach(data => {
                if (data && data.medicines) {
                    data.medicines.forEach(med => {
                        const lowName = med.name.toLowerCase().trim();
                        if (!uniqueNames.has(lowName)) {
                            uniqueNames.add(lowName);
                            combinedMedicines.push(med);
                        }
                    });
                }
            });

            console.log(`✅ Parallel Success: Collected ${combinedMedicines.length} Unique Items.`);
            return res.json(combinedMedicines);
        } catch (err) {
            console.error("Parallel system failed, falling back...");
        }
    }

    // --- FALLBACK: SINGLE KEY OR SMALL TARGET ---
    for (let i = 0; i < API_KEYS.length; i++) {
        const data = await callSingleGroq(API_KEYS[i], prompt);
        if (data && data.medicines) {
            console.log(`✅ Success with Key #${i+1}`);
            return res.json(data.medicines);
        }
    }

    res.status(500).json({ error: "All API keys failed or limit reached." });
});

// --- 4. EXPORT ---
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
}
