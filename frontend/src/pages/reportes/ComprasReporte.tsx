import { useEffect, useState } from 'react';
import DataGrid, { Column, Export, FilterRow, Summary, TotalItem } from 'devextreme-react/data-grid';
import Chart, { Series, Legend, Tooltip, ArgumentAxis, ValueAxis } from 'devextreme-react/chart';
import SelectBox from 'devextreme-react/select-box';
import Button from 'devextreme-react/button';
import DateBox from 'devextreme-react/date-box';
import { getReporteCompras } from '../../api/reportes';

const fmtDate = (v: Date | null) => v ? v.toISOString().slice(0, 10) : undefined;

interface CompraRow { id: number; numero: string; proveedor: string; fecha: string; estado: string; usuario: string; totalItems: number; montoTotal?: number; }

export default function ComprasReporte() {
  const [data, setData]       = useState<{ montoTotal: number; items: CompraRow[] }>({ montoTotal: 0, items: [] });
  const [estado, setEstado]   = useState<string | undefined>(undefined);
  const [desde, setDesde]     = useState<string | undefined>(undefined);
  const [hasta, setHasta]     = useState<string | undefined>(undefined);
  const [, setLoading]        = useState(false);

  async function buscar() {
    setLoading(true);
    try { setData(await getReporteCompras({ estado, desde, hasta })); }
    finally { setLoading(false); }
  }

  useEffect(() => { buscar(); }, []);

  const chartData = Object.entries(
    data.items.reduce((acc: Record<string, number>, c) => {
      const mes = c.fecha.slice(0, 7);
      acc[mes] = (acc[mes] ?? 0) + (c.montoTotal ?? 0);
      return acc;
    }, {})
  ).map(([mes, monto]) => ({ mes, monto }));

  return (
    <>
      <div className="page-header"><h1>Reporte de Compras</h1></div>
      <div className="page-body">
        <div className="card">
          <div className="toolbar-gap">
            <div>
              <div className="filter-label">Estado</div>
              <SelectBox
                dataSource={[{ v: undefined, l: 'Todos' }, { v: 'borrador', l: 'Borrador' }, { v: 'confirmada', l: 'Confirmada' }, { v: 'recibida', l: 'Recibida' }]}
                valueExpr="v" displayExpr="l" value={estado} onValueChanged={e => setEstado(e.value)} width={150}
              />
            </div>
            <div>
              <div className="filter-label">Desde</div>
              <DateBox value={desde} onValueChanged={e => setDesde(fmtDate(e.value))} displayFormat="dd/MM/yyyy" type="date" width={130} showClearButton />
            </div>
            <div>
              <div className="filter-label">Hasta</div>
              <DateBox value={hasta} onValueChanged={e => setHasta(fmtDate(e.value))} displayFormat="dd/MM/yyyy" type="date" width={130} showClearButton />
            </div>
            <Button text="Buscar" type="default" icon="search" onClick={buscar} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a2238', marginTop: 8 }}>
            Monto total: <span style={{ color: '#059669' }}>{data.montoTotal.toLocaleString('es-PE', { style: 'currency', currency: 'USD' })}</span>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="card">
            <Chart dataSource={chartData} height={220}>
              <Series valueField="monto" argumentField="mes" name="Monto" type="bar" color="#4a90d9" />
              <ArgumentAxis /> <ValueAxis />
              <Legend visible={false} />
              <Tooltip enabled format={{ type: 'currency', currency: 'USD', precision: 0 }} />
            </Chart>
          </div>
        )}

        <div className="card" style={{ padding: 0 }}>
          <DataGrid dataSource={data.items} keyExpr="id" showBorders={false} columnAutoWidth rowAlternationEnabled noDataText="Sin datos">
            <FilterRow visible />
            <Export enabled />
            <Column dataField="numero"     caption="Número"    width={150} />
            <Column dataField="proveedor"  caption="Proveedor" />
            <Column dataField="fecha"      caption="Fecha"     dataType="date" format="dd/MM/yyyy" width={110} />
            <Column dataField="estado"     caption="Estado"    width={110} cellRender={({ value }) => <span className={`status-badge status-${value}`}>{value}</span>} />
            <Column dataField="totalItems" caption="Ítems"     dataType="number" width={70} />
            <Column dataField="montoTotal" caption="Monto"     dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} width={130} />
            <Column dataField="usuario"    caption="Usuario"   width={110} />
            <Summary>
              <TotalItem column="montoTotal" summaryType="sum" valueFormat={{ type: 'currency', currency: 'USD', precision: 2 }} displayFormat="Total: {0}" />
            </Summary>
          </DataGrid>
        </div>
      </div>
    </>
  );
}
