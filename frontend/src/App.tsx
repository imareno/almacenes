import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Almacenes from './pages/Almacenes';
import Materiales from './pages/Materiales';
import Compras from './pages/Compras';
import Movimientos from './pages/Movimientos';
import Solicitudes from './pages/Solicitudes';
import Existencias from './pages/reportes/Existencias';
import Kardex from './pages/reportes/Kardex';
import Valorizado from './pages/reportes/Valorizado';
import ComprasReporte from './pages/reportes/ComprasReporte';
import MovimientosReporte from './pages/reportes/MovimientosReporte';
import './App.css';

const ALMACEN_ROLES  = ['admin', 'almacenero'];
const REPORTE_ROLES  = ['admin', 'almacenero', 'readonly'];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />

            <Route path="solicitudes" element={
              <ProtectedRoute roles={['admin', 'almacenero', 'aprobador', 'solicitante']}>
                <Solicitudes />
              </ProtectedRoute>
            } />

            <Route path="almacenes" element={
              <ProtectedRoute roles={ALMACEN_ROLES}><Almacenes /></ProtectedRoute>
            } />
            <Route path="materiales" element={
              <ProtectedRoute roles={ALMACEN_ROLES}><Materiales /></ProtectedRoute>
            } />
            <Route path="compras" element={
              <ProtectedRoute roles={ALMACEN_ROLES}><Compras /></ProtectedRoute>
            } />
            <Route path="movimientos" element={
              <ProtectedRoute roles={ALMACEN_ROLES}><Movimientos /></ProtectedRoute>
            } />

            <Route path="reportes/existencias" element={
              <ProtectedRoute roles={REPORTE_ROLES}><Existencias /></ProtectedRoute>
            } />
            <Route path="reportes/kardex" element={
              <ProtectedRoute roles={REPORTE_ROLES}><Kardex /></ProtectedRoute>
            } />
            <Route path="reportes/valorizado" element={
              <ProtectedRoute roles={REPORTE_ROLES}><Valorizado /></ProtectedRoute>
            } />
            <Route path="reportes/compras" element={
              <ProtectedRoute roles={REPORTE_ROLES}><ComprasReporte /></ProtectedRoute>
            } />
            <Route path="reportes/movimientos" element={
              <ProtectedRoute roles={REPORTE_ROLES}><MovimientosReporte /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
