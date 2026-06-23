import { useState } from 'react';
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
	Paper,
	Stack,
	TextField,
	Tooltip,
	Typography
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbarQuickFilter } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import {
	Almacen,
	AlmacenInput,
	SubAlmacen,
	SubAlmacenInput,
	getAlmacenes,
	createAlmacen,
	updateAlmacen,
	deleteAlmacen,
	getSubAlmacenes,
	createSubAlmacen,
	updateSubAlmacen,
	deleteSubAlmacen
} from '../../../api/almacenes';

// ─── tipos ───────────────────────────────────────────────────────────────────

interface FormState {
	nombre: string;
	sigla: string;
	descripcion: string;
}

const FORM_EMPTY: FormState = { nombre: '', sigla: '', descripcion: '' };

type DialogTarget = 'almacen' | 'sub';

// ─── layout ──────────────────────────────────────────────────────────────────

const Root = styled(FusePageSimple)(({ theme }) => ({
	'& .FusePageSimple-header': {
		backgroundColor: theme.vars.palette.background.paper,
		borderBottomWidth: 1,
		borderStyle: 'solid',
		borderColor: theme.vars.palette.divider
	}
}));

// ─── hook errores ky ─────────────────────────────────────────────────────────

function useApiError() {
	const { enqueueSnackbar } = useSnackbar();
	return async (err: unknown) => {
		let msg = 'Ocurrió un error inesperado';
		const response = (err as { response?: Response })?.response;
		if (response) {
			try {
				const body = await response.json();
				msg = body?.error ?? msg;
			} catch { /* ignorar */ }
		} else if (err instanceof Error) {
			msg = err.message;
		}
		enqueueSnackbar(msg, { variant: 'error' });
	};
}

// ─── componente principal ────────────────────────────────────────────────────

export default function AlmacenesPage() {
	const { enqueueSnackbar } = useSnackbar();
	const queryClient = useQueryClient();
	const handleApiError = useApiError();

	const [selectedAlmacenId, setSelectedAlmacenId] = useState<number | null>(null);

	// diálogo crear/editar
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogTarget, setDialogTarget] = useState<DialogTarget>('almacen');
	const [editingId, setEditingId] = useState<number | null>(null);
	const [form, setForm] = useState<FormState>(FORM_EMPTY);
	const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

	// diálogo eliminar
	const [deleteInfo, setDeleteInfo] = useState<{ target: DialogTarget; id: number; nombre: string } | null>(null);

	// ─── queries ──────────────────────────────────────────────────────────────

	const { data: almacenes = [], isLoading: loadingAlmacenes } = useQuery({
		queryKey: ['almacenes'],
		queryFn: () => getAlmacenes(false)
	});

	const { data: subAlmacenes = [], isLoading: loadingSubs } = useQuery({
		queryKey: ['sub-almacenes', selectedAlmacenId],
		queryFn: () => getSubAlmacenes(selectedAlmacenId!, false),
		enabled: selectedAlmacenId !== null
	});

	const selectedAlmacen = almacenes.find((a) => a.id === selectedAlmacenId) ?? null;

	// ─── mutaciones almacén ───────────────────────────────────────────────────

	const createAlmacenMut = useMutation({
		mutationFn: (data: AlmacenInput) => createAlmacen(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['almacenes'] });
			enqueueSnackbar('Almacén creado', { variant: 'success' });
			setDialogOpen(false);
		},
		onError: handleApiError
	});

	const updateAlmacenMut = useMutation({
		mutationFn: ({ id, data }: { id: number; data: AlmacenInput }) => updateAlmacen(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['almacenes'] });
			enqueueSnackbar('Almacén actualizado', { variant: 'success' });
			setDialogOpen(false);
		},
		onError: handleApiError
	});

	const deleteAlmacenMut = useMutation({
		mutationFn: (id: number) => deleteAlmacen(id),
		onSuccess: (_, deletedId) => {
			queryClient.invalidateQueries({ queryKey: ['almacenes'] });
			if (selectedAlmacenId === deletedId) setSelectedAlmacenId(null);
			enqueueSnackbar('Almacén eliminado', { variant: 'success' });
			setDeleteInfo(null);
		},
		onError: handleApiError
	});

	// ─── mutaciones sub-almacén ───────────────────────────────────────────────

	const createSubMut = useMutation({
		mutationFn: (data: SubAlmacenInput) => createSubAlmacen(selectedAlmacenId!, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sub-almacenes', selectedAlmacenId] });
			enqueueSnackbar('Sub-almacén creado', { variant: 'success' });
			setDialogOpen(false);
		},
		onError: handleApiError
	});

	const updateSubMut = useMutation({
		mutationFn: ({ id, data }: { id: number; data: SubAlmacenInput }) =>
			updateSubAlmacen(selectedAlmacenId!, id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sub-almacenes', selectedAlmacenId] });
			enqueueSnackbar('Sub-almacén actualizado', { variant: 'success' });
			setDialogOpen(false);
		},
		onError: handleApiError
	});

	const deleteSubMut = useMutation({
		mutationFn: (id: number) => deleteSubAlmacen(selectedAlmacenId!, id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sub-almacenes', selectedAlmacenId] });
			enqueueSnackbar('Sub-almacén eliminado', { variant: 'success' });
			setDeleteInfo(null);
		},
		onError: handleApiError
	});

	// ─── handlers diálogo ─────────────────────────────────────────────────────

	function openCreateDialog(target: DialogTarget) {
		setDialogTarget(target);
		setEditingId(null);
		setForm(FORM_EMPTY);
		setErrors({});
		setDialogOpen(true);
	}

	function openEditAlmacen(a: Almacen) {
		setDialogTarget('almacen');
		setEditingId(a.id);
		setForm({ nombre: a.nombre, sigla: '', descripcion: a.descripcion ?? '' });
		setErrors({});
		setDialogOpen(true);
	}

	function openEditSub(s: SubAlmacen) {
		setDialogTarget('sub');
		setEditingId(s.id);
		setForm({ nombre: s.nombre, sigla: s.sigla ?? '', descripcion: s.descripcion ?? '' });
		setErrors({});
		setDialogOpen(true);
	}

	function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
		if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
	}

	function handleSubmit() {
		const next: Partial<Record<keyof FormState, string>> = {};
		if (!form.nombre.trim()) next.nombre = 'El nombre es requerido';
		setErrors(next);
		if (Object.keys(next).length > 0) return;

		if (dialogTarget === 'almacen') {
			const data: AlmacenInput = {
				nombre: form.nombre.trim(),
				descripcion: form.descripcion.trim() || undefined
			};
			if (editingId) updateAlmacenMut.mutate({ id: editingId, data });
			else createAlmacenMut.mutate(data);
		} else {
			const data: SubAlmacenInput = {
				nombre: form.nombre.trim(),
				sigla: form.sigla.trim() || undefined,
				descripcion: form.descripcion.trim() || undefined
			};
			if (editingId) updateSubMut.mutate({ id: editingId, data });
			else createSubMut.mutate(data);
		}
	}

	function confirmDelete() {
		if (!deleteInfo) return;
		if (deleteInfo.target === 'almacen') deleteAlmacenMut.mutate(deleteInfo.id);
		else deleteSubMut.mutate(deleteInfo.id);
	}

	// ─── columnas sub-almacenes ───────────────────────────────────────────────

	const subColumns: GridColDef<SubAlmacen>[] = [
		{
			field: 'sigla',
			headerName: 'Sigla',
			width: 100,
			display: 'flex',
			renderCell: ({ value }) => (
				<Typography variant="body2" color="text.secondary">
					{value || '—'}
				</Typography>
			)
		},
		{
			field: 'nombre',
			headerName: 'Sub-almacén',
			flex: 1,
			minWidth: 180,
			display: 'flex'
		},
		{
			field: 'descripcion',
			headerName: 'Descripción',
			flex: 1.5,
			minWidth: 200,
			display: 'flex',
			renderCell: ({ value }) => (
				<Typography variant="body2" color="text.secondary" noWrap title={value}>
					{value || '—'}
				</Typography>
			)
		},
		{
			field: 'active',
			headerName: 'Estado',
			width: 110,
			display: 'flex',
			renderCell: ({ value }) => (
				<Chip
					label={value ? 'Activo' : 'Inactivo'}
					color={value ? 'success' : 'default'}
					size="small"
					variant="outlined"
				/>
			)
		},
		{
			field: 'actions',
			headerName: 'Acciones',
			width: 100,
			sortable: false,
			filterable: false,
			display: 'flex',
			renderCell: ({ row }) => (
				<Stack direction="row">
					<Tooltip title="Editar">
						<IconButton size="small" onClick={() => openEditSub(row)}>
							<EditIcon fontSize="small" />
						</IconButton>
					</Tooltip>
					<Tooltip title="Eliminar">
						<IconButton
							size="small"
							color="error"
							onClick={() => setDeleteInfo({ target: 'sub', id: row.id, nombre: row.nombre })}
						>
							<DeleteIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Stack>
			)
		}
	];

	const isSaving =
		createAlmacenMut.isPending ||
		updateAlmacenMut.isPending ||
		createSubMut.isPending ||
		updateSubMut.isPending;

	const isDeleting = deleteAlmacenMut.isPending || deleteSubMut.isPending;

	const dialogLabel = dialogTarget === 'almacen' ? 'almacén' : 'sub-almacén';

	// ─── render ───────────────────────────────────────────────────────────────

	return (
		<Root
			header={
				<Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<Typography variant="h5" fontWeight={600}>
						Almacenes
					</Typography>
				</Box>
			}
			content={
				<Box sx={{ p: 3, height: '100%', display: 'flex', gap: 3 }}>
					{/* ── Panel izquierdo: almacenes ── */}
					<Paper
						variant="outlined"
						sx={{
							flex: '0 0 30%',
							minWidth: 280,
							display: 'flex',
							flexDirection: 'column',
							overflow: 'hidden'
						}}
					>
						<Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<Typography variant="subtitle1" fontWeight={600}>
								Almacenes
							</Typography>
							<Tooltip title="Nuevo almacén">
								<IconButton size="small" color="primary" onClick={() => openCreateDialog('almacen')}>
									<AddIcon />
								</IconButton>
							</Tooltip>
						</Box>
						<Divider />
						<List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
							{loadingAlmacenes && (
								<Box sx={{ p: 2, textAlign: 'center' }}>
									<Typography variant="body2" color="text.secondary">
										Cargando...
									</Typography>
								</Box>
							)}
							{!loadingAlmacenes && almacenes.length === 0 && (
								<Box sx={{ p: 2, textAlign: 'center' }}>
									<Typography variant="body2" color="text.secondary">
										Sin almacenes
									</Typography>
								</Box>
							)}
							{almacenes.map((a) => (
								<ListItemButton
									key={a.id}
									selected={selectedAlmacenId === a.id}
									onClick={() => setSelectedAlmacenId(a.id)}
									sx={{ gap: 1 }}
								>
									<WarehouseIcon fontSize="small" color={a.active ? 'primary' : 'disabled'} />
									<ListItemText
										primary={a.nombre}
										secondary={a.descripcion || undefined}
										slotProps={{
											primary: { noWrap: true },
											secondary: { noWrap: true }
										}}
									/>
									<Stack direction="row" sx={{ flexShrink: 0 }}>
										<Tooltip title="Editar">
											<IconButton
												size="small"
												onClick={(e) => {
													e.stopPropagation();
													openEditAlmacen(a);
												}}
											>
												<EditIcon sx={{ fontSize: 16 }} />
											</IconButton>
										</Tooltip>
										<Tooltip title="Eliminar">
											<IconButton
												size="small"
												color="error"
												onClick={(e) => {
													e.stopPropagation();
													setDeleteInfo({ target: 'almacen', id: a.id, nombre: a.nombre });
												}}
											>
												<DeleteIcon sx={{ fontSize: 16 }} />
											</IconButton>
										</Tooltip>
									</Stack>
								</ListItemButton>
							))}
						</List>
					</Paper>

					{/* ── Panel derecho: sub-almacenes ── */}
					<Paper
						variant="outlined"
						sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
					>
						{!selectedAlmacen ? (
							<Box
								sx={{
									flex: 1,
									display: 'flex',
									flexDirection: 'column',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 1,
									color: 'text.secondary'
								}}
							>
								<WarehouseIcon sx={{ fontSize: 48, opacity: 0.3 }} />
								<Typography variant="body1">
									Seleccione un almacén para ver sus sub-almacenes
								</Typography>
							</Box>
						) : (
							<>
								<Box
									sx={{
										p: 2,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between'
									}}
								>
									<Box>
										<Typography variant="subtitle1" fontWeight={600}>
											{selectedAlmacen.nombre}
										</Typography>
										{selectedAlmacen.descripcion && (
											<Typography variant="body2" color="text.secondary">
												{selectedAlmacen.descripcion}
											</Typography>
										)}
									</Box>
									<Button
										variant="contained"
										size="small"
										startIcon={<AddIcon />}
										onClick={() => openCreateDialog('sub')}
									>
										Nuevo sub-almacén
									</Button>
								</Box>
								<Divider />
								<Box sx={{ flex: 1, p: 2 }}>
									<DataGrid
										rows={subAlmacenes}
										columns={subColumns}
										loading={loadingSubs}
										disableRowSelectionOnClick
										density="comfortable"
										getRowId={(r) => r.id}
										slots={{
											toolbar: () => (
												<Box sx={{ p: 1, pb: 0 }}>
													<GridToolbarQuickFilter slotProps={{ root: { placeholder: 'Buscar sub-almacén...' } }} />
												</Box>
											)
										}}
										initialState={{
											pagination: { paginationModel: { pageSize: 25 } }
										}}
										pageSizeOptions={[10, 25, 50]}
										sx={{ border: 'none', height: '100%' }}
									/>
								</Box>
							</>
						)}
					</Paper>

					{/* ── Diálogo crear / editar (compartido) ── */}
					<Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
						<DialogTitle>
							{editingId ? `Editar ${dialogLabel}` : `Nuevo ${dialogLabel}`}
						</DialogTitle>
						<DialogContent dividers>
							<Stack spacing={2.5} sx={{ pt: 0.5 }}>
								<TextField
									label="Nombre *"
									value={form.nombre}
									onChange={(e) => setField('nombre', e.target.value)}
									error={!!errors.nombre}
									helperText={errors.nombre}
									fullWidth
									autoFocus
								/>
								{dialogTarget === 'sub' && (
									<TextField
										label="Sigla"
										value={form.sigla}
										onChange={(e) => setField('sigla', e.target.value)}
										fullWidth
										inputProps={{ maxLength: 20 }}
									/>
								)}
								<TextField
									label="Descripción"
									value={form.descripcion}
									onChange={(e) => setField('descripcion', e.target.value)}
									fullWidth
									multiline
									rows={2}
								/>
							</Stack>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setDialogOpen(false)} disabled={isSaving}>
								Cancelar
							</Button>
							<Button variant="contained" onClick={handleSubmit} disabled={isSaving}>
								{isSaving ? 'Guardando...' : 'Guardar'}
							</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo confirmar eliminación ── */}
					<Dialog open={!!deleteInfo} onClose={() => setDeleteInfo(null)} maxWidth="xs" fullWidth>
						<DialogTitle>Confirmar eliminación</DialogTitle>
						<DialogContent>
							<Typography>
								¿Eliminar {deleteInfo?.target === 'almacen' ? 'el almacén' : 'el sub-almacén'}{' '}
								<strong>{deleteInfo?.nombre}</strong>? Esta acción no se puede deshacer.
							</Typography>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setDeleteInfo(null)}>Cancelar</Button>
							<Button
								variant="contained"
								color="error"
								disabled={isDeleting}
								onClick={confirmDelete}
							>
								{isDeleting ? 'Eliminando...' : 'Eliminar'}
							</Button>
						</DialogActions>
					</Dialog>
				</Box>
			}
		/>
	);
}
