// Throwaway spike code (excluded from lint and check). Lists the Gemini models the key can use.
// Run it from your own terminal with the key loaded into GEMINI_API_KEY (see spikes/README.md).
// Prints model names, input token limits and supported methods. Never prints the key.
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('GEMINI_API_KEY is not set');

const models = [];
let pageToken;
do {
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
  url.searchParams.set('pageSize', '200');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const response = await fetch(url, { headers: { 'x-goog-api-key': key } });
  if (!response.ok) throw new Error(`models.list failed: HTTP ${response.status}`);
  const page = await response.json();
  models.push(...page.models);
  pageToken = page.nextPageToken;
} while (pageToken);

const wanted = /flash|embedding/;
const unwanted = /image|live|tts|audio|robot|veo|imagen/;
for (const model of models.filter((m) => wanted.test(m.name) && !unwanted.test(m.name))) {
  console.log(
    `${model.name} | in ${model.inputTokenLimit} | ${(model.supportedGenerationMethods ?? []).join(',')}`
  );
}
