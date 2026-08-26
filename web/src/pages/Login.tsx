import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getToken } from '../lib/api';

type LoginResponse = {
  token: string;
  user: {
    id: number;
    employeeId: number;
    username: string;
    fullName: string;
    roles: string[];
    branchId: number | null;
    branchCode?: string | null;
    branchName?: string | null;
    allBranches?: boolean;
  };
};

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) nav('/dashboard', { replace: true });
  }, [nav]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: cleanUsername, password }),
      });

      localStorage.setItem('clinic_token', data.token);
      localStorage.setItem('clinic_user', JSON.stringify(data.user));
      nav('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">+</div>
        <h1>BIM CLINICS</h1>
        <p>Masuk ke sistem operasional klinik.</p>

        {error && <div className="alert error">{error}</div>}

        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            disabled={loading}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </label>

        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Memeriksa...' : 'Masuk'}
        </button>

        <p style={{ marginTop: 16 }}>
          <Link to="/">← Kembali ke website</Link>
        </p>
      </form>
    </div>
  );
}
