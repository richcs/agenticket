import NavBar from '../components/NavBar';

export default function Users() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
      </main>
    </div>
  );
}
