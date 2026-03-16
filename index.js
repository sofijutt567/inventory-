require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// API Keys Array
const API_KEYS = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5
].filter(key => key);

// Single Call Function
async function callSingleGroq(apiKey, subPrompt) {
    try {
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "Return ONLY JSON {medicines:[{name,power,qty,price}]}. No expiry." },
                { role: "user", content: subPrompt }
            ],
            response_format: { type: "json_object" }
        }, {
            headers: { "Authorization": `Bearer ${apiKey}` },
            timeout: 25000
        });
        return response.data.choices[0].message.content;
    } catch (e) {
        return null;
    }
}

app.post('/api/process-medicine', async (req, res) => {
    const { prompt } = req.body;
    const match = prompt.match(/\d+/);
    const totalTarget = match ? parseInt(match[0]) : 10;

    // --- AGAR TARGET 20 SE ZYADA HAI TO KAAM BAANT DO ---
    if (totalTarget >= 20 && API_KEYS.length > 1) {
        console.log(`⚡ Splitting ${totalTarget} items across ${API_KEYS.length} keys...`);
        
        // Per Key kitna kaam dena hai (e.g. 100 medicines / 5 keys = 20 each)
        const perKeyTarget = Math.ceil(totalTarget / API_KEYS.length);
        
        // Har key ke liye alag promise (Parallel Execution)
        const tasks = API_KEYS.map((key, index) => {
            const subPrompt = `Give me ${perKeyTarget} unique medicines starting with different random letters. No expiry.`;
            return callSingleGroq(key, subPrompt);
        });

        try {
            const results = await Promise.all(tasks);
            let combinedMedicines = [];
            
            results.forEach(resText => {
                if (resText) {
                    const data = JSON.parse(resText);
                    if (data.medicines) combinedMedicines = [...combinedMedicines, ...data.medicines];
                }
            });

            console.log(`✅ Parallel Success! Collected ${combinedMedicines.length} items.`);
            return res.json(combinedMedicines);

        } catch (err) {
            console.error("Parallel failed, falling back to rotation...");
        }
    }

    // --- FALLBACK: AGAR PARALLEL FAIL HO YA CHOTA TARGET HO ---
    for (let key of API_KEYS) {
        const result = await callSingleGroq(key, prompt);
        if (result) {
            const data = JSON.parse(result);
            return res.json(data.medicines || []);
        }
    }

    res.status(500).json({ error: "All keys failed" });
});

module.exports = app;
