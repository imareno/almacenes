import { useEffect, useState } from 'react';
import DataGrid, { Column, Export, FilterRow, HeaderFilter, SearchPanel, Summary, TotalItem } from 'devextreme-react/data-grid';
import SelectBox from 'devextreme-react/select-box';
import Button from 'devextreme-react/button';
import { getValorizado } from '../../api/reportes';
import { getAlmacenes, type Almacen } from '../../api/almacenes';

export default function Valorizado() {
  const [data, setData]           = useState<{ total: number; items: object[] }>({ total: 0, items: [] });
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenId, setAlmacenId] = useState<number | undefined>(undefined);
  const [, setLoading]            = useState(false);

  useEffect(() => { getAlmacenes().then(setAlmacenes); }, []);

  async function buscar() {
    setLoading(true);
    try { setData(await getValorizado({ almacenId })); }
    finally { setLoading(false); }
  }

  useEffect(() => { buscar(); }, []);

  const fmt = (n: number) => n.toLocaleString('es-PE', { style: 'currency', currency: 'USD' });

  return (
    <>
      <div className="page-header"><h1>Inventario Valorizado (PEPS)</h1></div>
      <div className="page-body">
        <div className="card">
          <div className="toolbar-gap">
            <div>
              <div className="filter-label">Almacén</div>
              <SelectBox dataSource={almacenes} valueExpr="id" displayExpr="nombre" value={almacenId} onValueChanged={e => setAlmacenId(e.value)} showClearButton placeholder="Todos" width={200} />
            </div>
            <Button text="Buscar" type="default" icon="search" onClick={buscar} />
          </div>
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: '#1a2238' }}>
            Valor total del inventario: <span style={{ color: '#059669' }}>{fmt(data.total)}</span>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <DataGrid dataSource={data.items} showBorders={false} columnAutoWidth rowAlternationEnabled noDataText="Sin datos">
            <SearchPanel visible />
            <FilterRow visible />
            <HeaderFilter visible />
            <Export enabled />
            <Column dataField="codigo"         caption="Código"      width={100} />
            <Column dataField="materialNombre" caption="Material" />
            <Column dataField="categoria"      caption="Categoría"   width={120} />
            <Column dataField="unidadMedida"   caption="U/M"         width={70} />
            <Column dataField="almacenNombre"  caption="Almacén" />
            <Column dataField="cantidad"       caption="Cantidad"     dataType="number" format="#,##0.###"     width={100} />
            <Column dataField="costoPromedio"  caption="Costo Prom." dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} width={120} />
            <Column dataField="valorTotal"     caption="Valor Total"  dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} width={130} />
            <Summary>
              <TotalItem column="valorTotal" summaryType="sum" valueFormat={{ type: 'currency', currency: 'USD', precision: 2 }} displayFormat="Total: {0}" />
            </Summary>
          </DataGrid>
        </div>
      </div>
    </>
  );
}
