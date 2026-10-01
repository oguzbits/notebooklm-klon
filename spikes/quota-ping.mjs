// Throwaway spike code (excluded from lint and check). Question: is the 429 of the search probe about the tool or about
// the quota of the model in general? Sends "Say OK" twice: once plain, once with the Google Search tool.
//   node --env-file=.env.local spikes/quota-ping.mjs
const key = process.env.GEMINI_API_KEY;
const model = process.env.AI_MODEL;
if (!key || !model) throw new Error('GEMINI_API_KEY and AI_MODEL must be set');

for (const [name, tools] of [
  ['plain', undefined],
  ['with-google-search', [{ google_search: {} }]],
]) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Antworte mit dem Wort OK.' }] }],
        ...(tools && { tools }),
      }),
    }
  );
  const body = await response.json();
  console.log(name, response.status, JSON.stringify(body).slice(0, 300));
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
