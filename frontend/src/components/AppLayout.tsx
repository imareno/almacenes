import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Button from 'devextreme-react/button';
import { useAuth } from '../auth/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  almacenero: 'Almacenero',
  aprobador: 'Aprobador',
  solicitante: 'Solicitante',
  readonly: 'Solo lectura',
};

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate('/login');
  }

  const isAlmacen   = user?.role === 'admin' || user?.role === 'almacenero';
  const hasReportes = user?.role === 'admin' || user?.role === 'almacenero' || user?.role === 'readonly';

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>Control de Almacén</h2>
          <div className="subtitle">Sistema de gestión</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div className="nav-section">General</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="icon">📊</span> Dashboard
          </NavLink>

          <NavLink to="/solicitudes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="icon">📋</span> Solicitudes
          </NavLink>

          {isAlmacen && (
            <>
              <div className="nav-section">Inventario</div>
              <NavLink to="/almacenes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="icon">🏭</span> Almacenes
              </NavLink>
              <NavLink to="/materiales" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="icon">📦</span> Materiales
              </NavLink>
              <NavLink to="/movimientos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="icon">↕️</span> Movimientos
              </NavLink>
              <NavLink to="/compras" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="icon">🛒</span> Compras
              </NavLink>
            </>
          )}

          {hasReportes && (
            <>
              <div className="nav-section">Reportes</div>
              <NavLink to="/reportes/existencias" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="icon">📈</span> Existencias
              </NavLink>
              <NavLink to="/reportes/kardex" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="icon">📒</span> Kardex
              </NavLink>
              <NavLink to="/reportes/valorizado" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="icon">💰</span> Valorizado
              </NavLink>
              <NavLink to="/reportes/compras" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="icon">🧾</span> Rep. Compras
              </NavLink>
              <NavLink to="/reportes/movimientos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="icon">📉</span> Rep. Movimientos
              </NavLink>
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-name">{user?.username}</div>
          <div className="role-badge">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</div>
          <Button
            className="logout-btn"
            text="Cerrar sesión"
            stylingMode="outlined"
            type="normal"
            onClick={handleSignOut}
            style={{ marginTop: 8, width: '100%', fontSize: 12 }}
          />
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
