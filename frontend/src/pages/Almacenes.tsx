import { useEffect, useState, useCallback } from 'react';
import TreeList, { Column, Toolbar, Item as ToolbarItem } from 'devextreme-react/tree-list';
import Button from 'devextreme-react/button';
import Popup from 'devextreme-react/popup';
import Form, { Item } from 'devextreme-react/form';
import { getAlmacenes, createAlmacen, updateAlmacen, deleteAlmacen, type Almacen } from '../api/almacenes';
import notify from 'devextreme/ui/notify';

interface AlmacenForm {
  id?: number;
  nombre: string;
  descripcion: string;
  parentId: number | null;
  active: boolean;
}

const EMPTY: AlmacenForm = { nombre: '', descripcion: '', parentId: null, active: true };

export default function Almacenes() {
  const [data, setData]           = useState<Almacen[]>([]);
  const [, setLoading]             = useState(true);
  const [popup, setPopup]         = useState(false);
  const [form, setForm]           = useState<AlmacenForm>(EMPTY);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getAlmacenes()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm(EMPTY);
    setEditing(false);
    setPopup(true);
  }

  function openEdit(row: Almacen) {
    setForm({ id: row.id, nombre: row.nombre, descripcion: row.descripcion ?? '', parentId: row.parentId ?? null, active: row.active });
    setEditing(true);
    setPopup(true);
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este almacén?')) return;
    try {
      await deleteAlmacen(id);
      notify('Almacén eliminado', 'success', 2000);
      load();
    } catch {
      notify('Error al eliminar', 'error', 2000);
    }
  }

  async function handleSave() {
    if (!form.nombre.trim()) { notify('El nombre es requerido', 'error', 2000); return; }
    setSaving(true);
    try {
      const payload = { nombre: form.nombre.trim(), descripcion: form.descripcion?.trim() || undefined, parentId: form.parentId || undefined, active: form.active };
      if (editing && form.id) await updateAlmacen(form.id, payload);
      else await createAlmacen(payload);
      notify(editing ? 'Almacén actualizado' : 'Almacén creado', 'success', 2000);
      setPopup(false);
      load();
    } catch {
      notify('Error al guardar', 'error', 2000);
    } finally {
      setSaving(false);
    }
  }

  const parentOptions = data.map(a => ({ id: a.id, nombre: a.nombre }));

  return (
    <>
      <div className="page-header">
        <h1>Almacenes</h1>
        <Button text="Nuevo almacén" type="default" icon="add" onClick={openNew} />
      </div>
      <div className="page-body">
        <div className="card" style={{ padding: 0 }}>
          <TreeList
            dataSource={data}
            keyExpr="id"
            parentIdExpr="parentId"
            showBorders={false}
            columnAutoWidth
            noDataText="No hay almacenes"
          >
            <Toolbar>
              <ToolbarItem name="searchPanel" />
            </Toolbar>
            <Column dataField="nombre"      caption="Nombre" />
            <Column dataField="descripcion" caption="Descripción" />
            <Column dataField="active"      caption="Activo" dataType="boolean" width={80} />
            <Column
              caption="Acciones"
              width={120}
              cellRender={({ data: row }: { data: Almacen }) => (
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button text="Editar"    stylingMode="text" type="default" onClick={() => openEdit(row)} />
                  <Button text="Eliminar"  stylingMode="text" type="danger"  onClick={() => handleDelete(row.id)} />
                </div>
              )}
            />
          </TreeList>
        </div>
      </div>

      <Popup
        visible={popup}
        onHiding={() => setPopup(false)}
        title={editing ? 'Editar almacén' : 'Nuevo almacén'}
        width={440}
        height="auto"
        showCloseButton
      >
        <div style={{ padding: '8px 0' }}>
          <Form formData={form} onFieldDataChanged={e => setForm(prev => ({ ...prev, [e.dataField!]: e.value }))}>
            <Item dataField="nombre"      label={{ text: 'Nombre' }}      isRequired />
            <Item dataField="descripcion" label={{ text: 'Descripción' }} editorType="dxTextArea" editorOptions={{ height: 70 }} />
            <Item
              dataField="parentId"
              label={{ text: 'Almacén padre' }}
              editorType="dxSelectBox"
              editorOptions={{ dataSource: parentOptions, valueExpr: 'id', displayExpr: 'nombre', showClearButton: true, placeholder: 'Sin padre (raíz)' }}
            />
            <Item dataField="active" label={{ text: 'Activo' }} editorType="dxSwitch" />
          </Form>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button text="Cancelar" stylingMode="outlined" onClick={() => setPopup(false)} />
            <Button text={saving ? 'Guardando…' : 'Guardar'} type="default" disabled={saving} onClick={handleSave} />
          </div>
        </div>
      </Popup>
    </>
  );
}
