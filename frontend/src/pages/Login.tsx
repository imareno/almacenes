import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TextBox from 'devextreme-react/text-box';
import Button from 'devextreme-react/button';
import { login } from '../api/auth';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { signIn } = useAuth();
  const navigate   = useNavigate();

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setError('Ingrese usuario y contraseña');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { token, user } = await login(username.trim(), password);
      signIn(token, user);
      navigate('/');
    } catch {
      setError('Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleLogin();
  }

  return (
    <div className="login-container" onKeyDown={handleKeyDown}>
      <div className="login-box">
        <h1>Control de Almacén</h1>
        <div className="subtitle">Ingrese sus credenciales para continuar</div>

        {error && <div className="login-error">{error}</div>}

        <div style={{ marginBottom: 16 }}>
          <div className="filter-label" style={{ marginBottom: 6, fontWeight: 500, color: '#374151' }}>Usuario</div>
          <TextBox
            value={username}
            onValueChanged={e => setUsername(e.value)}
            placeholder="Nombre de usuario"
            width="100%"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="filter-label" style={{ marginBottom: 6, fontWeight: 500, color: '#374151' }}>Contraseña</div>
          <TextBox
            value={password}
            onValueChanged={e => setPassword(e.value)}
            mode="password"
            placeholder="Contraseña"
            width="100%"
          />
        </div>

        <Button
          text={loading ? 'Ingresando...' : 'Ingresar'}
          type="default"
          stylingMode="contained"
          width="100%"
          disabled={loading}
          onClick={handleLogin}
        />
      </div>
    </div>
  );
}
