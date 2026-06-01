import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import RequireAdmin from './components/RequireAdmin';
import RequireAuth from './components/RequireAuth';
import Health from './pages/Health';
import Home from './pages/Home';
import Login from './pages/Login';
import Users from './pages/Users';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/health"
          element={
            <RequireAuth>
              <Health />
            </RequireAuth>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAdmin>
              <Users />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
