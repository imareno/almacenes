import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import FusePageSimple from '@fuse/core/FusePageSimple';
import { styled } from '@mui/material/styles';
import {
	Box,
	Button,
	Chip,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	IconButton,
	List,
	ListItemButton,
	ListItemText,
	ListSubheader,
	MenuItem,
	Paper,
	Stack,
	TextField,
	Tooltip,
	Typography
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import {
	CompraListItem,
	CompraCreateInput,
	CompraDetail,
	CompraItem,
	CompraItemInput,
	getCompras,
	getCompra,
	createCompra,
	updateCompra,
	concluirCompra,
	deleteCompra,
	addCompraItem,
	updateCompraItem,
	deleteCompraItem
} from '../../../api/compras';
import { AlmacenAsignado, getAlmacenesAsignados } from '../../../api/almacenes';
import { getMateriales } from '../../../api/materiales';

// ─── tipos ───────────────────────────────────────────────────────────────────

interface CompraFormState {
	proveedor: string;
	detalle: string;
	fecha: string;
}

interface ItemFormState {
	materialId: number | '';
	cantidad: string;
	precioUnitario: string;
	unidadMedida: string;
}

const COMPRA_FORM_EMPTY: CompraFormState = {
	proveedor: '', detalle: '', fecha: new Date().toISOString().slice(0, 10)
};

const ITEM_FORM_EMPTY: ItemFormState = {
	materialId: '', cantidad: '', precioUnitario: '', unidadMedida: ''
};

const estadoColor: Record<string, 'warning' | 'success' | 'info'> = {
	pendiente: 'warning', concluido: 'success'
};

// ─── layout ──────────────────────────────────────────────────────────────────

const Root = styled(FusePageSimple)(({ theme }) => ({
	'& .FusePageSimple-header': {
		backgroundColor: theme.vars.palette.background.paper,
		borderBottomWidth: 1,
		borderStyle: 'solid',
		borderColor: theme.vars.palette.divider
	}
}));

function useApiError() {
	const { enqueueSnackbar } = useSnackbar();
	return async (err: unknown) => {
		let msg = 'Ocurrió un error inesperado';
		const response = (err as { response?: Response })?.response;
		if (response) {
			try { const body = await response.json(); msg = body?.error ?? msg; } catch { /* */ }
		} else if (err instanceof Error) { msg = err.message; }
		enqueueSnackbar(msg, { variant: 'error' });
	};
}

// ─── componente principal ────────────────────────────────────────────────────

export default function ComprasPage() {
	const { enqueueSnackbar } = useSnackbar();
	const queryClient = useQueryClient();
	const handleApiError = useApiError();

	const [filtroSubAlmacenId, setFiltroSubAlmacenId] = useState<number | ''>('');
	const [filtroEstado, setFiltroEstado] = useState('');
	const [selectedCompraId, setSelectedCompraId] = useState<number | null>(null);

	// diálogo compra
	const [compraDialogOpen, setCompraDialogOpen] = useState(false);
	const [editingCompraId, setEditingCompraId] = useState<number | null>(null);
	const [compraForm, setCompraForm] = useState<CompraFormState>(COMPRA_FORM_EMPTY);
	const [compraErrors, setCompraErrors] = useState<Record<string, string>>({});

	// diálogo item
	const [materialSearch, setMaterialSearch] = useState('');
	const [itemDialogOpen, setItemDialogOpen] = useState(false);
	const [editingItemId, setEditingItemId] = useState<number | null>(null);
	const [itemForm, setItemForm] = useState<ItemFormState>(ITEM_FORM_EMPTY);
	const [itemErrors, setItemErrors] = useState<Record<string, string>>({});

	// confirmaciones
	const [deleteTarget, setDeleteTarget] = useState<CompraListItem | null>(null);
	const [concluirTarget, setConcluirTarget] = useState<CompraListItem | null>(null);
	const [deleteItemTarget, setDeleteItemTarget] = useState<CompraItem | null>(null);

	// ─── queries ──────────────────────────────────────────────────────────────

	const { data: almacenesAsignados = [] } = useQuery({
		queryKey: ['almacenes-asignados'],
		queryFn: getAlmacenesAsignados
	});

	const { data: comprasData, isLoading: loadingCompras } = useQuery({
		queryKey: ['compras', filtroSubAlmacenId, filtroEstado],
		queryFn: () => getCompras({
			subAlmacenId: filtroSubAlmacenId || undefined,
			estado: filtroEstado || undefined,
			pageSize: 100
		}),
		enabled: filtroSubAlmacenId !== ''
	});
	const compras = comprasData?.items ?? [];

	const { data: compraDetail, isLoading: loadingDetail } = useQuery({
		queryKey: ['compra-detail', selectedCompraId],
		queryFn: () => getCompra(selectedCompraId!),
		enabled: selectedCompraId !== null
	});
	const selectedCompra = compraDetail?.compra ?? null;
	const compraItems = compraDetail?.items ?? [];

	const compraAlmacenId = selectedCompra?.almacenId;
	const searchReady = materialSearch.trim().length >= 4;
	const { data: materialesData } = useQuery({
		queryKey: ['materiales-compra', compraAlmacenId, materialSearch.trim()],
		queryFn: () => getMateriales({ almacenId: compraAlmacenId!, buscar: materialSearch.trim(), soloActivos: true, pageSize: 1000 }),
		enabled: compraAlmacenId != null && compraAlmacenId > 0 && searchReady
	});
	const materiales = materialesData?.items ?? [];

	const subAlmacenSeleccionado = filtroSubAlmacenId !== ''
		? almacenesAsignados.flatMap(a => a.subAlmacenes).find(s => s.id === filtroSubAlmacenId)
		: null;

	const invalidateCompras = () => {
		queryClient.invalidateQueries({ queryKey: ['compras'] });
		queryClient.invalidateQueries({ queryKey: ['compra-detail'] });
	};

	// ─── mutaciones compra ────────────────────────────────────────────────────

	const createCompraMut = useMutation({
		mutationFn: (data: CompraCreateInput) => createCompra(data),
		onSuccess: (res) => {
			invalidateCompras();
			setSelectedCompraId(res.id);
			enqueueSnackbar('Compra creada', { variant: 'success' });
			setCompraDialogOpen(false);
		},
		onError: handleApiError
	});

	const updateCompraMut = useMutation({
		mutationFn: ({ id, data }: { id: number; data: CompraCreateInput }) => updateCompra(id, data),
		onSuccess: () => {
			invalidateCompras();
			enqueueSnackbar('Compra actualizada', { variant: 'success' });
			setCompraDialogOpen(false);
		},
		onError: handleApiError
	});

	const concluirMut = useMutation({
		mutationFn: (id: number) => concluirCompra(id),
		onSuccess: (res) => {
			invalidateCompras();
			enqueueSnackbar(`Compra concluida — Nº ${res.numero}`, { variant: 'success' });
			setConcluirTarget(null);
		},
		onError: handleApiError
	});

	const deleteCompraMut = useMutation({
		mutationFn: (id: number) => deleteCompra(id),
		onSuccess: (_, deletedId) => {
			invalidateCompras();
			if (selectedCompraId === deletedId) setSelectedCompraId(null);
			enqueueSnackbar('Compra eliminada', { variant: 'success' });
			setDeleteTarget(null);
		},
		onError: handleApiError
	});

	// ─── mutaciones items ─────────────────────────────────────────────────────

	const addItemMut = useMutation({
		mutationFn: (data: CompraItemInput) => addCompraItem(selectedCompraId!, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['compra-detail', selectedCompraId] });
			enqueueSnackbar('Ítem agregado', { variant: 'success' });
			setItemDialogOpen(false);
		},
		onError: handleApiError
	});

	const updateItemMut = useMutation({
		mutationFn: ({ id, data }: { id: number; data: CompraItemInput }) =>
			updateCompraItem(selectedCompraId!, id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['compra-detail', selectedCompraId] });
			enqueueSnackbar('Ítem actualizado', { variant: 'success' });
			setItemDialogOpen(false);
		},
		onError: handleApiError
	});

	const deleteItemMut = useMutation({
		mutationFn: (id: number) => deleteCompraItem(selectedCompraId!, id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['compra-detail', selectedCompraId] });
			enqueueSnackbar('Ítem eliminado', { variant: 'success' });
			setDeleteItemTarget(null);
		},
		onError: handleApiError
	});

	// ─── handlers compra ──────────────────────────────────────────────────────

	function openCreateCompra() {
		setEditingCompraId(null);
		setCompraForm(COMPRA_FORM_EMPTY);
		setCompraErrors({});
		setCompraDialogOpen(true);
	}

	function openEditCompra(c: CompraListItem) {
		setEditingCompraId(c.id);
		setCompraForm({
			proveedor: c.proveedor,
			detalle: c.detalle,
			fecha: c.fecha.slice(0, 10)
		});
		setCompraErrors({});
		setCompraDialogOpen(true);
	}

	function submitCompra() {
		const next: Record<string, string> = {};
		if (!compraForm.proveedor.trim()) next.proveedor = 'Requerido';
		if (!compraForm.detalle.trim()) next.detalle = 'Requerido';
		if (!compraForm.fecha) next.fecha = 'Requerido';
		setCompraErrors(next);
		if (Object.keys(next).length > 0) return;

		const subAlmacenId = editingCompraId
			? compras.find((c) => c.id === editingCompraId)!.subAlmacenId
			: filtroSubAlmacenId as number;

		const data: CompraCreateInput = {
			proveedor: compraForm.proveedor.trim(),
			detalle: compraForm.detalle.trim(),
			fecha: compraForm.fecha,
			subAlmacenId
		};

		if (editingCompraId) updateCompraMut.mutate({ id: editingCompraId, data });
		else createCompraMut.mutate(data);
	}

	// ─── handlers items ───────────────────────────────────────────────────────

	function openCreateItem() {
		setEditingItemId(null);
		setItemForm(ITEM_FORM_EMPTY);
		setItemErrors({});
		setMaterialSearch('');
		setItemDialogOpen(true);
	}

	function openEditItem(item: CompraItem) {
		setEditingItemId(item.id);
		setItemForm({
			materialId: item.materialId,
			cantidad: String(item.cantidad),
			precioUnitario: String(item.precioUnitario),
			unidadMedida: item.unidadMedida
		});
		setItemErrors({});
		setMaterialSearch(item.materialNombre);
		setItemDialogOpen(true);
	}

	function submitItem() {
		const next: Record<string, string> = {};
		if (itemForm.materialId === '') next.materialId = 'Requerido';
		if (!itemForm.cantidad || Number(itemForm.cantidad) <= 0) next.cantidad = 'Debe ser mayor a 0';
		if (!itemForm.precioUnitario || Number(itemForm.precioUnitario) < 0) next.precioUnitario = 'No puede ser negativo';
		if (!itemForm.unidadMedida.trim()) next.unidadMedida = 'Requerido';
		setItemErrors(next);
		if (Object.keys(next).length > 0) return;

		const data: CompraItemInput = {
			materialId: itemForm.materialId as number,
			cantidad: Number(itemForm.cantidad),
			precioUnitario: Number(itemForm.precioUnitario),
			unidadMedida: itemForm.unidadMedida.trim()
		};

		if (editingItemId) updateItemMut.mutate({ id: editingItemId, data });
		else addItemMut.mutate(data);
	}

	function onMaterialChange(materialId: number | '') {
		setItemForm((p) => ({ ...p, materialId }));
		if (itemErrors.materialId) setItemErrors((p) => ({ ...p, materialId: '' }));
	}

	// ─── columnas items ───────────────────────────────────────────────────────

	const itemColumns: GridColDef<CompraItem>[] = [
		{ field: 'codigo', headerName: 'Código', width: 100, display: 'flex' },
		{ field: 'materialNombre', headerName: 'Material', flex: 1, minWidth: 180, display: 'flex' },
		{ field: 'unidadMedida', headerName: 'Unidad', width: 80, display: 'flex' },
		{
			field: 'cantidad', headerName: 'Cantidad', width: 110, type: 'number', display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2">{Number(value).toLocaleString('es-BO')}</Typography>
		},
		{
			field: 'precioUnitario', headerName: 'P. Unitario', width: 120, type: 'number', display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2">{Number(value).toLocaleString('es-BO', { minimumFractionDigits: 2 })}</Typography>
		},
		{
			field: 'subtotal', headerName: 'Subtotal', width: 130, type: 'number', display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2" fontWeight={600}>{Number(value).toLocaleString('es-BO', { minimumFractionDigits: 2 })}</Typography>
		},
		{
			field: 'actions', headerName: '', width: 80, sortable: false, filterable: false, display: 'flex',
			renderCell: ({ row }) => selectedCompra?.estado === 'pendiente' ? (
				<Stack direction="row">
					<Tooltip title="Editar"><IconButton size="small" onClick={() => openEditItem(row)}><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
					<Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={() => setDeleteItemTarget(row)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
				</Stack>
			) : null
		}
	];

	const totalCompra = useMemo(() => compraItems.reduce((sum, i) => sum + i.subtotal, 0), [compraItems]);
	const isSavingCompra = createCompraMut.isPending || updateCompraMut.isPending;
	const isSavingItem = addItemMut.isPending || updateItemMut.isPending;

	// ─── render ───────────────────────────────────────────────────────────────

	return (
		<Root
			header={
				<Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<Typography variant="h5" fontWeight={600}>Compras</Typography>
				</Box>
			}
			content={
				<Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
					{/* Filtros */}
					<Stack direction="row" spacing={2} alignItems="center">
						<TextField
							select label="Sub-almacén" value={filtroSubAlmacenId}
							onChange={(e) => { setFiltroSubAlmacenId(e.target.value === '' ? '' : Number(e.target.value)); setSelectedCompraId(null); }}
							size="small" sx={{ width: 280 }}
						>
							<MenuItem value=""><em>Todos mis sub-almacenes</em></MenuItem>
							{almacenesAsignados.flatMap((a) => [
								<ListSubheader key={`h-${a.id}`}>{a.nombre}</ListSubheader>,
								...a.subAlmacenes.map((s) => (
									<MenuItem key={s.id} value={s.id}>
										{s.sigla ? `${s.sigla} — ${s.nombre}` : s.nombre}
									</MenuItem>
								))
							])}
						</TextField>
						<TextField
							select label="Estado" value={filtroEstado}
							onChange={(e) => setFiltroEstado(e.target.value)}
							size="small" sx={{ width: 150 }}
						>
							<MenuItem value=""><em>Todos</em></MenuItem>
							<MenuItem value="pendiente">Pendiente</MenuItem>
							<MenuItem value="concluido">Concluido</MenuItem>
						</TextField>
					</Stack>

					<Box sx={{ flex: 1, display: 'flex', gap: 3, minHeight: 0 }}>
						{/* ── Panel izquierdo: compras ── */}
						<Paper variant="outlined" sx={{ flex: '0 0 40%', minWidth: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
							<Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<Typography variant="subtitle1" fontWeight={600}>Compras</Typography>
								<Tooltip title={filtroSubAlmacenId === '' ? 'Seleccione un sub-almacén en el filtro' : ''}>
									<span>
										<Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateCompra} disabled={filtroSubAlmacenId === ''}>
											Nueva Compra
										</Button>
									</span>
								</Tooltip>
							</Box>
							<Divider />
							<List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
								{loadingCompras && <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">Cargando...</Typography></Box>}
								{!loadingCompras && !filtroSubAlmacenId && <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">Seleccione un sub-almacén para ver las compras</Typography></Box>}
								{!loadingCompras && !!filtroSubAlmacenId && compras.length === 0 && <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">Sin compras</Typography></Box>}
								{compras.map((c) => (
									<ListItemButton key={c.id} selected={selectedCompraId === c.id} onClick={() => setSelectedCompraId(c.id)} sx={{ gap: 1 }}>
										<ListItemText
											primary={
												<Stack direction="row" spacing={1} alignItems="center">
													<Typography variant="body2" fontWeight={600}>{c.numero ?? 'Borrador'}</Typography>
													<Chip label={c.estado} color={estadoColor[c.estado] ?? 'default'} size="small" variant="outlined" sx={{ textTransform: 'capitalize', height: 20, fontSize: 11 }} />
												</Stack>
											}
											secondary={`${c.proveedor} — ${new Date(c.fecha).toLocaleDateString('es-BO')}`}
											slotProps={{ secondary: { noWrap: true } }}
										/>
										{c.estado === 'pendiente' && (
											<Stack direction="row" sx={{ flexShrink: 0 }}>
												<Tooltip title="Editar"><IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditCompra(c); }}><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
												<Tooltip title="Concluir"><IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); setConcluirTarget(c); }}><CheckCircleIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
												<Tooltip title="Eliminar"><IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
											</Stack>
										)}
									</ListItemButton>
								))}
							</List>
						</Paper>

						{/* ── Panel derecho: detalle items ── */}
						<Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
							{!selectedCompra ? (
								<Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary' }}>
									<ShoppingCartIcon sx={{ fontSize: 48, opacity: 0.3 }} />
									<Typography variant="body1">Seleccione una compra para ver su detalle</Typography>
								</Box>
							) : (
								<>
									<Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
										<Box>
											<Stack direction="row" spacing={1} alignItems="center">
												<Typography variant="subtitle1" fontWeight={600}>
													{selectedCompra.numero ?? 'Borrador'}
												</Typography>
												<Chip label={selectedCompra.estado} color={estadoColor[selectedCompra.estado] ?? 'default'} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
											</Stack>
											<Typography variant="body2" color="text.secondary">
												{selectedCompra.proveedor} — {selectedCompra.detalle}
											</Typography>
										</Box>
										<Stack direction="row" spacing={1} alignItems="center">
											<Typography variant="subtitle1" fontWeight={600}>
												Total: {totalCompra.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
											</Typography>
											{selectedCompra.estado === 'pendiente' && (
												<Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreateItem}>
													Agregar ítem
												</Button>
											)}
										</Stack>
									</Box>
									<Divider />
									<Box sx={{ flex: 1, p: 2 }}>
										<DataGrid
											rows={compraItems} columns={itemColumns} loading={loadingDetail}
											disableRowSelectionOnClick density="compact" getRowId={(r) => r.id}
											pageSizeOptions={[25, 50]} sx={{ border: 'none', height: '100%' }}
										/>
									</Box>
								</>
							)}
						</Paper>
					</Box>

					{/* ── Diálogo crear/editar compra ── */}
					<Dialog open={compraDialogOpen} onClose={() => setCompraDialogOpen(false)} fullWidth maxWidth="sm">
						<DialogTitle>{editingCompraId ? 'Editar compra' : 'Nueva compra'}</DialogTitle>
						<DialogContent dividers>
							<Stack spacing={2.5} sx={{ pt: 0.5 }}>
								<TextField label="Proveedor *" value={compraForm.proveedor}
									onChange={(e) => { setCompraForm((p) => ({ ...p, proveedor: e.target.value })); if (compraErrors.proveedor) setCompraErrors((p) => ({ ...p, proveedor: '' })); }}
									error={!!compraErrors.proveedor} helperText={compraErrors.proveedor} fullWidth autoFocus />
								<TextField label="Detalle *" value={compraForm.detalle}
									onChange={(e) => { setCompraForm((p) => ({ ...p, detalle: e.target.value })); if (compraErrors.detalle) setCompraErrors((p) => ({ ...p, detalle: '' })); }}
									error={!!compraErrors.detalle} helperText={compraErrors.detalle} fullWidth multiline rows={2} />
								<TextField label="Fecha *" type="date" value={compraForm.fecha}
									onChange={(e) => setCompraForm((p) => ({ ...p, fecha: e.target.value }))}
									error={!!compraErrors.fecha} helperText={compraErrors.fecha} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
								{subAlmacenSeleccionado && (
									<Typography variant="body2" color="text.secondary">
										Sub-almacén: <strong>{subAlmacenSeleccionado.sigla ? `${subAlmacenSeleccionado.sigla} — ${subAlmacenSeleccionado.nombre}` : subAlmacenSeleccionado.nombre}</strong>
									</Typography>
								)}
							</Stack>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setCompraDialogOpen(false)} disabled={isSavingCompra}>Cancelar</Button>
							<Button variant="contained" onClick={submitCompra} disabled={isSavingCompra}>{isSavingCompra ? 'Guardando...' : 'Guardar'}</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo crear/editar ítem ── */}
					<Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)} fullWidth maxWidth="sm">
						<DialogTitle>{editingItemId ? 'Editar ítem' : 'Agregar ítem'}</DialogTitle>
						<DialogContent dividers>
							<Stack spacing={2.5} sx={{ pt: 0.5 }}>
								<TextField
									select label="Material *" value={itemForm.materialId}
									onChange={(e) => onMaterialChange(e.target.value === '' ? '' : Number(e.target.value))}
									error={!!itemErrors.materialId} helperText={itemErrors.materialId}
									fullWidth
									slotProps={{ select: { MenuProps: { PaperProps: { sx: { maxHeight: 450 } } } } }}
								>
									<ListSubheader sx={{ p: 1 }}>
										<TextField
											size="small" placeholder="Escriba al menos 4 letras..."
											fullWidth autoFocus
											value={materialSearch}
											onChange={(e) => setMaterialSearch(e.target.value)}
											onKeyDown={(e) => e.stopPropagation()}
										/>
									</ListSubheader>
									{!searchReady && (
										<MenuItem disabled>Escriba al menos 4 letras para buscar</MenuItem>
									)}
									{searchReady && materiales.length === 0 && (
										<MenuItem disabled>Sin resultados</MenuItem>
									)}
									{materiales.map((m) => (
										<MenuItem key={m.id} value={m.id}>{m.codigo} — {m.nombre}</MenuItem>
									))}
								</TextField>
								<Stack direction="row" spacing={2}>
									<TextField label="Cantidad *" type="number" value={itemForm.cantidad}
										onChange={(e) => { setItemForm((p) => ({ ...p, cantidad: e.target.value })); if (itemErrors.cantidad) setItemErrors((p) => ({ ...p, cantidad: '' })); }}
										error={!!itemErrors.cantidad} helperText={itemErrors.cantidad} sx={{ flex: 1 }} />
									<TextField label="P. Unitario *" type="number" value={itemForm.precioUnitario}
										onChange={(e) => { setItemForm((p) => ({ ...p, precioUnitario: e.target.value })); if (itemErrors.precioUnitario) setItemErrors((p) => ({ ...p, precioUnitario: '' })); }}
										error={!!itemErrors.precioUnitario} helperText={itemErrors.precioUnitario} sx={{ flex: 1 }} />
								</Stack>
								<TextField label="Unidad de medida *" value={itemForm.unidadMedida}
									onChange={(e) => { setItemForm((p) => ({ ...p, unidadMedida: e.target.value })); if (itemErrors.unidadMedida) setItemErrors((p) => ({ ...p, unidadMedida: '' })); }}
									error={!!itemErrors.unidadMedida} helperText={itemErrors.unidadMedida} fullWidth />
							</Stack>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setItemDialogOpen(false)} disabled={isSavingItem}>Cancelar</Button>
							<Button variant="contained" onClick={submitItem} disabled={isSavingItem}>{isSavingItem ? 'Guardando...' : 'Guardar'}</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo concluir ── */}
					<Dialog open={!!concluirTarget} onClose={() => setConcluirTarget(null)} maxWidth="xs" fullWidth>
						<DialogTitle>Concluir compra</DialogTitle>
						<DialogContent><Typography>¿Concluir la compra de <strong>{concluirTarget?.proveedor}</strong>? Se generará el número automáticamente.</Typography></DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setConcluirTarget(null)}>Cancelar</Button>
							<Button variant="contained" color="success" disabled={concluirMut.isPending} onClick={() => concluirTarget && concluirMut.mutate(concluirTarget.id)}>
								{concluirMut.isPending ? 'Procesando...' : 'Concluir'}
							</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo eliminar compra ── */}
					<Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
						<DialogTitle>Eliminar compra</DialogTitle>
						<DialogContent><Typography>¿Eliminar la compra de <strong>{deleteTarget?.proveedor}</strong>?</Typography></DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
							<Button variant="contained" color="error" disabled={deleteCompraMut.isPending} onClick={() => deleteTarget && deleteCompraMut.mutate(deleteTarget.id)}>
								{deleteCompraMut.isPending ? 'Eliminando...' : 'Eliminar'}
							</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo eliminar ítem ── */}
					<Dialog open={!!deleteItemTarget} onClose={() => setDeleteItemTarget(null)} maxWidth="xs" fullWidth>
						<DialogTitle>Eliminar ítem</DialogTitle>
						<DialogContent><Typography>¿Eliminar <strong>{deleteItemTarget?.materialNombre}</strong> de esta compra?</Typography></DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setDeleteItemTarget(null)}>Cancelar</Button>
							<Button variant="contained" color="error" disabled={deleteItemMut.isPending} onClick={() => deleteItemTarget && deleteItemMut.mutate(deleteItemTarget.id)}>
								{deleteItemMut.isPending ? 'Eliminando...' : 'Eliminar'}
							</Button>
						</DialogActions>
					</Dialog>
				</Box>
			}
		/>
	);
}
