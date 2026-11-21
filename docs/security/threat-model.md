# Threat model

STRIDE per trust boundary: **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure,
**D**enial of service, **E**levation of privilege. Each row names the control and the test or file
that shows it, so a control is not described twice: follow the link. Rules and invariants are in
[AGENTS.md](../../AGENTS.md), the plan in [PLAN.md](../PLAN.md), open points in
[BACKLOG.md](../BACKLOG.md).

Assets: the documents and notes of a user, the identity behind a session, the model budget (every
answer costs money), and the availability of the app.

Actors: an anonymous visitor, a guest (temporary user), a signed-in user, a user who tries to read
another user's data, an author of a hostile document or web page that a user imports, and an operator
of the host.

## 1. Browser to Caddy and the API

| STRIDE | Threat                                                  | Control                                                                                                   | Evidence                                                                                                                                                                    |
| ------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S      | A request without a session reaches a user route        | One session guard in front of every user route; 401 without a session                                     | [session guard](../../apps/api/src/auth/session.ts), [auth test](../../apps/api/src/auth/auth.db.test.ts)                                                                   |
| S      | The client names the user it wants to act as            | The user ID comes from the server-side session only                                                       | [auth test](../../apps/api/src/auth/auth.db.test.ts) ("ignores a user ID sent by the client")                                                                               |
| S      | A weak or leaked password                               | At least 8 characters, never stored in clear text                                                         | [auth test](../../apps/api/src/auth/auth.db.test.ts)                                                                                                                        |
| E      | Anonymous sign-in is used to mint guests around the cap | The built-in anonymous route answers 404; guests are made only by the guest route, which counts them      | [app](../../apps/api/src/app.ts), [guest route test](../../apps/api/src/guest-route.db.test.ts)                                                                             |
| D      | A flood of guests uses up the model budget              | Limits per hour, per address and at the same time                                                         | [IP limit test](../../apps/api/src/guest/ip-limit.test.ts), [start-guest test](../../apps/api/src/guest/start-guest.test.ts), [limits](../../apps/api/src/config/limits.ts) |
| T      | Script injection (XSS) through a model answer or a note | Answers are rendered through an escaping renderer; no raw HTML sink in `apps/`; CSP without inline script | [render test](../../apps/web/src/lib/render-markup.test.ts), [Caddyfile](../../deploy/Caddyfile)                                                                            |
| T      | Framing, MIME sniffing, downgrade to http               | `frame-ancestors 'none'`, `nosniff`, HSTS                                                                 | [Caddyfile](../../deploy/Caddyfile) (no test: a header in the proxy configuration)                                                                                          |

## 2. API to PostgreSQL

| STRIDE | Threat                                                     | Control                                                                                            | Evidence                                                                                                                                                              |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I      | A user reads the chunks or notes of another user           | Every chunk query filters by `userId`, `notebookId` and the selected `sourceIds` in SQL            | [retrieval](../../apps/api/src/db/retrieval.ts), [retrieval test](../../apps/api/src/db/retrieval.db.test.ts) ("never returns another user's chunks")                 |
| I      | A user opens a foreign notebook or source by its ID        | The API answers 404 for a resource of another user                                                 | [chat route test](../../apps/api/src/chat-route.db.test.ts), [notes route test](../../apps/api/src/notes-route.db.test.ts)                                            |
| I, E   | A forgotten filter in new code leaks rows                  | Row-level security as a second wall: the app role sees only the rows of the current user           | [RLS test](../../apps/api/src/db/rls.db.test.ts), [policies](../../apps/api/drizzle/0026_row_level_security.sql)                                                      |
| E      | The app login changes the schema or bypasses the policies  | A runtime role without superuser and `BYPASSRLS`; the owner migrates                               | [role migration](../../apps/api/drizzle/0025_nlm_app_role.sql), [RLS test](../../apps/api/src/db/rls.db.test.ts)                                                      |
| T      | The same content is stored or embedded twice, also at once | One source per user and content hash (unique index); a second insert waits and finds the first row | [schema](../../apps/api/src/db/schema.ts), [storage test](../../apps/api/src/db/source-storage.db.test.ts) ("one source when the same content arrives twice at once") |
| T      | A migration drifts from the schema                         | CI generates the migration again and fails when it writes a file                                   | [CI](../../.github/workflows/ci.yml) (step "Migrations match the schema")                                                                                             |

## 3. Import of files and web addresses

| STRIDE | Threat                                                               | Control                                                                                                                                                                                                                    | Evidence                                                                                                                                                                                                         |
| ------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I, E   | An address makes the server call an internal service (SSRF)          | Only http and https; no credentials in the address; no private, loopback or link-local address, also not as a spelling variant                                                                                             | [SSRF rules](../../apps/api/src/core/ssrf.ts), [SSRF test](../../apps/api/src/core/ssrf.test.ts)                                                                                                                 |
| I, E   | A host name resolves to a private address, or a redirect leads there | DNS is resolved and every address checked, again after every redirect; redirects, time and size are capped                                                                                                                 | [fetch](../../apps/api/src/import/fetch-url.ts), [fetch test](../../apps/api/src/import/fetch-url.test.ts)                                                                                                       |
| T      | A file claims to be another kind (spoofed name or signature)         | The kind needs a matching name and signature                                                                                                                                                                               | [file kind](../../apps/api/src/core/file-kind.ts), [file kind test](../../apps/api/src/core/file-kind.test.ts)                                                                                                   |
| D      | A very large upload                                                  | Size is checked before the file is read; 413                                                                                                                                                                               | [sources route](../../apps/api/src/routes/sources.ts), [app test](../../apps/api/src/app.db.test.ts)                                                                                                             |
| D      | A ZIP bomb as DOCX or PPTX                                           | The upload check inflates every part slice by slice and stops once the total passes the limit, so a bomb costs about the limit, not its size; the sizes in the file are not trusted. PPTX parts are capped again when read | [ZIP size](../../apps/api/src/core/zip-size.ts), [ZIP test](../../apps/api/src/core/zip-size.test.ts), [app test](../../apps/api/src/app.db.test.ts), [PPTX test](../../apps/api/src/parsing/parse-pptx.test.ts) |

## 4. API to the model provider

| STRIDE | Threat                                                         | Control                                                                                                                               | Evidence                                                                                                                                                                                        |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T      | A hostile source tells the model what to do (prompt injection) | Passages are sent as data, delimited so a source cannot close the delimiter; the prompt says to treat them as data                    | [chat context](../../apps/api/src/core/chat-context.ts), [chat context test](../../apps/api/src/core/chat-context.test.ts) ("cannot be closed early by a source that contains the closing tag") |
| T      | The model cites a passage it was never shown, or invents one   | Every citation is checked against the chunk IDs in the context; unknown ones are stripped, a statement without a valid one is dropped | [citations](../../apps/api/src/core/citations.ts), [citation test](../../apps/api/src/core/citations.test.ts), [context test](../../apps/api/src/core/chat-context.test.ts)                     |
| T      | A statement states a number the passage does not contain       | The statement check compares figures with the evidence                                                                                | [statement check](../../apps/api/src/core/statement-check.ts)                                                                                                                                   |
| D      | One user or one bug uses up the budget                         | Every call goes through the rate limiter; one request of a kind per user at a time; a daily budget stops all                          | [rate limiter test](../../apps/api/src/ai/rate-limiter.test.ts), [usage guard test](../../apps/api/src/usage/usage-guard.db.test.ts)                                                            |

A model can still follow an injected instruction in its wording. The citation contract limits the harm
(no statement without a shown passage), but no test can prove what the model does.

## 5. Logs and error reports

| STRIDE | Threat                                   | Control                                                                                                                        | Evidence                                                                                                                                      |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| I      | Document text or answers end up in logs  | Logs hold IDs, lengths, durations and token counts; an error is logged by its name only                                        | [logger test](../../apps/api/src/logger.test.ts)                                                                                              |
| I      | Document text ends up in an error report | Events are scrubbed before they leave the process, in the API and in the browser                                               | [API scrub test](../../apps/api/src/observability/scrub-event.test.ts), [web test](../../apps/web/src/lib/error-reporting.test.ts)            |
| I      | A secret is printed or committed         | Only `config/env.ts` reads the environment; errors never carry a value; a hook blocks reading `.env*`; Trivy scans for secrets | [env test](../../apps/api/src/config/env.test.ts), [hook test](../../.claude/hooks/bash-rules.test.mjs), [CI](../../.github/workflows/ci.yml) |

## 6. Build and dependencies

| STRIDE | Threat                                     | Control                                                                                | Evidence                                                                         |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| T      | A known vulnerable package is shipped      | `pnpm audit --prod` at high and above, Trivy, Dependabot; the build fails on a finding | [CI](../../.github/workflows/ci.yml), [Dependabot](../../.github/dependabot.yml) |
| T      | A CI action is replaced by a malicious tag | Every action is pinned to a commit SHA                                                 | [CI](../../.github/workflows/ci.yml)                                             |
| T      | Insecure code patterns                     | Semgrep with `--error`, ESLint, strict types, no `any`                                 | [CI](../../.github/workflows/ci.yml)                                             |

## Residual risks

- **Limits live in process memory.** The rate limiter and the guest limit do not work across more than
  one instance ([SCALING.md](../SCALING.md)).
- **No bot protection for guests** (no captcha). The per-address limit can lock out real users behind a
  shared address ([BACKLOG.md](../BACKLOG.md)).
- **Jobs, seeds and the browser-test server run as the table owner**, so row-level security does not
  apply there ([BACKLOG.md](../BACKLOG.md)).
- **No email verification** at sign-up.
- **The browser error-report key is public** by design: it ends up in the bundle.
- **No secret manager** ([SCALING.md](../SCALING.md)).
