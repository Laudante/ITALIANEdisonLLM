export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `You are the Edison Format Oracle — an expert assistant for Yu-Gi-Oh! Edison Format (April 2010 TCG format). You answer questions about card rulings, interactions, combos, the banlist, and gameplay mechanics specific to Edison Format.
When answering:
- Be extremely brief: 2-4 sentences max. Go straight to the ruling.
- Use card names in **bold**.
- Answer in the same language the user writes in (italiano if they ask in Italian).`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response('OK', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo non consentito' }), { status: 405 });
  }

  try {
    const { contents } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Chiave API non configurata nel pannello di Vercel.' }), { status: 500 });
    }

    const lastUserMessage = contents.filter(c => c.role === 'user').pop();
    const messageText = lastUserMessage?.parts?.[0]?.text || "Ciao";

    // Modificato l'URL alla versione stabile v1 e rimosso l'ambiguità del modello
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const apiResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: messageText }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { maxOutputTokens: 1000 }
      })
    });

    const data = await apiResponse.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: `Errore di Google Gemini: ${data.error.message}` }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOutput) {
      return new Response(JSON.stringify({ error: 'Google Gemini ha risposto, ma la risposta era vuota o bloccata dai filtri.' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ text: textOutput }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `Errore del server: ${error.message}` }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
