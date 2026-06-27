import { useState, useCallback } from 'react';
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
	MenuItem,
	Stack,
	TextField,
	Tooltip,
	IconButton,
	Typography
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import {
	Material,
	MaterialInput,
	getMateriales,
	createMaterial,
	updateMaterial
} from '../../../api/materiales';
import { AlmacenAsignado, getAlmacenesAsignados } from '../../../api/almacenes';

const Root = styled(FusePageSimple)(({ theme }) => ({
	'& .FusePageSimple-header': {
		backgroundColor: theme.vars.palette.background.paper,
		borderBottomWidth: 1,
		borderStyle: 'solid',
		borderColor: theme.vars.palette.divider
	}
}));

interface MaterialForm {
	codigo: string;
	nombre: string;
	descripcion: string;
	categoria: string;
	almacenId: number | '';
	active: boolean;
}

const FORM_EMPTY: MaterialForm = {
	codigo: '',
	nombre: '',
	descripcion: '',
	categoria: '',
	almacenId: '',
	active: true
};

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

export default function MaterialesPage() {
	const { enqueueSnackbar } = useSnackbar();
	const queryClient = useQueryClient();
	const handleApiError = useApiError();
	const [filtroAlmacenId, setFiltroAlmacenId] = useState<number | ''>('');
	const [buscar, setBuscar] = useState('');
	const [page, setPage] = useState(0);
	const [pageSize, setPageSize] = useState(25);

	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [form, setForm] = useState<MaterialForm>(FORM_EMPTY);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// ─── queries ──────────────────────────────────────────────────────────────

	const { data: almacenesAsignados = [] } = useQuery({
		queryKey: ['almacenes-asignados'],
		queryFn: getAlmacenesAsignados
	});

	const { data: materialesData, isLoading } = useQuery({
		queryKey: ['materiales', filtroAlmacenId, buscar, page, pageSize],
		queryFn: () => getMateriales({
			almacenId: filtroAlmacenId as number,
			buscar: buscar || undefined,
			soloActivos: false,
			page: page + 1,
			pageSize
		}),
		enabled: filtroAlmacenId !== ''
	});
	const materiales = materialesData?.items ?? [];
	const total = materialesData?.total ?? 0;

	const invalidate = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['materiales'] });
	}, [queryClient]);

	// ─── mutations ────────────────────────────────────────────────────────────

	const createMut = useMutation({
		mutationFn: (data: MaterialInput) => createMaterial(data),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Material creado', { variant: 'success' });
			setDialogOpen(false);
		},
		onError: handleApiError
	});

	const updateMut = useMutation({
		mutationFn: ({ id, data }: { id: number; data: MaterialInput }) => updateMaterial(id, data),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Material actualizado', { variant: 'success' });
			setDialogOpen(false);
		},
		onError: handleApiError
	});

	// ─── handlers ─────────────────────────────────────────────────────────────

	function openCreate() {
		setEditingId(null);
		setForm({
			...FORM_EMPTY,
			almacenId: filtroAlmacenId !== '' ? (filtroAlmacenId as number) : ''
		});
		setErrors({});
		setDialogOpen(true);
	}

	function openEdit(row: Material) {
		setEditingId(row.id);
		setForm({
			codigo: row.codigo,
			nombre: row.nombre,
			descripcion: row.descripcion ?? '',
			categoria: row.categoria ?? '',
			almacenId: row.almacenId || '',
			active: row.active
		});
		setErrors({});
		setDialogOpen(true);
	}

	function submit() {
		const next: Record<string, string> = {};
		if (!form.codigo.trim()) next.codigo = 'Requerido';
		if (!form.nombre.trim()) next.nombre = 'Requerido';
		if (form.almacenId === '') next.almacenId = 'Requerido';
		setErrors(next);
		if (Object.keys(next).length > 0) return;

		const data: MaterialInput = {
			codigo: form.codigo.trim(),
			nombre: form.nombre.trim(),
			descripcion: form.descripcion.trim() || undefined,
			categoria: form.categoria.trim() || undefined,
			almacenId: form.almacenId as number,
			active: form.active
		};

		if (editingId) updateMut.mutate({ id: editingId, data });
		else createMut.mutate(data);
	}

	const isSaving = createMut.isPending || updateMut.isPending;

	// ─── columns ──────────────────────────────────────────────────────────────

	const columns: GridColDef<Material>[] = [
		{ field: 'codigo', headerName: 'Código', width: 120, display: 'flex' },
		{ field: 'nombre', headerName: 'Nombre', flex: 1, minWidth: 200, display: 'flex' },
		{ field: 'categoria', headerName: 'Categoría', width: 150, display: 'flex' },
		{ field: 'almacenNombre', headerName: 'Almacén', width: 160, display: 'flex' },
		{
			field: 'active', headerName: 'Estado', width: 100, display: 'flex',
			renderCell: ({ value }) => (
				<Chip
					label={value ? 'Activo' : 'Inactivo'}
					color={value ? 'success' : 'default'}
					size="small" variant="outlined"
					sx={{ height: 22, fontSize: 11 }}
				/>
			)
		},
		{
			field: 'actions', headerName: '', width: 60, sortable: false, filterable: false, display: 'flex',
			renderCell: ({ row }) => (
				<Tooltip title="Editar">
					<IconButton size="small" onClick={() => openEdit(row)}>
						<EditIcon sx={{ fontSize: 16 }} />
					</IconButton>
				</Tooltip>
			)
		}
	];

	// ─── render ───────────────────────────────────────────────────────────────

	return (
		<Root
			header={
				<Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<Typography variant="h5" fontWeight={600}>Materiales</Typography>
					<Button
						variant="contained" startIcon={<AddIcon />}
						onClick={openCreate}
						disabled={filtroAlmacenId === ''}
					>
						Nuevo material
					</Button>
				</Box>
			}
			content={
				<Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
					<Stack direction="row" spacing={2}>
						<TextField
							select label="Almacén" value={filtroAlmacenId}
							onChange={(e) => { setFiltroAlmacenId(e.target.value === '' ? '' : Number(e.target.value)); setPage(0); setBuscar(''); }}
							size="small" sx={{ width: 280 }}
						>
							<MenuItem value=""><em>Seleccione un almacén</em></MenuItem>
							{almacenesAsignados.map((a: AlmacenAsignado) => (
								<MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>
							))}
						</TextField>
						<TextField
							label="Buscar" placeholder="Código o nombre..."
							value={buscar}
							onChange={(e) => { setBuscar(e.target.value); setPage(0); }}
							size="small" sx={{ width: 300 }}
							disabled={filtroAlmacenId === ''}
						/>
					</Stack>

					<Box sx={{ flex: 1, minHeight: 0 }}>
						{filtroAlmacenId === '' ? (
							<Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
								<Typography variant="body1" color="text.secondary">
									Seleccione un almacén para ver los materiales
								</Typography>
							</Box>
						) : (
							<DataGrid
								rows={materiales}
								columns={columns}
								loading={isLoading}
								rowCount={total}
								paginationMode="server"
								paginationModel={{ page, pageSize }}
								onPaginationModelChange={(m) => { setPage(m.page); setPageSize(m.pageSize); }}
								pageSizeOptions={[25, 50, 100]}
								disableRowSelectionOnClick
								density="compact"
								sx={{ height: '100%' }}
							/>
						)}
					</Box>

					{/* ── Diálogo crear/editar ── */}
					<Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
						<DialogTitle>{editingId ? 'Editar material' : 'Nuevo material'}</DialogTitle>
						<DialogContent dividers>
							<Stack spacing={2.5} sx={{ pt: 0.5 }}>
								<TextField
									label="Código *" value={form.codigo}
									onChange={(e) => { setForm((p) => ({ ...p, codigo: e.target.value })); if (errors.codigo) setErrors((p) => ({ ...p, codigo: '' })); }}
									error={!!errors.codigo} helperText={errors.codigo}
									fullWidth autoFocus
								/>
								<TextField
									label="Nombre *" value={form.nombre} fullWidth
									onChange={(e) => { setForm((p) => ({ ...p, nombre: e.target.value })); if (errors.nombre) setErrors((p) => ({ ...p, nombre: '' })); }}
									error={!!errors.nombre} helperText={errors.nombre}
								/>
								<TextField
									label="Descripción" value={form.descripcion} fullWidth multiline rows={2}
									onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
								/>
								<Stack direction="row" spacing={2}>
									<TextField
										label="Categoría" value={form.categoria}
										onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
										sx={{ flex: 1 }}
									/>
									<TextField
										select label="Almacén *" value={form.almacenId}
										onChange={(e) => { setForm((p) => ({ ...p, almacenId: e.target.value === '' ? '' : Number(e.target.value) })); if (errors.almacenId) setErrors((p) => ({ ...p, almacenId: '' })); }}
										error={!!errors.almacenId} helperText={errors.almacenId}
										sx={{ flex: 1 }}
									>
										<MenuItem value=""><em>Seleccione</em></MenuItem>
										{almacenesAsignados.map((a: AlmacenAsignado) => (
											<MenuItem key={a.id} value={a.id}>{a.nombre}</MenuItem>
										))}
									</TextField>
								</Stack>
								{editingId && (
									<TextField
										select label="Estado" value={form.active ? 'true' : 'false'}
										onChange={(e) => setForm((p) => ({ ...p, active: e.target.value === 'true' }))}
										fullWidth
									>
										<MenuItem value="true">Activo</MenuItem>
										<MenuItem value="false">Inactivo</MenuItem>
									</TextField>
								)}
							</Stack>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setDialogOpen(false)} disabled={isSaving}>Cancelar</Button>
							<Button variant="contained" onClick={submit} disabled={isSaving}>
								{isSaving ? 'Guardando...' : 'Guardar'}
							</Button>
						</DialogActions>
					</Dialog>
				</Box>
			}
		/>
	);
}
