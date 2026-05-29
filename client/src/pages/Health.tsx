import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';

type HealthResponse = {
  status: string;
  service: string;
  time: string;
};

export default function Health() {
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
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <p className="mb-6 text-gray-600">Frontend talking to backend via Vite proxy.</p>
        <section>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Backend /api/health</h2>
          {error && <pre className="text-red-600">Error: {error}</pre>}
          {health && (
            <pre className="rounded-md bg-black p-4 text-white">
              {JSON.stringify(health, null, 2)}
            </pre>
          )}
          {!health && !error && <p className="text-gray-500">Loading…</p>}
        </section>
      </main>
    </div>
  );
}
