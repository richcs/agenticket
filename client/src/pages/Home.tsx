import NavBar from '../components/NavBar';
import { useSession } from '../lib/auth-client';

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Welcome{session ? `, ${session.user.name}` : ''}
        </h1>
        <p className="text-gray-600">AI-powered support ticket management.</p>
      </main>
    </div>
  );
}
