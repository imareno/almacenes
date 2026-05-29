import { useEffect, useState } from 'react';
import DataGrid, { Column, Export, FilterRow, HeaderFilter, SearchPanel, Summary, TotalItem } from 'devextreme-react/data-grid';
import SelectBox from 'devextreme-react/select-box';
import Button from 'devextreme-react/button';
import { getExistencias } from '../../api/reportes';
import { getAlmacenes, type Almacen } from '../../api/almacenes';

export default function Existencias() {
  const [data, setData]         = useState<object[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenId, setAlmacenId] = useState<number | undefined>(undefined);
  const [soloConStock, setSoloConStock] = useState(true);
  const [, setLoading]          = useState(false);

  useEffect(() => { getAlmacenes().then(setAlmacenes); }, []);

  async function buscar() {
    setLoading(true);
    try { setData(await getExistencias({ almacenId, soloConStock })); }
    finally { setLoading(false); }
  }

  useEffect(() => { buscar(); }, []);

  return (
    <>
      <div className="page-header"><h1>Reporte de Existencias</h1></div>
      <div className="page-body">
        <div className="card">
          <div className="toolbar-gap">
            <div>
              <div className="filter-label">Almacén</div>
              <SelectBox dataSource={almacenes} valueExpr="id" displayExpr="nombre" value={almacenId} onValueChanged={e => setAlmacenId(e.value)} showClearButton placeholder="Todos" width={200} />
            </div>
            <div>
              <div className="filter-label">Mostrar</div>
              <SelectBox
                dataSource={[{ v: true, l: 'Solo con stock' }, { v: false, l: 'Todos' }]}
                valueExpr="v" displayExpr="l"
                value={soloConStock} onValueChanged={e => setSoloConStock(e.value)}
                width={150}
              />
            </div>
            <Button text="Buscar" type="default" icon="search" onClick={buscar} />
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <DataGrid dataSource={data} showBorders={false} columnAutoWidth rowAlternationEnabled noDataText="Sin datos">
            <SearchPanel visible />
            <FilterRow visible />
            <HeaderFilter visible />
            <Export enabled />
            <Column dataField="codigo"          caption="Código"    width={100} />
            <Column dataField="materialNombre"  caption="Material" />
            <Column dataField="categoria"       caption="Categoría" width={120} />
            <Column dataField="unidadMedida"    caption="U/M"       width={70} />
            <Column dataField="almacenNombre"   caption="Almacén" />
            <Column dataField="existencia"      caption="Existencia" dataType="number" format="#,##0.###" width={110} />
            <Summary>
              <TotalItem column="existencia" summaryType="sum" valueFormat="#,##0.###" displayFormat="Total: {0}" />
            </Summary>
          </DataGrid>
        </div>
      </div>
    </>
  );
}
