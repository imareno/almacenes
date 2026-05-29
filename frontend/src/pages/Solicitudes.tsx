import { useEffect, useState, useCallback } from 'react';
import DataGrid, { Column, FilterRow, Pager, Paging } from 'devextreme-react/data-grid';
import Button from 'devextreme-react/button';
import Popup from 'devextreme-react/popup';
import TextArea from 'devextreme-react/text-area';
import { getSolicitudes, getSolicitud, createSolicitud, aprobarSolicitud, rechazarSolicitud, cancelarSolicitud, despacharSolicitud, entregarSolicitud, type Solicitud, type SolicitudItem } from '../api/solicitudes';
import { getMateriales } from '../api/materiales';
import { getAlmacenes } from '../api/almacenes';
import { useAuth } from '../auth/AuthContext';
import notify from 'devextreme/ui/notify';

const today = () => new Date().toISOString().slice(0, 10);

interface NuevaSolItem { materialId: number | null; cantidad: number; }
interface DespachoItemForm { solicitudItemId: number; materialNombre: string; cantidadSolicitada: number; cantidadDespachada: number; }
interface EntregaItemForm  { solicitudItemId: number; materialNombre: string; cantidadDespachada: number;  cantidadEntregada: number; }

export default function Solicitudes() {
  const { user }            = useAuth();
  const role                = user?.role ?? '';
  const [data, setData]     = useState<Solicitud[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [, setLoading]        = useState(true);

  const [popupNew,  setPopupNew]  = useState(false);
  const [popupDet,  setPopupDet]  = useState(false);
  const [popupRech, setPopupRech] = useState(false);
  const [popupDesp, setPopupDesp] = useState(false);
  const [popupEntr, setPopupEntr] = useState(false);

  const [detalle, setDetalle]     = useState<{ solicitud: Solicitud; items: SolicitudItem[] } | null>(null);
  const [rechObs, setRechObs]     = useState('');
  const [despachoItems, setDespachoItems] = useState<DespachoItemForm[]>([]);
  const [entregaItems,  setEntregaItems]  = useState<EntregaItemForm[]>([]);
  const [fechaDesp, setFechaDesp] = useState(today());
  const [fechaEntr, setFechaEntr] = useState(today());

  const [newAlmacenId, setNewAlmacenId] = useState<number | null>(null);
  const [newItems, setNewItems]         = useState<NuevaSolItem[]>([{ materialId: null, cantidad: 1 }]);
  const [newObs,   setNewObs]           = useState('');

  const [materiales, setMateriales] = useState<{ id: number; nombre: string }[]>([]);
  const [almacenes, setAlmacenes]   = useState<{ id: number; nombre: string }[]>([]);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await getSolicitudes({ page: p, pageSize: 20 });
      setData(res.items); setTotal(res.total); setPage(p);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    Promise.all([getMateriales(), getAlmacenes()]).then(([mats, alms]) => {
      setMateriales(mats.map(m => ({ id: m.id, nombre: `${m.codigo} - ${m.nombre}` })));
      setAlmacenes(alms);
    });
  }, [load]);

  async function openDetalle(id: number) {
    const det = await getSolicitud(id);
    setDetalle(det); setPopupDet(true);
  }

  async function openDespachar(id: number) {
    const det = await getSolicitud(id);
    setDetalle(det);
    setDespachoItems(det.items.map(i => ({ solicitudItemId: i.id, materialNombre: i.materialNombre, cantidadSolicitada: i.cantidadSolicitada, cantidadDespachada: i.cantidadSolicitada })));
    setFechaDesp(today());
    setPopupDesp(true);
  }

  async function openEntregar(id: number) {
    const det = await getSolicitud(id);
    setDetalle(det);
    setEntregaItems(det.items.map(i => ({ solicitudItemId: i.id, materialNombre: i.materialNombre, cantidadDespachada: i.cantidadDespachada, cantidadEntregada: i.cantidadDespachada })));
    setFechaEntr(today());
    setPopupEntr(true);
  }

  async function handleAprobar(id: number) {
    try { await aprobarSolicitud(id); notify('Solicitud aprobada', 'success', 2000); load(); setPopupDet(false); }
    catch { notify('Error al aprobar', 'error', 2000); }
  }

  async function handleRechazar(id: number) {
    try { await rechazarSolicitud(id, rechObs); notify('Solicitud rechazada', 'success', 2000); setPopupRech(false); setPopupDet(false); load(); }
    catch { notify('Error al rechazar', 'error', 2000); }
  }

  async function handleCancelar(id: number) {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    try { await cancelarSolicitud(id); notify('Solicitud cancelada', 'success', 2000); load(); setPopupDet(false); }
    catch { notify('Error al cancelar', 'error', 2000); }
  }

  async function handleDespachar() {
    if (despachoItems.some(i => i.cantidadDespachada <= 0)) { notify('Las cantidades deben ser mayores a 0', 'error', 2000); return; }
    setSaving(true);
    try {
      await despacharSolicitud(detalle!.solicitud.id, { fecha: fechaDesp, items: despachoItems.map(i => ({ solicitudItemId: i.solicitudItemId, cantidadDespachada: i.cantidadDespachada })) });
      notify('Despacho registrado', 'success', 2000);
      setPopupDesp(false); load();
    } catch (err: unknown) {
      notify((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error', 'error', 3000);
    } finally { setSaving(false); }
  }

  async function handleEntregar() {
    setSaving(true);
    try {
      await entregarSolicitud(detalle!.solicitud.id, { fecha: fechaEntr, items: entregaItems.map(i => ({ solicitudItemId: i.solicitudItemId, cantidadEntregada: i.cantidadEntregada })) });
      notify('Entrega registrada', 'success', 2000);
      setPopupEntr(false); load();
    } catch (err: unknown) {
      notify((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error', 'error', 3000);
    } finally { setSaving(false); }
  }

  async function handleCrear() {
    if (!newAlmacenId) { notify('Seleccione almacén', 'error', 2000); return; }
    if (newItems.some(i => !i.materialId || i.cantidad <= 0)) { notify('Complete todos los ítems', 'error', 2000); return; }
    setSaving(true);
    try {
      await createSolicitud({ almacenId: newAlmacenId, items: newItems.map(i => ({ materialId: i.materialId!, cantidad: i.cantidad })), observacion: newObs || undefined });
      notify('Solicitud creada', 'success', 2000);
      setPopupNew(false); load();
    } catch (err: unknown) {
      notify((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error', 'error', 3000);
    } finally { setSaving(false); }
  }

  const canCreate  = role === 'admin' || role === 'solicitante';
  const canAprobar = role === 'admin' || role === 'aprobador';
  const canDespachar = role === 'admin' || role === 'almacenero';

  return (
    <>
      <div className="page-header">
        <h1>Solicitudes</h1>
        {canCreate && <Button text="Nueva solicitud" type="default" icon="add" onClick={() => { setNewAlmacenId(null); setNewItems([{ materialId: null, cantidad: 1 }]); setNewObs(''); setPopupNew(true); }} />}
      </div>
      <div className="page-body">
        <div className="card" style={{ padding: 0 }}>
          <DataGrid dataSource={data} keyExpr="id" showBorders={false} columnAutoWidth rowAlternationEnabled noDataText="No hay solicitudes">
            <FilterRow visible />
            <Paging pageSize={20} pageIndex={page - 1} onPageIndexChange={p => load(p + 1)} />
            <Pager showInfo infoText={`{0} de ${total} registros`} />
            <Column dataField="numero"        caption="Número"      width={150} />
            <Column dataField="solicitante"   caption="Solicitante" />
            <Column dataField="almacenNombre" caption="Almacén" />
            <Column dataField="fechaSolicitud" caption="Fecha" dataType="datetime" format="dd/MM/yyyy" width={110} />
            <Column dataField="estado" caption="Estado" width={120}
              cellRender={({ value }) => <span className={`status-badge status-${value}`}>{value}</span>}
            />
            <Column
              caption="Acciones"
              width={200}
              cellRender={({ data: row }: { data: Solicitud }) => (
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button text="Ver" stylingMode="text" type="default" onClick={() => openDetalle(row.id)} />
                  {canDespachar && row.estado === 'aprobada'   && <Button text="Despachar" stylingMode="text" type="success" onClick={() => openDespachar(row.id)} />}
                  {canDespachar && row.estado === 'despachada' && <Button text="Entregar"  stylingMode="text" type="normal"  onClick={() => openEntregar(row.id)} />}
                </div>
              )}
            />
          </DataGrid>
        </div>
      </div>

      {/* Nueva solicitud */}
      <Popup visible={popupNew} onHiding={() => setPopupNew(false)} title="Nueva solicitud" width={580} height="auto" showCloseButton>
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 12 }}>
            <div className="filter-label">Almacén *</div>
            <select style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }}
              value={newAlmacenId ?? ''} onChange={e => setNewAlmacenId(+e.target.value)}>
              <option value="">-- Seleccione almacén --</option>
              {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Materiales solicitados</div>
          {newItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select style={{ flex: 2, padding: '6px', borderRadius: 4, border: '1px solid #ccc' }}
                value={item.materialId ?? ''} onChange={e => { const v = [...newItems]; v[idx].materialId = +e.target.value; setNewItems(v); }}>
                <option value="">-- Material --</option>
                {materiales.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              <input type="number" placeholder="Cantidad" min="0.001" step="0.001" style={{ width: 90, padding: '6px', borderRadius: 4, border: '1px solid #ccc' }}
                value={item.cantidad} onChange={e => { const v = [...newItems]; v[idx].cantidad = +e.target.value; setNewItems(v); }} />
              {newItems.length > 1 && <Button icon="trash" stylingMode="text" type="danger" onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))} />}
            </div>
          ))}
          <Button text="+ Agregar ítem" stylingMode="text" type="default" onClick={() => setNewItems([...newItems, { materialId: null, cantidad: 1 }])} />
          <div style={{ marginTop: 12 }}>
            <div className="filter-label">Observación</div>
            <TextArea value={newObs} onValueChanged={e => setNewObs(e.value)} height={60} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button text="Cancelar" stylingMode="outlined" onClick={() => setPopupNew(false)} />
            <Button text={saving ? 'Enviando…' : 'Crear solicitud'} type="default" disabled={saving} onClick={handleCrear} />
          </div>
        </div>
      </Popup>

      {/* Detalle */}
      <Popup visible={popupDet} onHiding={() => setPopupDet(false)} title={`Solicitud ${detalle?.solicitud.numero ?? ''}`} width={620} height="auto" showCloseButton>
        {detalle && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14, fontSize: 13 }}>
              <div><b>Solicitante:</b> {detalle.solicitud.solicitante}</div>
              <div><b>Almacén:</b>     {detalle.solicitud.almacenNombre}</div>
              <div><b>Estado:</b> <span className={`status-badge status-${detalle.solicitud.estado}`}>{detalle.solicitud.estado}</span></div>
              <div><b>Fecha:</b> {new Date(detalle.solicitud.fechaSolicitud).toLocaleDateString('es-PE')}</div>
              {detalle.solicitud.observacion && <div style={{ gridColumn: '1/-1' }}><b>Obs:</b> {detalle.solicitud.observacion}</div>}
            </div>
            <DataGrid dataSource={detalle.items} showBorders columnAutoWidth noDataText="Sin ítems">
              <Column dataField="codigo"              caption="Código"       width={90} />
              <Column dataField="materialNombre"       caption="Material" />
              <Column dataField="unidadMedida"         caption="U/M"         width={60} />
              <Column dataField="cantidadSolicitada"   caption="Solicitada"  dataType="number" width={90} />
              <Column dataField="cantidadDespachada"   caption="Despachada"  dataType="number" width={90} />
              <Column dataField="cantidadEntregada"    caption="Entregada"   dataType="number" width={90} />
            </DataGrid>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              {canAprobar && detalle.solicitud.estado === 'pendiente' && (
                <>
                  <Button text="Rechazar" type="danger"   onClick={() => { setRechObs(''); setPopupRech(true); }} />
                  <Button text="Aprobar"  type="success"  onClick={() => handleAprobar(detalle.solicitud.id)} />
                </>
              )}
              {canCreate && detalle.solicitud.estado === 'pendiente' && user?.id === detalle.solicitud.solicitanteId && (
                <Button text="Cancelar solicitud" type="danger" onClick={() => handleCancelar(detalle.solicitud.id)} />
              )}
            </div>
          </div>
        )}
      </Popup>

      {/* Rechazar */}
      <Popup visible={popupRech} onHiding={() => setPopupRech(false)} title="Rechazar solicitud" width={440} height="auto" showCloseButton>
        <div style={{ padding: '8px 0' }}>
          <div className="filter-label" style={{ marginBottom: 6 }}>Motivo de rechazo</div>
          <TextArea value={rechObs} onValueChanged={e => setRechObs(e.value)} height={80} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button text="Cancelar" stylingMode="outlined" onClick={() => setPopupRech(false)} />
            <Button text="Confirmar rechazo" type="danger" onClick={() => handleRechazar(detalle!.solicitud.id)} />
          </div>
        </div>
      </Popup>

      {/* Despachar */}
      <Popup visible={popupDesp} onHiding={() => setPopupDesp(false)} title="Despachar solicitud" width={580} height="auto" showCloseButton>
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 12 }}>
            <div className="filter-label">Fecha de despacho</div>
            <input type="date" value={fechaDesp} onChange={e => setFechaDesp(e.target.value)} style={{ padding: '6px', borderRadius: 4, border: '1px solid #ccc' }} />
          </div>
          {despachoItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center', fontSize: 13 }}>
              <div style={{ flex: 1 }}>{item.materialNombre}</div>
              <div>Sol: {item.cantidadSolicitada}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>Despachar:</span>
                <input type="number" min="0.001" step="0.001" max={item.cantidadSolicitada} style={{ width: 80, padding: '4px', borderRadius: 4, border: '1px solid #ccc' }}
                  value={item.cantidadDespachada}
                  onChange={e => { const v = [...despachoItems]; v[idx].cantidadDespachada = +e.target.value; setDespachoItems(v); }} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button text="Cancelar" stylingMode="outlined" onClick={() => setPopupDesp(false)} />
            <Button text={saving ? 'Procesando…' : 'Confirmar despacho'} type="success" disabled={saving} onClick={handleDespachar} />
          </div>
        </div>
      </Popup>

      {/* Entregar */}
      <Popup visible={popupEntr} onHiding={() => setPopupEntr(false)} title="Confirmar entrega" width={580} height="auto" showCloseButton>
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: 12 }}>
            <div className="filter-label">Fecha de entrega</div>
            <input type="date" value={fechaEntr} onChange={e => setFechaEntr(e.target.value)} style={{ padding: '6px', borderRadius: 4, border: '1px solid #ccc' }} />
          </div>
          {entregaItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center', fontSize: 13 }}>
              <div style={{ flex: 1 }}>{item.materialNombre}</div>
              <div>Despachado: {item.cantidadDespachada}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>Entregado:</span>
                <input type="number" min="0" step="0.001" max={item.cantidadDespachada} style={{ width: 80, padding: '4px', borderRadius: 4, border: '1px solid #ccc' }}
                  value={item.cantidadEntregada}
                  onChange={e => { const v = [...entregaItems]; v[idx].cantidadEntregada = +e.target.value; setEntregaItems(v); }} />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button text="Cancelar" stylingMode="outlined" onClick={() => setPopupEntr(false)} />
            <Button text={saving ? 'Procesando…' : 'Confirmar entrega'} type="normal" disabled={saving} onClick={handleEntregar} />
          </div>
        </div>
      </Popup>
    </>
  );
}
