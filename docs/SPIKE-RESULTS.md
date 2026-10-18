# Spike results

Results of the model spike (measurement plan: parsing, chat, embeddings, citations). The spike code is in [spikes/](../spikes/) and is throwaway code. The raw outputs are under `spikes/results/` (not in the repo, they contain third-party text). No comparison with OpenAI models because there is no access.

Test set: 7 public documents ([spikes/corpus/README.md](../spikes/corpus/README.md)), 18 golden questions ([golden-questions.json](../apps/api/src/eval/golden-questions.json)).

## 1. Parsing (PDF)

Four PDFs with 28 pages together: two-column paper (01), Destatis tables (02), excerpt of the Basic Law (04), scan (05). Each candidate ran once, temperature 0. The values are single measurements, repeatability was not checked.

| Measure                                        | liteparse (local, OCR) | `gemini-3.1-flash-lite`             | `gemini-3.5-flash-lite`      |
| ---------------------------------------------- | ---------------------- | ----------------------------------- | ---------------------------- |
| Anchors of the golden questions found verbatim | 10 of 11               | 11 of 11                            | 6 of 11                      |
| Word recall paper (01)                         | 96.8 %                 | 98.1 %                              | 98.2 %                       |
| Word recall Destatis (02)                      | 97.8 %                 | 91.8 %                              | 99.3 %                       |
| Word recall Basic Law (04)                     | 98.6 %                 | 82.9 % (reference artifact)         | 82.9 % (reference artifact)  |
| Word recall scan (05)                          | 92.6 %                 | 99.9 %                              | 0 % (answer blocked)         |
| Tables kept as a Markdown table (02)           | no (0 table rows)      | yes                                 | yes, but header corrupted    |
| Time for all four PDFs                         | approx. 6 s            | approx. 109 s                       | approx. 95 s                 |
| Cost (paid prices, 28 pages)                   | 0                      | approx. $0.05 (approx. $0.002/page) | approx. $0.09 (scan blocked) |

How measured: The word recall counts how many words of the reference text (text of the original pages, without OCR) occur in the parsed text. For the Basic Law the value is below 100 % for both models only because of the letter-spaced headings of the reference (`G r u n d g e s e t z`, 595 of 596 missing words are single letters).

Findings:

- **`gemini-3.1-flash-lite`** reads the scan almost completely (99.9 %), keeps tables and the reading order of the two-column paper. Weakness: on the diagram page of Destatis, captions and footnotes are missing (`Ergebnisse des Mikrozensus`, years), about 8 % of the words.
- **`gemini-3.5-flash-lite`** is more complete on Destatis (99.3 %), but corrupts the table heading (`Bevölkerungsvertrag` instead of `Bevölkerung`), glues page text into table cells and sets bold (`**Erwerbspersonen**`), so the verbatim anchor breaks. The scan returned 0 characters with `finishReason: RECITATION` (answer suppressed because of citation protection). That is an outage, not a quality difference.
- **liteparse** is on par for text PDFs and practically free, but delivers no table structure. On the scan the OCR consistently reads `Al` instead of `AI` and swaps lines at a slight skew (`the Organisation for Economic Co-operation and Development / Al actors are defined by including…`).

**Decision parsing:** `gemini-3.1-flash-lite` for PDFs (highest content fidelity across all four documents, no outage). liteparse stays as a fallback and local completeness check: for PDFs with a text layer the word recall of the Gemini output can be checked against the liteparse text and a warning raised on gaps. That would be a separate step to build later, not part of the spike.

Limits: Anchors only check omissions at 11 places. Reading order and tables were judged only on the samples named, not cell by cell. `RECITATION` for `gemini-3.5-flash-lite` is a single observation and may turn out differently with another prompt.

## 2. Embeddings

120 chunks (approx. 1500 characters, 200 characters overlap) from all 7 documents in one shared search space. The PDFs come from the parsing output of `gemini-3.1-flash-lite`, the other documents from the reference text. 768 dimensions, cosine similarity over normalized vectors. A hit means: a chunk with an anchor of the golden question is in the top 5. Each model ran once.

| Measure                              | `gemini-embedding-2` (task in the text) | `gemini-embedding-001` (`taskType`) |
| ------------------------------------ | --------------------------------------- | ----------------------------------- |
| Top-5 hits overall (18 questions)    | 17                                      | 16                                  |
| German question, German source (10)  | 9                                       | 10                                  |
| German question, English source (3)  | 3                                       | 2                                   |
| English question, English source (5) | 5                                       | 4                                   |
| Rank 1 / top 3                       | 11 / 17                                 | 13 / 15                             |
| mean reciprocal rank (MRR)           | 0.76                                    | 0.81                                |
| maximum input                        | 8,192 tokens                            | 2,048 tokens                        |

Misses: Embedding 2 misses `destatis-erwerbspersonen` (rank 6, just outside). Embedding 001 misses `dpr-top5` and `dpr-top5-de` (rank 8), both on the same English chunk.

**Decision embeddings:** `gemini-embedding-2`. The difference is one question of 18 and thus noise; the rule of the plan applies (tie: Embedding 2). It also has the larger input. Drawbacks: the task is in the text instead of in a field, and the documentation calls it `gemini-embedding-2-preview` (preview) in one place and `gemini-embedding-2` in another. Both IDs are in the model list of the API, `gemini-embedding-2` is chosen. A later change of the model requires recomputing all vectors.

Limits: Only 18 questions and one chunking (1500 characters), no repetition. The chunking is not a decision of this spike. The throttling by estimated tokens (30K per minute) held, there was no HTTP error. 120 chunks took a few minutes.

## 3. Chat and citations

Flow per question: top 5 chunks from part 2 (`gemini-embedding-2`), numbered `c1` to `c5`, plus the question. The model answers streamed in structured output: `{ statements: [{ text, chunkIds[] }] }`, temperature 0, answer in the language of the question. The answers are stored individually and can be re-scored offline (`spikes/score-chat.mjs`). All 18 questions with `gemini-3.5-flash-lite`, five selected ones additionally with `gemini-3.5-flash`.

| Measure                                                      | `gemini-3.5-flash-lite` (18) | `gemini-3.5-flash` (5, sample) |
| ------------------------------------------------------------ | ---------------------------- | ------------------------------ |
| Citation validity (citations with an ID from the context)    | 100 %                        | 100 %                          |
| Citation coverage (statements with a valid citation)         | 100 %                        | 100 %                          |
| Required facts in the answer                                 | 96 %                         | 89 %                           |
| Required facts in the cited chunk (the citation supports it) | 92 %                         | 78 %                           |
| Time to first token, median                                  | 0.9 s                        | 14.6 s                         |
| Time to first token, maximum                                 | 16.9 s                       | 19.1 s                         |
| Cost per answer (paid prices)                                | approx. $0.0009              | not measured                   |

Findings:

- **The citation format holds.** Short IDs per request (`c1` to `c5`), which the server maps to real chunk IDs, were never invented or cited wrongly. This way the model invents no UUIDs, and the server can check every ID against the context sent.
- **Valid citations are no proof of correct answers.** For `destatis-erwerbspersonen` the search found the hit only at rank 6. Both models answered with a wrong number (`43 360 Tsd.` instead of 46.2 million) and cited valid chunks. The citation validity stays at 100 % in that case. The row "in the cited chunk" shows this, but is meaningful only when question and source are in the same language (for `rag-benefits-limits`, `Halluzination` appears only in the German answer, not in the English chunk).
- **A larger model does not help.** `gemini-3.5-flash` makes the same mistake, but thinks for 200 to 1400 tokens and needs 12 to 19 s to the first token. The lever is in the search (hybrid retrieval, keywords such as `Erwerbspersonen 2018`), not in the model.
- **Latency with outliers.** The median of `gemini-3.5-flash-lite` is 0.9 s, but three of 18 answers needed 6 to 17 s (without thinking tokens, so waiting time on Google's side in the free tier). The target of about 5 seconds was thus met in 15 of 18 cases.
- One run of the sample aborted once with an HTTP error (message not recorded) and went through on the second attempt. In the free tier (5 requests per minute for `gemini-3.5-flash`) the limit may be the cause.

**Decision chat:** `gemini-3.5-flash-lite` with structured output (statements with short chunk IDs), server check of the IDs against the context sent. The large Flash model stays in reserve for the Studio, where waiting time matters less. The prompt should additionally require saying so openly when an answer is not clearly backed. Whether that prevents the wrong number is not tested.

Limits: 18 questions, one run, all answerable (no test of refusal when the answer is missing). Time to first token in the free tier is a snapshot. Costs are computed from the token counts of the answers and the paid prices, not measured.

## 4. Hybrid search (addendum)

Implemented after the spike ([retrieval.ts](../apps/api/src/db/retrieval.ts)): vector search plus full-text search, fusion by RRF in SQL, access filter by user, notebook and selected sources. PostgreSQL itself filters stop words of the question (`ts_lexize`, German and English). Tested with the same 120 chunks and embeddings as part 2, without new model calls:

| Variant                                       | Top-5 hits (18 questions) | Missed                                |
| --------------------------------------------- | ------------------------- | ------------------------------------- |
| vector search only (part 2)                   | 17                        | `destatis-erwerbspersonen`            |
| Hybrid, OR search without stop-word filter    | 16                        | two questions displaced               |
| Hybrid with stop-word filter, text weight 1.0 | 16                        | `dpr-top5`, `dpr-top5-de`             |
| Hybrid with stop-word filter, text weight 0.5 | 16 to 17                  | `dpr-top5-de` (depending on rounding) |

Finding: Hybrid fixes the number case (`Erwerbspersonen`, now rank 2), but on these 18 questions is no better than vector search. A German question finds no words in English text, the text side yields only noise there. The difference between 16 and 17 flips with the rounding (`float8` versus `numeric`) and is therefore not reliable. The text weight 0.5 is in the code, justified only by the language difference, not by measurement. Re-check with more questions (above all German on English and numbers).

Verified model IDs and limits (Google documentation and model list of the API, free-tier limits per dashboard):

| Model                                    | Free tier (RPM / TPM / RPD) | Price per 1M tokens (paid, input / output) |
| ---------------------------------------- | --------------------------- | ------------------------------------------ |
| `gemini-3.1-flash-lite`                  | 15 / 250K / 500             | $0.25 / $1.50                              |
| `gemini-3.5-flash-lite`                  | 15 / 250K / 500             | $0.30 / $2.50                              |
| `gemini-3.5-flash` to `gemini-3.8-flash` | 5 / 250K / 20               | not measured                               |
| `gemini-embedding-2`                     | 100 / 30K / 1000            | $0.20 (text)                               |
| `gemini-embedding-001`                   | not measured                | not measured                               |

## 5. Thoughts and web search (2026-10-01, round 4)

Two scripts against the real model (`spikes/thoughts-probe.mjs`, `spikes/websearch-probe.mjs`, `spikes/quota-ping.mjs`;
raw data local in `spikes/results/`, not in the repo). One question each with two public sentences, one run, so a sample.

**Thought summaries (`includeThoughts`) with structured output and streaming:**

- They work together with `responseJsonSchema`; the answer stayed valid JSON in all runs. Thoughts arrive as parts with
  `thought: true`, 2 to 3 of them, with a heading in `**…**` and a paragraph, in **English**.
- On `gemini-3.5-flash-lite`, `includeThoughts` alone and `thinkingLevel: low` deliver **no** summary (at `low` 114
  thinking tokens were used without a summary appearing). Only `medium` (604 thinking tokens, approx. 740 characters) and `high` (838 tokens,
  approx. 1080 characters) deliver one. With `thinkingLevel` the time to the answer grows from approx. 2 s to approx. 4 to 7 s; the thoughts
  arrive only shortly before the answer (3.3 s versus 4.2 s), not early.
- On `gemini-3.5-flash` (`PARSE_FALLBACK_MODEL`) they come even without a level, but the run took 28 to 35 s.
- Content: general and about the task ("Defining the Constraints", "ensure the answer is in German", "cite passage IDs"); it reveals
  the structure of the prompt. Thinking tokens count as output and go against the daily quota.

**Google search (`tools: [{ google_search: {} }]`):**

- **Not usable** in the free plan: the same request without the tool gave 200, with the tool 429 `RESOURCE_EXHAUSTED`
  (`quota-ping.mjs`). According to the pricing page, "Grounding with Google Search" is "Not available" in the free tier for `gemini-3.1-flash-lite`; in the
  paid plan, 5000 requests per month are included for Gemini 3, after that $14 per 1000 search queries. Compatibility with the
  JSON schema was therefore **not** checked.
- Alternatives according to provider pages (not checked myself): Tavily 1000 credits per month without a card; Brave Search no longer has
  a free plan for new accounts ($5 credit per month). Both would be a third party that receives the search terms.
