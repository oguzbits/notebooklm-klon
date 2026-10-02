// Throwaway spike code (excluded from lint and check). Question: does the configured model take a
// public YouTube URL as file_data, and what does an unavailable video answer? Prints status, finish
// reason, lengths and token counts only, never the key and never the transcript.
const key = process.env.GEMINI_API_KEY;
const model = process.env.AI_MODEL;
if (!key || !model) throw new Error('GEMINI_API_KEY and AI_MODEL must be set');

const VIDEOS = [
  ['public-19s', 'https://www.youtube.com/watch?v=jNQXAC9IVRw'],
  ['unavailable', 'https://www.youtube.com/watch?v=aaaaaaaaaaa'],
];
for (const [name, uri] of VIDEOS) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { file_data: { file_uri: uri } },
              { text: 'Transcribe the speech word for word. Output only the transcript.' },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    }
  );
  const body = await response.json();
  const candidate = body.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('');
  console.log(name, response.status, {
    finish: candidate?.finishReason,
    chars: text.length,
    usage: body.usageMetadata,
    error: body.error && {
      code: body.error.code,
      status: body.error.status,
      message: body.error.message?.slice(0, 200),
    },
  });
}
