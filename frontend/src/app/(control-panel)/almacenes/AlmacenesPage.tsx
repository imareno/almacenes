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
	FormControlLabel,
	IconButton,
	MenuItem,
	Stack,
	Switch,
	TextField,
	Tooltip,
	Typography
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbarQuickFilter } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import {
	Almacen,
	AlmacenInput,
	getAlmacenes,
	createAlmacen,
	updateAlmacen,
	deleteAlmacen
} from '../../../api/almacenes';

// ─── tipos internos ──────────────────────────────────────────────────────────

interface AlmacenRow extends Almacen {
	depth: number;
}

interface FormState {
	nombre: string;
	descripcion: string;
	parentId: number | '';
	active: boolean;
}

const FORM_EMPTY: FormState = { nombre: '', descripcion: '', parentId: '', active: true };

// ─── helpers árbol ───────────────────────────────────────────────────────────

function buildTreeRows(almacenes: Almacen[]): AlmacenRow[] {
	const byParent = new Map<number | null, Almacen[]>();

	for (const a of almacenes) {
		const key = a.parentId ?? null;
		if (!byParent.has(key)) byParent.set(key, []);
		byParent.get(key)!.push(a);
	}

	const rows: AlmacenRow[] = [];

	function traverse(parentId: number | null, depth: number) {
		const children = (byParent.get(parentId) ?? []).sort((a, b) =>
			a.nombre.localeCompare(b.nombre, 'es')
		);
		for (const child of children) {
			rows.push({ ...child, depth });
			traverse(child.id, depth + 1);
		}
	}

	traverse(null, 0);
	return rows;
}

function hasDescendants(id: number, almacenes: Almacen[]): boolean {
	return almacenes.some((a) => a.parentId === id);
}

// ─── layout ──────────────────────────────────────────────────────────────────

const Root = styled(FusePageSimple)(({ theme }) => ({
	'& .FusePageSimple-header': {
		backgroundColor: theme.vars.palette.background.paper,
		borderBottomWidth: 1,
		borderStyle: 'solid',
		borderColor: theme.vars.palette.divider
	}
}));

// ─── componente principal ─────────────────────────────────────────────────────

export default function AlmacenesPage() {
	const { enqueueSnackbar } = useSnackbar();
	const queryClient = useQueryClient();

	const { data: almacenes = [], isLoading } = useQuery({
		queryKey: ['almacenes'],
		queryFn: () => getAlmacenes(false)
	});

	const rows = useMemo(() => buildTreeRows(almacenes), [almacenes]);

	// estado diálogo create/edit
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [form, setForm] = useState<FormState>(FORM_EMPTY);
	const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

	// estado diálogo eliminar
	const [deleteTarget, setDeleteTarget] = useState<AlmacenRow | null>(null);

	// ─── mutaciones ───────────────────────────────────────────────────────────

	const invalidate = () => queryClient.invalidateQueries({ queryKey: ['almacenes'] });

	const handleApiError = async (err: unknown) => {
		let msg = 'Ocurrió un error inesperado';
		if (err instanceof Response) {
			try {
				const body = await err.json();
				msg = body?.error ?? msg;
			} catch { /* ignorar */ }
		} else if (err instanceof Error) {
			msg = err.message;
		}
		enqueueSnackbar(msg, { variant: 'error' });
	};

	const createMutation = useMutation({
		mutationFn: (data: AlmacenInput) => createAlmacen(data),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Almacén creado correctamente', { variant: 'success' });
			setDialogOpen(false);
		},
		onError: handleApiError
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, data }: { id: number; data: AlmacenInput }) => updateAlmacen(id, data),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Almacén actualizado correctamente', { variant: 'success' });
			setDialogOpen(false);
		},
		onError: handleApiError
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deleteAlmacen(id),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Almacén eliminado correctamente', { variant: 'success' });
			setDeleteTarget(null);
		},
		onError: handleApiError
	});

	// ─── handlers diálogo form ────────────────────────────────────────────────

	function openCreate() {
		setEditingId(null);
		setForm(FORM_EMPTY);
		setErrors({});
		setDialogOpen(true);
	}

	function openEdit(row: AlmacenRow) {
		setEditingId(row.id);
		setForm({
			nombre: row.nombre,
			descripcion: row.descripcion ?? '',
			parentId: row.parentId ?? '',
			active: row.active
		});
		setErrors({});
		setDialogOpen(true);
	}

	function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
		if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
	}

	function validate(): boolean {
		const next: Partial<Record<keyof FormState, string>> = {};
		if (!form.nombre.trim()) next.nombre = 'El nombre es requerido';
		if (editingId && form.parentId === editingId) {
			next.parentId = 'Un almacén no puede ser su propio superior';
		}
		setErrors(next);
		return Object.keys(next).length === 0;
	}

	function handleSubmit() {
		if (!validate()) return;
		const data: AlmacenInput = {
			nombre: form.nombre.trim(),
			descripcion: form.descripcion.trim() || undefined,
			parentId: form.parentId === '' ? null : (form.parentId as number),
			active: form.active
		};
		if (editingId) {
			updateMutation.mutate({ id: editingId, data });
		} else {
			createMutation.mutate(data);
		}
	}

	// opciones de padre: excluir el propio almacén y sus descendientes
	const parentOptions = useMemo(() => {
		if (!editingId) return almacenes;
		const excluded = new Set<number>([editingId]);
		let changed = true;
		while (changed) {
			changed = false;
			for (const a of almacenes) {
				if (!excluded.has(a.id) && a.parentId != null && excluded.has(a.parentId)) {
					excluded.add(a.id);
					changed = true;
				}
			}
		}
		return almacenes.filter((a) => !excluded.has(a.id));
	}, [almacenes, editingId]);

	// ─── handler eliminar ─────────────────────────────────────────────────────

	function handleDeleteClick(row: AlmacenRow) {
		if (hasDescendants(row.id, almacenes)) {
			enqueueSnackbar('No se puede eliminar un almacén que tiene sub-almacenes', {
				variant: 'warning'
			});
			return;
		}
		setDeleteTarget(row);
	}

	// ─── columnas ─────────────────────────────────────────────────────────────

	const columns: GridColDef<AlmacenRow>[] = [
		{
			field: 'nombre',
			headerName: 'Almacén',
			flex: 1,
			minWidth: 220,
			renderCell: ({ row }) => (
				<Box sx={{ pl: row.depth * 3, display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
					{row.depth > 0 && (
						<Typography component="span" sx={{ color: 'text.disabled', fontSize: 14 }}>
							└{'  '}
						</Typography>
					)}
					<Typography variant="body2" fontWeight={row.depth === 0 ? 600 : 400}>
						{row.nombre}
					</Typography>
				</Box>
			)
		},
		{
			field: 'descripcion',
			headerName: 'Descripción',
			flex: 1.5,
			minWidth: 200,
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
			renderCell: ({ row }) => (
				<Stack direction="row">
					<Tooltip title="Editar">
						<IconButton size="small" onClick={() => openEdit(row)}>
							<EditIcon fontSize="small" />
						</IconButton>
					</Tooltip>
					<Tooltip title="Eliminar">
						<IconButton size="small" color="error" onClick={() => handleDeleteClick(row)}>
							<DeleteIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				</Stack>
			)
		}
	];

	const isSaving = createMutation.isPending || updateMutation.isPending;

	// ─── render ───────────────────────────────────────────────────────────────

	return (
		<Root
			header={
				<Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<Typography variant="h5" fontWeight={600}>
						Almacenes
					</Typography>
					<Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
						Nuevo almacén
					</Button>
				</Box>
			}
			content={
				<Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
					<DataGrid
						rows={rows}
						columns={columns}
						loading={isLoading}
						disableRowSelectionOnClick
						density="comfortable"
						getRowId={(r) => r.id}
						slots={{
							toolbar: () => (
								<Box sx={{ p: 1, pb: 0 }}>
									<GridToolbarQuickFilter placeholder="Buscar almacén..." />
								</Box>
							)
						}}
						initialState={{
							pagination: { paginationModel: { pageSize: 25 } }
						}}
						pageSizeOptions={[10, 25, 50]}
						sx={{ flex: 1, border: 'none' }}
					/>

					{/* Diálogo crear / editar */}
					<Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
						<DialogTitle>{editingId ? 'Editar almacén' : 'Nuevo almacén'}</DialogTitle>
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
								<TextField
									label="Descripción"
									value={form.descripcion}
									onChange={(e) => setField('descripcion', e.target.value)}
									fullWidth
									multiline
									rows={2}
								/>
								<TextField
									select
									label="Almacén superior"
									value={form.parentId}
									onChange={(e) =>
										setField('parentId', e.target.value === '' ? '' : Number(e.target.value))
									}
									error={!!errors.parentId}
									helperText={errors.parentId}
									fullWidth
								>
									<MenuItem value="">
										<em>Sin almacén superior (raíz)</em>
									</MenuItem>
									{parentOptions
										.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
										.map((a) => (
											<MenuItem key={a.id} value={a.id}>
												{a.nombre}
											</MenuItem>
										))}
								</TextField>
								<FormControlLabel
									control={
										<Switch
											checked={form.active}
											onChange={(e) => setField('active', e.target.checked)}
											color="success"
										/>
									}
									label="Activo"
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

					{/* Diálogo confirmar eliminación */}
					<Dialog
						open={!!deleteTarget}
						onClose={() => setDeleteTarget(null)}
						maxWidth="xs"
						fullWidth
					>
						<DialogTitle>Confirmar eliminación</DialogTitle>
						<DialogContent>
							<Typography>
								¿Eliminar el almacén <strong>{deleteTarget?.nombre}</strong>? Esta acción no se puede
								deshacer.
							</Typography>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
							<Button
								variant="contained"
								color="error"
								disabled={deleteMutation.isPending}
								onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
							>
								{deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
							</Button>
						</DialogActions>
					</Dialog>
				</Box>
			}
		/>
	);
}
