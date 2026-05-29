import { useEffect, useState, useCallback } from 'react';
import DataGrid, { Column, FilterRow, Pager, Paging } from 'devextreme-react/data-grid';
import Button from 'devextreme-react/button';
import Popup from 'devextreme-react/popup';
import Form, { Item } from 'devextreme-react/form';
import { getCompras, getCompra, createCompra, confirmarCompra, recibirCompra, type Compra, type CompraItem } from '../api/compras';
import { getMateriales } from '../api/materiales';
import { getAlmacenes } from '../api/almacenes';
import notify from 'devextreme/ui/notify';

const today = () => new Date().toISOString().slice(0, 10);

interface NuevaCompraForm { proveedor: string; fecha: string; }
interface NuevoItem { materialId: number | null; cantidad: number; precioUnitario: number; }
interface RecepcionItem { compraItemId: number; materialId: number; materialNombre: string; cantidad: number; almacenId: number | null; costoUnitario: number; fecha: string; }

export default function Compras() {
  const [data, setData]           = useState<Compra[]>([]);
  const [, setLoading]             = useState(true);
  const [popupNew, setPopupNew]   = useState(false);
  const [popupDet, setPopupDet]   = useState(false);
  const [popupRec, setPopupRec]   = useState(false);
  const [selected, setSelected]   = useState<{ compra: Compra; items: CompraItem[] } | null>(null);
  const [form, setForm]           = useState<NuevaCompraForm>({ proveedor: '', fecha: today() });
  const [items, setItems]         = useState<NuevoItem[]>([{ materialId: null, cantidad: 1, precioUnitario: 0 }]);
  const [recItems, setRecItems]   = useState<RecepcionItem[]>([]);
  const [materiales, setMateriales] = useState<{ id: number; nombre: string }[]>([]);
  const [almacenes, setAlmacenes]   = useState<{ id: number; nombre: string }[]>([]);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData((await getCompras()).items); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    Promise.all([getMateriales(), getAlmacenes()]).then(([mats, alms]) => {
      setMateriales(mats.map(m => ({ id: m.id, nombre: `${m.codigo} - ${m.nombre}` })));
      setAlmacenes(alms);
    });
  }, [load]);

  async function openDetalle(id: number) {
    const det = await getCompra(id);
    setSelected(det);
    setPopupDet(true);
  }

  async function openRecibir(id: number) {
    const det = await getCompra(id);
    setSelected(det);
    setRecItems(det.items.map(i => ({
      compraItemId:  i.id,
      materialId:    i.materialId,
      materialNombre: i.materialNombre ?? '',
      cantidad:      i.cantidad,
      almacenId:     null,
      costoUnitario: i.precioUnitario,
      fecha:         today(),
    })));
    setPopupRec(true);
  }

  async function handleCrear() {
    if (!form.proveedor.trim()) { notify('El proveedor es requerido', 'error', 2000); return; }
    if (items.some(i => !i.materialId || i.cantidad <= 0)) { notify('Complete todos los ítems', 'error', 2000); return; }
    setSaving(true);
    try {
      await createCompra({ proveedor: form.proveedor.trim(), fecha: form.fecha, items: items.map(i => ({ materialId: i.materialId!, cantidad: i.cantidad, precioUnitario: i.precioUnitario })) });
      notify('Compra creada', 'success', 2000);
      setPopupNew(false);
      load();
    } catch (err: unknown) {
      notify((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error', 'error', 3000);
    } finally { setSaving(false); }
  }

  async function handleConfirmar(id: number) {
    try { await confirmarCompra(id); notify('Compra confirmada', 'success', 2000); load(); setPopupDet(false); }
    catch { notify('Error al confirmar', 'error', 2000); }
  }

  async function handleRecibir() {
    if (recItems.some(i => !i.almacenId)) { notify('Seleccione almacén para todos los ítems', 'error', 2000); return; }
    setSaving(true);
    try {
      await recibirCompra(selected!.compra.id, { fecha: recItems[0].fecha, items: recItems.map(i => ({ compraItemId: i.compraItemId, almacenId: i.almacenId! })) });
      notify('Compra recibida', 'success', 2000);
      setPopupRec(false);
      load();
    } catch (err: unknown) {
      notify((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error', 'error', 3000);
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="page-header">
        <h1>Compras</h1>
        <Button text="Nueva compra" type="default" icon="add" onClick={() => { setForm({ proveedor: '', fecha: today() }); setItems([{ materialId: null, cantidad: 1, precioUnitario: 0 }]); setPopupNew(true); }} />
      </div>
      <div className="page-body">
        <div className="card" style={{ padding: 0 }}>
          <DataGrid dataSource={data} keyExpr="id" showBorders={false} columnAutoWidth rowAlternationEnabled noDataText="No hay compras">
            <FilterRow visible />
            <Paging defaultPageSize={20} />
            <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />
            <Column dataField="numero"   caption="Número"    width={150} />
            <Column dataField="proveedor" caption="Proveedor" />
            <Column dataField="fecha"    caption="Fecha"     dataType="date" format="dd/MM/yyyy" width={120} />
            <Column dataField="estado"   caption="Estado"    width={120}
              cellRender={({ value }) => <span className={`status-badge status-${value}`}>{value}</span>}
            />
            <Column
              caption="Acciones"
              width={200}
              cellRender={({ data: row }: { data: Compra }) => (
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button text="Ver" stylingMode="text" type="default" onClick={() => openDetalle(row.id)} />
                  {row.estado === 'confirmada' && <Button text="Recibir" stylingMode="text" type="success" onClick={() => openRecibir(row.id)} />}
                </div>
              )}
            />
          </DataGrid>
        </div>
      </div>

      {/* Nueva compra */}
      <Popup visible={popupNew} onHiding={() => setPopupNew(false)} title="Nueva compra" width={600} height="auto" showCloseButton>
        <div style={{ padding: '8px 0' }}>
          <Form formData={form} onFieldDataChanged={e => setForm(prev => ({ ...prev, [e.dataField!]: e.value }))}>
            <Item dataField="proveedor" label={{ text: 'Proveedor' }} isRequired />
            <Item dataField="fecha"     label={{ text: 'Fecha' }}     editorType="dxDateBox" editorOptions={{ displayFormat: 'dd/MM/yyyy', type: 'date' }} isRequired />
          </Form>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Ítems</div>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <div style={{ flex: 2 }}>
                  <select style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid #ccc' }}
                    value={item.materialId ?? ''} onChange={e => { const v = [...items]; v[idx].materialId = +e.target.value; setItems(v); }}>
                    <option value="">-- Material --</option>
                    {materiales.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <input type="number" placeholder="Cantidad" min="0.001" step="0.001" style={{ width: 90, padding: '6px', borderRadius: 4, border: '1px solid #ccc' }}
                  value={item.cantidad} onChange={e => { const v = [...items]; v[idx].cantidad = +e.target.value; setItems(v); }} />
                <input type="number" placeholder="Precio U." min="0" step="0.01" style={{ width: 100, padding: '6px', borderRadius: 4, border: '1px solid #ccc' }}
                  value={item.precioUnitario} onChange={e => { const v = [...items]; v[idx].precioUnitario = +e.target.value; setItems(v); }} />
                {items.length > 1 && <Button icon="trash" stylingMode="text" type="danger" onClick={() => setItems(items.filter((_, i) => i !== idx))} />}
              </div>
            ))}
            <Button text="+ Agregar ítem" stylingMode="text" type="default" onClick={() => setItems([...items, { materialId: null, cantidad: 1, precioUnitario: 0 }])} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button text="Cancelar" stylingMode="outlined" onClick={() => setPopupNew(false)} />
            <Button text={saving ? 'Guardando…' : 'Crear compra'} type="default" disabled={saving} onClick={handleCrear} />
          </div>
        </div>
      </Popup>

      {/* Detalle */}
      <Popup visible={popupDet} onHiding={() => setPopupDet(false)} title={`Compra ${selected?.compra.numero ?? ''}`} width={600} height="auto" showCloseButton>
        {selected && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontSize: 14 }}>
              <div><b>Proveedor:</b> {selected.compra.proveedor}</div>
              <div><b>Fecha:</b> {new Date(selected.compra.fecha).toLocaleDateString('es-PE')}</div>
              <div><b>Estado:</b> <span className={`status-badge status-${selected.compra.estado}`}>{selected.compra.estado}</span></div>
            </div>
            <DataGrid dataSource={selected.items} showBorders columnAutoWidth noDataText="Sin ítems">
              <Column dataField="codigo"         caption="Código"   width={100} />
              <Column dataField="materialNombre"  caption="Material" />
              <Column dataField="cantidad"        caption="Cantidad" dataType="number" />
              <Column dataField="precioUnitario"  caption="Precio U." dataType="number" format={{ type: 'currency', currency: 'USD', precision: 2 }} />
            </DataGrid>
            {selected.compra.estado === 'borrador' && (
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Button text="Confirmar compra" type="default" onClick={() => handleConfirmar(selected.compra.id)} />
              </div>
            )}
          </div>
        )}
      </Popup>

      {/* Recepción */}
      <Popup visible={popupRec} onHiding={() => setPopupRec(false)} title="Recibir compra" width={640} height="auto" showCloseButton>
        <div style={{ padding: '8px 0' }}>
          {recItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', fontSize: 13 }}>
              <div style={{ flex: 1 }}>{item.materialNombre}</div>
              <div>Cant: {item.cantidad}</div>
              <select style={{ padding: '4px', borderRadius: 4, border: '1px solid #ccc', flex: 1 }}
                value={item.almacenId ?? ''} onChange={e => { const v = [...recItems]; v[idx].almacenId = +e.target.value; setRecItems(v); }}>
                <option value="">-- Almacén --</option>
                {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          ))}
          {recItems[0] && (
            <div style={{ marginTop: 8 }}>
              <div className="filter-label">Fecha de recepción</div>
              <input type="date" style={{ padding: '6px', borderRadius: 4, border: '1px solid #ccc' }}
                value={recItems[0].fecha}
                onChange={e => setRecItems(recItems.map(i => ({ ...i, fecha: e.target.value })))}
              />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button text="Cancelar" stylingMode="outlined" onClick={() => setPopupRec(false)} />
            <Button text={saving ? 'Procesando…' : 'Confirmar recepción'} type="success" disabled={saving} onClick={handleRecibir} />
          </div>
        </div>
      </Popup>
    </>
  );
}
