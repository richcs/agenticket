import { useEffect, useState } from 'react';

type HealthResponse = {
  status: string;
  service: string;
  time: string;
};

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 600 }}>
      <h1>Agenticket</h1>
      <p>Frontend talking to backend via Vite proxy.</p>
      <section>
        <h2>Backend /api/health</h2>
        {error && <pre style={{ color: 'crimson' }}>Error: {error}</pre>}
        {health && <pre>{JSON.stringify(health, null, 2)}</pre>}
        {!health && !error && <p>Loading…</p>}
      </section>
    </main>
  );
}
