import { useEffect, useState } from 'react';
import DataGrid, { Column, Paging } from 'devextreme-react/data-grid';
import { getSolicitudes } from '../api/solicitudes';
import { getExistencias } from '../api/reportes';
import { useAuth } from '../auth/AuthContext';

interface KpiData {
  pendientes: number;
  aprobadas: number;
  stockBajo: number;
  totalMateriales: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [kpis, setKpis]               = useState<KpiData>({ pendientes: 0, aprobadas: 0, stockBajo: 0, totalMateriales: 0 });
  const [solicitudes, setSolicitudes] = useState<object[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [solPend, solApro] = await Promise.all([
          getSolicitudes({ estado: 'pendiente', pageSize: 5 }),
          getSolicitudes({ estado: 'aprobada',  pageSize: 5 }),
        ]);

        let stockBajo = 0;
        let totalMat  = 0;
        if (user?.role === 'admin' || user?.role === 'almacenero' || user?.role === 'readonly') {
          const existencias: { existencia: number }[] = await getExistencias({ soloConStock: false });
          totalMat  = existencias.length;
          stockBajo = existencias.filter(e => e.existencia <= 0).length;
        }

        setKpis({
          pendientes:      solPend.total,
          aprobadas:       solApro.total,
          stockBajo,
          totalMateriales: totalMat,
        });
        setSolicitudes(solPend.items);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const isAlmacen = user?.role === 'admin' || user?.role === 'almacenero' || user?.role === 'readonly';

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>
      <div className="page-body">
        <div className="kpi-grid">
          <div className={`kpi-card${kpis.pendientes > 0 ? ' warning' : ''}`}>
            <div className="kpi-value">{loading ? '…' : kpis.pendientes}</div>
            <div className="kpi-label">Solicitudes pendientes</div>
          </div>
          <div className="kpi-card success">
            <div className="kpi-value">{loading ? '…' : kpis.aprobadas}</div>
            <div className="kpi-label">Solicitudes aprobadas</div>
          </div>
          {isAlmacen && (
            <>
              <div className={`kpi-card${kpis.stockBajo > 0 ? ' danger' : ' success'}`}>
                <div className="kpi-value">{loading ? '…' : kpis.stockBajo}</div>
                <div className="kpi-label">Materiales sin stock</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-value">{loading ? '…' : kpis.totalMateriales}</div>
                <div className="kpi-label">Materiales con movimientos</div>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 14, color: '#1a2238' }}>Solicitudes pendientes de aprobación</h2>
          <DataGrid
            dataSource={solicitudes}
            showBorders={false}
            columnAutoWidth
            noDataText="No hay solicitudes pendientes"
          >
            <Paging enabled={false} />
            <Column dataField="numero"        caption="Número"     width={130} />
            <Column dataField="solicitante"   caption="Solicitante" />
            <Column dataField="almacenNombre" caption="Almacén" />
            <Column dataField="fechaSolicitud" caption="Fecha" dataType="datetime" format="dd/MM/yyyy" width={120} />
            <Column
              dataField="estado"
              caption="Estado"
              width={110}
              cellRender={({ value }) => (
                <span className={`status-badge status-${value}`}>{value}</span>
              )}
            />
          </DataGrid>
        </div>
      </div>
    </>
  );
}
