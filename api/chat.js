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
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Variabile NVIDIA_API_KEY non configurata su Vercel.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const lastUserMessage = contents && contents.filter ? contents.filter(c => c.role === 'user').pop() : null;
    const messageText = lastUserMessage?.parts?.[0]?.text || "Ciao";

    const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

    const apiResponse = await fetch(NVIDIA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-405b-instruct", 
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: messageText }
        ],
        max_tokens: 500,
        // FONDAMENTALE: Costringe NVIDIA a rispondere con un JSON singolo e pulito
        stream: false 
      })
    });

    // Ora che lo stream è disattivato, questo comando non fallirà più!
    const data = await apiResponse.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: `Errore di NVIDIA: ${data.error.message}` }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const textOutput = data.choices?.[0]?.message?.content;

    if (!textOutput) {
      return new Response(JSON.stringify({ error: 'NVIDIA ha risposto vuoto.' }), { 
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
    return new Response(JSON.stringify({ error: `Errore del server con NVIDIA: ${error.message}` }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
