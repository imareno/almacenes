import { useEffect, useState, useCallback } from 'react';
import DataGrid, { Column, FilterRow, Pager, Paging, SearchPanel } from 'devextreme-react/data-grid';
import Button from 'devextreme-react/button';
import Popup from 'devextreme-react/popup';
import Form, { Item } from 'devextreme-react/form';
import { getMovimientos, registrarIngreso, registrarSalida, type Movimiento } from '../api/movimientos';
import { getMateriales } from '../api/materiales';
import { getAlmacenes } from '../api/almacenes';
import notify from 'devextreme/ui/notify';

interface MovForm {
  tipo: 'ingreso' | 'salida';
  materialId: number | null;
  almacenId: number | null;
  cantidad: number;
  costoUnitario: number;
  fecha: string;
  loteRef: string;
  observacion: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = (tipo: 'ingreso' | 'salida'): MovForm => ({ tipo, materialId: null, almacenId: null, cantidad: 0, costoUnitario: 0, fecha: today(), loteRef: '', observacion: '' });

export default function Movimientos() {
  const [data, setData]           = useState<Movimiento[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [, setLoading]             = useState(true);
  const [popup, setPopup]         = useState(false);
  const [form, setForm]           = useState<MovForm>(EMPTY('ingreso'));
  const [saving, setSaving]       = useState(false);
  const [materiales, setMateriales] = useState<{ id: number; nombre: string; codigo: string }[]>([]);
  const [almacenes, setAlmacenes]   = useState<{ id: number; nombre: string }[]>([]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await getMovimientos({ page: p, pageSize: 20 });
      setData(res.items);
      setTotal(res.total);
      setPage(p);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    Promise.all([getMateriales(), getAlmacenes()]).then(([mats, alms]) => {
      setMateriales(mats.map(m => ({ id: m.id, nombre: `${m.codigo} - ${m.nombre}`, codigo: m.codigo })));
      setAlmacenes(alms.map(a => ({ id: a.id, nombre: a.nombre })));
    });
  }, [load]);

  function openModal(tipo: 'ingreso' | 'salida') { setForm(EMPTY(tipo)); setPopup(true); }

  async function handleSave() {
    if (!form.materialId || !form.almacenId || form.cantidad <= 0) {
      notify('Material, almacén y cantidad son requeridos', 'error', 3000); return;
    }
    setSaving(true);
    try {
      if (form.tipo === 'ingreso') {
        await registrarIngreso({
          materialId: form.materialId!, almacenId: form.almacenId!, cantidad: form.cantidad,
          costoUnitario: form.costoUnitario, fecha: form.fecha,
          loteRef: form.loteRef || undefined, observacion: form.observacion || undefined,
        });
      } else {
        await registrarSalida({
          materialId: form.materialId!, almacenId: form.almacenId!, cantidad: form.cantidad,
          fecha: form.fecha, loteRef: form.loteRef || undefined, observacion: form.observacion || undefined,
        });
      }
      notify(`${form.tipo === 'ingreso' ? 'Ingreso' : 'Salida'} registrado`, 'success', 2000);
      setPopup(false);
      load(1);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al registrar';
      notify(msg, 'error', 3000);
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="page-header">
        <h1>Movimientos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button text="Registrar ingreso" type="success"  icon="arrowdown" onClick={() => openModal('ingreso')} />
          <Button text="Registrar salida"  type="danger"   icon="arrowup"   onClick={() => openModal('salida')} />
        </div>
      </div>
      <div className="page-body">
        <div className="card" style={{ padding: 0 }}>
          <DataGrid dataSource={data} keyExpr="id" showBorders={false} columnAutoWidth rowAlternationEnabled noDataText="No hay movimientos">
            <SearchPanel visible />
            <FilterRow visible />
            <Paging pageSize={20} pageIndex={page - 1} onPageIndexChange={p => load(p + 1)} />
            <Pager showInfo infoText={`{0} de ${total} registros`} />
            <Column dataField="tipo"           caption="Tipo"    width={90}
              cellRender={({ value }) => <span className={`status-badge ${value === 'ingreso' ? 'status-aprobada' : 'status-rechazada'}`}>{value}</span>}
            />
            <Column dataField="fecha"          caption="Fecha"   dataType="date" format="dd/MM/yyyy" width={110} />
            <Column dataField="codigo"         caption="Código"  width={100} />
            <Column dataField="materialNombre" caption="Material" />
            <Column dataField="almacenNombre"  caption="Almacén" />
            <Column dataField="cantidad"       caption="Cantidad" dataType="number" width={90} />
            <Column dataField="costoUnitario"  caption="Costo U." dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} width={110} />
            <Column dataField="total"          caption="Total"    dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} width={110} />
            <Column dataField="usuario"        caption="Usuario"  width={110} />
            <Column dataField="observacion"    caption="Obs."     width={150} />
          </DataGrid>
        </div>
      </div>

      <Popup visible={popup} onHiding={() => setPopup(false)} title={form.tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar salida'} width={500} height="auto" showCloseButton>
        <div style={{ padding: '8px 0' }}>
          <Form formData={form} onFieldDataChanged={e => setForm(prev => ({ ...prev, [e.dataField!]: e.value }))}>
            <Item
              dataField="materialId"
              label={{ text: 'Material' }}
              editorType="dxSelectBox"
              editorOptions={{ dataSource: materiales, valueExpr: 'id', displayExpr: 'nombre', searchEnabled: true }}
              isRequired
            />
            <Item
              dataField="almacenId"
              label={{ text: 'Almacén' }}
              editorType="dxSelectBox"
              editorOptions={{ dataSource: almacenes, valueExpr: 'id', displayExpr: 'nombre' }}
              isRequired
            />
            <Item dataField="cantidad"      label={{ text: 'Cantidad' }}         editorType="dxNumberBox" editorOptions={{ min: 0.001, format: '#,##0.###' }} isRequired />
            {form.tipo === 'ingreso' && (
              <Item dataField="costoUnitario" label={{ text: 'Costo unitario' }} editorType="dxNumberBox" editorOptions={{ min: 0, format: '#,##0.00' }} />
            )}
            <Item dataField="fecha"       label={{ text: 'Fecha' }}             editorType="dxDateBox" editorOptions={{ displayFormat: 'dd/MM/yyyy', type: 'date' }} isRequired />
            <Item dataField="loteRef"     label={{ text: 'Referencia lote' }} />
            <Item dataField="observacion" label={{ text: 'Observación' }}       editorType="dxTextArea" editorOptions={{ height: 60 }} />
          </Form>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button text="Cancelar" stylingMode="outlined" onClick={() => setPopup(false)} />
            <Button text={saving ? 'Guardando…' : 'Registrar'} type={form.tipo === 'ingreso' ? 'success' : 'danger'} disabled={saving} onClick={handleSave} />
          </div>
        </div>
      </Popup>
    </>
  );
}
