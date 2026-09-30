import { HealthSchema } from '@nlm/shared';

export function App() {
  const health = HealthSchema.parse({ status: 'ok' });
  return <h1>NotebookLM-Klon ({health.status})</h1>;
}
