export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `You are the Edison Format Oracle — an expert assistant for Yu-Gi-Oh! Edison Format (April 2010 TCG format). You answer questions about card rulings, interactions, combos, the banlist, and gameplay mechanics specific to Edison Format.
When answering:
- Be extremely brief: 2-4 sentences max. Go straight to the ruling.
- Use card names in **bold**.
- Answer in the same language the user writes in (italiano if they ask in Italian).`;

export default async function handler(req) {
  // Gestione CORS per permettere al frontend di comunicare liberamente
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
    
    // Legge la nuova chiave NVIDIA che hai salvato nel pannello delle variabili d'ambiente di Vercel
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Variabile NVIDIA_API_KEY non configurata o non trovata nel pannello di Vercel.' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Estrae l'ultimo messaggio inviato dall'utente
    const lastUserMessage = contents && contents.filter ? contents.filter(c => c.role === 'user').pop() : null;
    const messageText = lastUserMessage?.parts?.[0]?.text || "Ciao";

    // Endpoint ufficiale per l'API NVIDIA NIM
    const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

    // Chiamata HTTP formattata secondo gli standard richiesti dai server NVIDIA
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
        max_tokens: 500
      })
    });

    const data = await apiResponse.json();

    // Intercetta eventuali errori restituiti dall'API di NVIDIA
    if (data.error) {
      return new Response(JSON.stringify({ error: `Errore di NVIDIA: ${data.error.message}` }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const textOutput = data.choices?.[0]?.message?.content;

    if (!textOutput) {
      return new Response(JSON.stringify({ error: 'NVIDIA ha risposto correttamente, ma il testo generato era vuoto.' }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Risposta finale corretta da mandare al tuo index.html
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
