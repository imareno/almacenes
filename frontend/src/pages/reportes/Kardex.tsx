import { useState } from 'react';
import DataGrid, { Column, Export, Summary, TotalItem } from 'devextreme-react/data-grid';
import SelectBox from 'devextreme-react/select-box';
import Button from 'devextreme-react/button';
import DateBox from 'devextreme-react/date-box';
import { getKardex } from '../../api/reportes';
import { getMateriales, type Material } from '../../api/materiales';
import { getAlmacenes, type Almacen } from '../../api/almacenes';
import { useEffect } from 'react';

export default function Kardex() {
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [almacenes, setAlmacenes]   = useState<Almacen[]>([]);
  const [materialId, setMaterialId] = useState<number | undefined>(undefined);
  const [almacenId, setAlmacenId]   = useState<number | undefined>(undefined);
  const [desde, setDesde]           = useState<string | undefined>(undefined);
  const [hasta, setHasta]           = useState<string | undefined>(undefined);
  const [data, setData]             = useState<{ material: object; movimientos: object[] } | null>(null);
  const [, setLoading]              = useState(false);

  useEffect(() => {
    Promise.all([getMateriales(), getAlmacenes()]).then(([mats, alms]) => { setMateriales(mats); setAlmacenes(alms); });
  }, []);

  async function buscar() {
    if (!materialId) return;
    setLoading(true);
    try { setData(await getKardex(materialId, { almacenId, desde, hasta })); }
    finally { setLoading(false); }
  }

  const fmtDate = (v: Date | null) => v ? v.toISOString().slice(0, 10) : undefined;

  return (
    <>
      <div className="page-header"><h1>Kardex de Material</h1></div>
      <div className="page-body">
        <div className="card">
          <div className="toolbar-gap">
            <div>
              <div className="filter-label">Material *</div>
              <SelectBox
                dataSource={materiales.map(m => ({ id: m.id, nombre: `${m.codigo} - ${m.nombre}` }))}
                valueExpr="id" displayExpr="nombre"
                value={materialId} onValueChanged={e => setMaterialId(e.value)}
                searchEnabled width={280} placeholder="Seleccione material"
              />
            </div>
            <div>
              <div className="filter-label">Almacén</div>
              <SelectBox dataSource={almacenes} valueExpr="id" displayExpr="nombre" value={almacenId} onValueChanged={e => setAlmacenId(e.value)} showClearButton placeholder="Todos" width={180} />
            </div>
            <div>
              <div className="filter-label">Desde</div>
              <DateBox value={desde} onValueChanged={e => setDesde(fmtDate(e.value))} displayFormat="dd/MM/yyyy" type="date" width={130} showClearButton />
            </div>
            <div>
              <div className="filter-label">Hasta</div>
              <DateBox value={hasta} onValueChanged={e => setHasta(fmtDate(e.value))} displayFormat="dd/MM/yyyy" type="date" width={130} showClearButton />
            </div>
            <Button text="Buscar" type="default" icon="search" onClick={buscar} disabled={!materialId} />
          </div>
        </div>

        {data && (
          <div className="card" style={{ padding: 0 }}>
            <DataGrid dataSource={data.movimientos} showBorders={false} columnAutoWidth rowAlternationEnabled noDataText="Sin movimientos">
              <Export enabled />
              <Column dataField="tipo"          caption="Tipo"     width={90}
                cellRender={({ value }) => <span className={`status-badge ${value === 'ingreso' ? 'status-aprobada' : 'status-rechazada'}`}>{value}</span>}
              />
              <Column dataField="fecha"         caption="Fecha"    dataType="date" format="dd/MM/yyyy" width={110} />
              <Column dataField="almacenNombre" caption="Almacén" />
              <Column dataField="cantidad"      caption="Cantidad" dataType="number" format="#,##0.###" width={100} />
              <Column dataField="costoUnitario" caption="Costo U." dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} width={110} />
              <Column dataField="total"         caption="Total"    dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} width={110} />
              <Column dataField="saldo"         caption="Saldo"    dataType="number" format="#,##0.###" width={100} />
              <Column dataField="loteRef"       caption="Lote ref" width={100} />
              <Column dataField="usuario"       caption="Usuario"  width={100} />
              <Column dataField="observacion"   caption="Obs."     width={150} />
              <Summary>
                <TotalItem column="cantidad" summaryType="sum" valueFormat="#,##0.###" displayFormat="Total: {0}" />
                <TotalItem column="total"    summaryType="sum" valueFormat={{ type: 'currency', currency: 'USD', precision: 2 }} displayFormat="Total: {0}" />
              </Summary>
            </DataGrid>
          </div>
        )}
      </div>
    </>
  );
}
