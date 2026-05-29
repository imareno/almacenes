import { useEffect, useState } from 'react';
import DataGrid, { Column, Export, FilterRow, Summary, TotalItem } from 'devextreme-react/data-grid';
import Chart, { Series, Legend, Tooltip, ArgumentAxis, ValueAxis } from 'devextreme-react/chart';
import SelectBox from 'devextreme-react/select-box';
import Button from 'devextreme-react/button';
import DateBox from 'devextreme-react/date-box';
import { getReporteMovimientos } from '../../api/reportes';
import { getAlmacenes, type Almacen } from '../../api/almacenes';

const fmtDate = (v: Date | null) => v ? v.toISOString().slice(0, 10) : undefined;

interface MovRow { id: number; tipo: string; fecha: string; codigo: string; materialNombre: string; unidadMedida: string; almacenNombre: string; cantidad: number; costoUnitario: number; total: number; usuario: string; }

export default function MovimientosReporte() {
  const [data, setData]           = useState<{ resumen: object[]; movimientos: MovRow[] }>({ resumen: [], movimientos: [] });
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenId, setAlmacenId] = useState<number | undefined>(undefined);
  const [tipo, setTipo]           = useState<string | undefined>(undefined);
  const [desde, setDesde]         = useState<string | undefined>(undefined);
  const [hasta, setHasta]         = useState<string | undefined>(undefined);
  const [, setLoading]            = useState(false);

  useEffect(() => { getAlmacenes().then(setAlmacenes); }, []);

  async function buscar() {
    setLoading(true);
    try { setData(await getReporteMovimientos({ almacenId, tipo, desde, hasta })); }
    finally { setLoading(false); }
  }

  useEffect(() => { buscar(); }, []);

  return (
    <>
      <div className="page-header"><h1>Reporte de Movimientos</h1></div>
      <div className="page-body">
        <div className="card">
          <div className="toolbar-gap">
            <div>
              <div className="filter-label">Almacén</div>
              <SelectBox dataSource={almacenes} valueExpr="id" displayExpr="nombre" value={almacenId} onValueChanged={e => setAlmacenId(e.value)} showClearButton placeholder="Todos" width={180} />
            </div>
            <div>
              <div className="filter-label">Tipo</div>
              <SelectBox
                dataSource={[{ v: undefined, l: 'Todos' }, { v: 'ingreso', l: 'Ingreso' }, { v: 'salida', l: 'Salida' }]}
                valueExpr="v" displayExpr="l" value={tipo} onValueChanged={e => setTipo(e.value)} width={130}
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
        </div>

        {data.resumen.length > 0 && (
          <div className="card">
            <Chart dataSource={data.resumen} height={200}>
              <Series valueField="totalValor"    argumentField="tipo" name="Valor"    type="bar" color="#4a90d9" />
              <ArgumentAxis /> <ValueAxis />
              <Legend position="outside" horizontalAlignment="right" />
              <Tooltip enabled format={{ type: 'currency', currency: 'USD', precision: 0 }} />
            </Chart>
          </div>
        )}

        <div className="card" style={{ padding: 0 }}>
          <DataGrid dataSource={data.movimientos} keyExpr="id" showBorders={false} columnAutoWidth rowAlternationEnabled noDataText="Sin datos">
            <FilterRow visible />
            <Export enabled />
            <Column dataField="tipo"           caption="Tipo"    width={90} cellRender={({ value }) => <span className={`status-badge ${value === 'ingreso' ? 'status-aprobada' : 'status-rechazada'}`}>{value}</span>} />
            <Column dataField="fecha"          caption="Fecha"   dataType="date" format="dd/MM/yyyy" width={110} />
            <Column dataField="codigo"         caption="Código"  width={90} />
            <Column dataField="materialNombre" caption="Material" />
            <Column dataField="almacenNombre"  caption="Almacén" />
            <Column dataField="cantidad"       caption="Cantidad" dataType="number" format="#,##0.###"     width={100} />
            <Column dataField="costoUnitario"  caption="Costo U." dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} width={110} />
            <Column dataField="total"          caption="Total"    dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} width={110} />
            <Column dataField="usuario"        caption="Usuario"  width={100} />
            <Summary>
              <TotalItem column="cantidad" summaryType="sum" valueFormat="#,##0.###" displayFormat="{0}" />
              <TotalItem column="total"    summaryType="sum" valueFormat={{ type: 'currency', currency: 'USD', precision: 2 }} displayFormat="Total: {0}" />
            </Summary>
          </DataGrid>
        </div>
      </div>
    </>
  );
}
