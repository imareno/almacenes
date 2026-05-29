import { useEffect, useState, useCallback } from 'react';
import DataGrid, { Column, FilterRow, HeaderFilter, Pager, Paging, SearchPanel, Toolbar, Item as ToolbarItem } from 'devextreme-react/data-grid';
import Button from 'devextreme-react/button';
import Popup from 'devextreme-react/popup';
import Form, { Item } from 'devextreme-react/form';
import { getMateriales, createMaterial, updateMaterial, type Material } from '../api/materiales';
import notify from 'devextreme/ui/notify';

interface MatForm {
  id?: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  unidadMedida: string;
  categoria: string;
  active: boolean;
}

const EMPTY: MatForm = { codigo: '', nombre: '', descripcion: '', unidadMedida: '', categoria: '', active: true };

const UNIDADES = ['UN', 'KG', 'LT', 'M', 'M2', 'M3', 'CJ', 'BL', 'GL', 'TN', 'PAR', 'PZA'];

export default function Materiales() {
  const [data, setData]       = useState<Material[]>([]);
  const [, setLoading]        = useState(true);
  const [popup, setPopup]     = useState(false);
  const [form, setForm]       = useState<MatForm>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getMateriales()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm(EMPTY); setEditing(false); setPopup(true); }
  function openEdit(row: Material) {
    setForm({ id: row.id, codigo: row.codigo, nombre: row.nombre, descripcion: row.descripcion ?? '', unidadMedida: row.unidadMedida, categoria: row.categoria ?? '', active: row.active });
    setEditing(true);
    setPopup(true);
  }

  async function handleSave() {
    if (!form.codigo.trim() || !form.nombre.trim() || !form.unidadMedida) {
      notify('Código, nombre y unidad de medida son requeridos', 'error', 3000); return;
    }
    setSaving(true);
    try {
      const payload = { codigo: form.codigo.trim(), nombre: form.nombre.trim(), descripcion: form.descripcion?.trim() || undefined, unidadMedida: form.unidadMedida, categoria: form.categoria?.trim() || undefined, active: form.active };
      if (editing && form.id) await updateMaterial(form.id, payload);
      else await createMaterial(payload);
      notify(editing ? 'Material actualizado' : 'Material creado', 'success', 2000);
      setPopup(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar';
      notify(msg, 'error', 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Materiales</h1>
        <Button text="Nuevo material" type="default" icon="add" onClick={openNew} />
      </div>
      <div className="page-body">
        <div className="card" style={{ padding: 0 }}>
          <DataGrid
            dataSource={data}
            keyExpr="id"
            showBorders={false}
            columnAutoWidth
            rowAlternationEnabled
            noDataText="No hay materiales"
          >
            <SearchPanel visible />
            <FilterRow visible />
            <HeaderFilter visible />
            <Paging defaultPageSize={20} />
            <Pager showPageSizeSelector allowedPageSizes={[10, 20, 50]} showInfo />
            <Toolbar>
              <ToolbarItem name="searchPanel" />
            </Toolbar>
            <Column dataField="codigo"       caption="Código"       width={110} />
            <Column dataField="nombre"       caption="Nombre" />
            <Column dataField="categoria"    caption="Categoría"    width={120} />
            <Column dataField="unidadMedida" caption="U/M"          width={70} />
            <Column dataField="active"       caption="Activo"       dataType="boolean" width={80} />
            <Column
              caption="Acciones"
              width={80}
              cellRender={({ data: row }: { data: Material }) => (
                <Button text="Editar" stylingMode="text" type="default" onClick={() => openEdit(row)} />
              )}
            />
          </DataGrid>
        </div>
      </div>

      <Popup visible={popup} onHiding={() => setPopup(false)} title={editing ? 'Editar material' : 'Nuevo material'} width={480} height="auto" showCloseButton>
        <div style={{ padding: '8px 0' }}>
          <Form formData={form} onFieldDataChanged={e => setForm(prev => ({ ...prev, [e.dataField!]: e.value }))}>
            <Item dataField="codigo"       label={{ text: 'Código' }}           isRequired />
            <Item dataField="nombre"       label={{ text: 'Nombre' }}           isRequired />
            <Item dataField="descripcion"  label={{ text: 'Descripción' }}      editorType="dxTextArea" editorOptions={{ height: 60 }} />
            <Item
              dataField="unidadMedida"
              label={{ text: 'Unidad de medida' }}
              editorType="dxSelectBox"
              editorOptions={{ items: UNIDADES, acceptCustomValue: true }}
              isRequired
            />
            <Item dataField="categoria" label={{ text: 'Categoría' }} />
            <Item dataField="active"    label={{ text: 'Activo' }}    editorType="dxSwitch" />
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
