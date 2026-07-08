import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { motion } from 'motion/react';
import FusePageSimple from '@fuse/core/FusePageSimple';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
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
	Skeleton,
	Stack,
	TextField,
	Tooltip,
	Typography
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
	SolicitudDetail,
	SolicitudListItem,
	SolicitudItem,
	getSolicitudes,
	getSolicitud,
	createSolicitud,
	updateSolicitud,
	deleteSolicitud,
	enviarSolicitud,
	aprobarSolicitud,
	rechazarSolicitud,
	despacharSolicitud,
	entregarSolicitud,
	cancelarSolicitud,
	addSolicitudItem,
	updateSolicitudItem,
	deleteSolicitudItem,
	SolicitudCreateInput,
	SolicitudItemUpsertInput,
	DespachoItemInput,
	EntregaItemInput
} from '../../../api/solicitudes';
import { getAlmacenesAsignados } from '../../../api/almacenes';
import { getMyPerfil } from '../../../api/perfil';
import { getMateriales } from '../../../api/materiales';
import useUser from '@auth/useUser';
import AprobarDialog from './dialogs/AprobarDialog';
import CancelarDialog from './dialogs/CancelarDialog';
import DespacharDialog from './dialogs/DespacharDialog';
import EntregarDialog from './dialogs/EntregarDialog';
import RechazarDialog from './dialogs/RechazarDialog';

const estadoColor: Record<string, 'default' | 'success' | 'error' | 'warning' | 'info'> = {
	borrador: 'default',
	enviado: 'warning',
	aprobado: 'info',
	rechazado: 'error',
	despachado: 'info',
	entregado: 'success'
};

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
			try {
				const body = await response.json();
				msg = body?.error ?? msg;
			} catch {
				/* */
			}
		} else if (err instanceof Error) {
			msg = err.message;
		}

		enqueueSnackbar(msg, { variant: 'error' });
	};
}

function getRole(role: string | string[] | null | undefined): string {
	if (!role) return '';

	if (Array.isArray(role)) return role[0] ?? '';

	return role;
}

// ─── tipos ───────────────────────────────────────────────────────────────────

interface ItemFormState {
	materialId: number | '';
	cantidad: string;
}

const ITEM_FORM_EMPTY: ItemFormState = {
	materialId: '', cantidad: ''
};

export default function SolicitudesPage() {
	const { enqueueSnackbar } = useSnackbar();
	const queryClient = useQueryClient();
	const handleApiError = useApiError();
	const userData = useUser();
	const role = getRole(userData.data?.role);
	const userId = userData.data?.id ?? '';
	const isAdmin = role === 'admin';
	const isSolicitante = role === 'solicitante';
	const isAprobador = role === 'aprobador';
	const isAlmacenero = role === 'almacenero';

	const [filtroEstado, setFiltroEstado] = useState('');
	const [selectedId, setSelectedId] = useState<number | null>(null);

	// dialog states
	const [createOpen, setCreateOpen] = useState(false);
	const [editingSolId, setEditingSolId] = useState<number | null>(null);
	const [observacion, setObservacion] = useState('');
	const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

	const [deleteSolTarget, setDeleteSolTarget] = useState<SolicitudListItem | null>(null);
	const [enviarTarget, setEnviarTarget] = useState<SolicitudListItem | null>(null);

	const [aprobarId, setAprobarId] = useState<number | null>(null);
	const [rechazarId, setRechazarId] = useState<number | null>(null);
	const [despachoOpen, setDespachoOpen] = useState(false);
	const [entregaOpen, setEntregaOpen] = useState(false);
	const [cancelarId, setCancelarId] = useState<number | null>(null);

	// item dialog
	const [materialSearch, setMaterialSearch] = useState('');
	const [itemDialogOpen, setItemDialogOpen] = useState(false);
	const [editingItemId, setEditingItemId] = useState<number | null>(null);
	const [itemForm, setItemForm] = useState<ItemFormState>(ITEM_FORM_EMPTY);
	const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
	const [deleteItemTarget, setDeleteItemTarget] = useState<SolicitudItem | null>(null);

	// queries
	const { data: almacenesAsignados = [] } = useQuery({
		queryKey: ['almacenes-asignados'],
		queryFn: getAlmacenesAsignados
	});

	const { data: perfilData } = useQuery({
		queryKey: ['perfil'],
		queryFn: getMyPerfil
	});
	const perfilItems = perfilData?.items ?? [];
	const perfilItem = perfilItems.length > 0 ? perfilItems[0] : null;

	const { data: solicitudesData, isLoading: loadingList } = useQuery({
		queryKey: ['solicitudes', filtroEstado],
		queryFn: () =>
			getSolicitudes({
				estado: filtroEstado || undefined,
				pageSize: 100
			})
	});
	const solicitudes = solicitudesData?.items ?? [];

	const { data: detailData, isLoading: loadingDetail } = useQuery({
		queryKey: ['solicitud-detail', selectedId],
		queryFn: () => getSolicitud(selectedId!),
		enabled: selectedId !== null
	});
	const selectedSol = detailData?.solicitud ?? null;
	const solItems = detailData?.items ?? [];

	const searchReady = materialSearch.trim().length >= 4;
	const { data: materialesData } = useQuery({
		queryKey: ['materiales-sol', materialSearch.trim()],
		queryFn: () => getMateriales({ buscar: materialSearch.trim(), soloActivos: true, pageSize: 1000 }),
		enabled: searchReady
	});
	const materiales = materialesData?.items ?? [];

	// invalidations
	const invalidate = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
		queryClient.invalidateQueries({ queryKey: ['solicitud-detail'] });
	}, [queryClient]);

	// mutations
	const createMut = useMutation({
		mutationFn: (data: SolicitudCreateInput) => createSolicitud(data),
		onSuccess: (res) => {
			invalidate();
			enqueueSnackbar(`Solicitud ${res.numero} creada`, { variant: 'success' });
			setCreateOpen(false);
			setObservacion('');
			setSelectedId(res.id);
		},
		onError: handleApiError
	});

	const updateSolMut = useMutation({
		mutationFn: ({ id, observacion: obs }: { id: number; observacion?: string }) =>
			updateSolicitud(id, { observacion: obs }),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Solicitud actualizada', { variant: 'success' });
			setCreateOpen(false);
			setEditingSolId(null);
			setObservacion('');
		},
		onError: handleApiError
	});

	const enviarMut = useMutation({
		mutationFn: (id: number) => enviarSolicitud(id),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Solicitud enviada', { variant: 'success' });
			setEnviarTarget(null);
		},
		onError: handleApiError
	});

	const deleteSolMut = useMutation({
		mutationFn: (id: number) => deleteSolicitud(id),
		onSuccess: (_, deletedId) => {
			invalidate();
			if (selectedId === deletedId) setSelectedId(null);
			enqueueSnackbar('Solicitud eliminada', { variant: 'success' });
			setDeleteSolTarget(null);
		},
		onError: handleApiError
	});

	const aprobarMut = useMutation({
		mutationFn: (id: number) => aprobarSolicitud(id),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Solicitud aprobada', { variant: 'success' });
			setAprobarId(null);
		},
		onError: handleApiError
	});

	const rechazarMut = useMutation({
		mutationFn: ({ id, obs }: { id: number; obs?: string }) => rechazarSolicitud(id, obs || undefined),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Solicitud rechazada', { variant: 'success' });
			setRechazarId(null);
			setSelectedId(null);
		},
		onError: handleApiError
	});

	const despacharMut = useMutation({
		mutationFn: ({ id, fecha, items }: { id: number; fecha: string; items: DespachoItemInput[] }) =>
			despacharSolicitud(id, fecha, items),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Solicitud despachada', { variant: 'success' });
			setDespachoOpen(false);
		},
		onError: handleApiError
	});

	const entregarMut = useMutation({
		mutationFn: ({ id, fecha, items }: { id: number; fecha: string; items: EntregaItemInput[] }) =>
			entregarSolicitud(id, fecha, items),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Entrega registrada', { variant: 'success' });
			setEntregaOpen(false);
		},
		onError: handleApiError
	});

	const cancelarMut = useMutation({
		mutationFn: (id: number) => cancelarSolicitud(id),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Solicitud cancelada', { variant: 'success' });
			setCancelarId(null);
			setSelectedId(null);
		},
		onError: handleApiError
	});

	// item mutations
	const addItemMut = useMutation({
		mutationFn: (data: SolicitudItemUpsertInput) => addSolicitudItem(selectedId!, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['solicitud-detail', selectedId] });
			enqueueSnackbar('Ítem agregado', { variant: 'success' });
			setItemDialogOpen(false);
		},
		onError: handleApiError
	});

	const updateItemMut = useMutation({
		mutationFn: ({ itemId, data }: { itemId: number; data: SolicitudItemUpsertInput }) =>
			updateSolicitudItem(selectedId!, itemId, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['solicitud-detail', selectedId] });
			enqueueSnackbar('Ítem actualizado', { variant: 'success' });
			setItemDialogOpen(false);
		},
		onError: handleApiError
	});

	const deleteItemMut = useMutation({
		mutationFn: (itemId: number) => deleteSolicitudItem(selectedId!, itemId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['solicitud-detail', selectedId] });
			enqueueSnackbar('Ítem eliminado', { variant: 'success' });
			setDeleteItemTarget(null);
		},
		onError: handleApiError
	});

	// ─── handlers ─────────────────────────────────────────────────────────────

	function openCreate() {
		setEditingSolId(null);
		setObservacion('');
		setCreateErrors({});
		setCreateOpen(true);
	}

	function openEditSol(s: SolicitudListItem) {
		setEditingSolId(s.id);
		setObservacion(s.observacion ?? '');
		setCreateErrors({});
		setCreateOpen(true);
	}

	function submitCreate() {
		if (editingSolId) {
			updateSolMut.mutate({ id: editingSolId, observacion: observacion.trim() || undefined });
			return;
		}

		const next: Record<string, string> = {};
		if (!perfilItem && !almacenesAsignados.length) next.subAlmacen = 'No tiene sub-almacenes asignados';
		setCreateErrors(next);
		if (Object.keys(next).length > 0) return;

		const effectiveSub = perfilItem?.subAlmacenId;
		if (!effectiveSub) {
			enqueueSnackbar('Configure su perfil o seleccione un sub-almacén', { variant: 'error' });
			return;
		}

		createMut.mutate({
			subAlmacenId: effectiveSub,
			observacion: observacion.trim() || undefined
		});
	}

	// item handlers
	function openCreateItem() {
		setEditingItemId(null);
		setItemForm(ITEM_FORM_EMPTY);
		setItemErrors({});
		setMaterialSearch('');
		setItemDialogOpen(true);
	}

	function openEditItem(item: SolicitudItem) {
		setEditingItemId(item.id);
		setItemForm({
			materialId: item.materialId,
			cantidad: String(item.cantidadSolicitada)
		});
		setItemErrors({});
		setMaterialSearch(item.materialNombre);
		setItemDialogOpen(true);
	}

	function submitItem() {
		const next: Record<string, string> = {};
		if (itemForm.materialId === '') next.materialId = 'Requerido';
		if (!itemForm.cantidad || Number(itemForm.cantidad) <= 0) next.cantidad = 'Debe ser mayor a 0';
		setItemErrors(next);
		if (Object.keys(next).length > 0) return;

		const data: SolicitudItemUpsertInput = {
			materialId: itemForm.materialId as number,
			cantidad: Number(itemForm.cantidad)
		};

		if (editingItemId) updateItemMut.mutate({ itemId: editingItemId, data });
		else addItemMut.mutate(data);
	}

	function onMaterialChange(materialId: number | '') {
		setItemForm((p) => ({ ...p, materialId }));
		if (itemErrors.materialId) setItemErrors((p) => ({ ...p, materialId: '' }));
	}

	// helpers
	function isOwnSol(sol: { solicitanteId: number }) {
		return sol.solicitanteId === Number(userId);
	}

	function canCreate() {
		return perfilItem !== null;
	}

	function canAprobarRechazar(sol: SolicitudDetail | null) {
		return sol && (isAdmin || isAprobador) && sol.estado === 'enviado';
	}

	function canDespachar(sol: SolicitudDetail | null) {
		return sol && (isAdmin || isAlmacenero) && sol.estado === 'aprobado';
	}

	function canEntregar(sol: SolicitudDetail | null) {
		return sol && (isAdmin || isAlmacenero) && sol.estado === 'despachado';
	}

	function canCancelar(sol: SolicitudDetail | null) {
		return sol && (isAdmin || (isSolicitante && isOwnSol(sol))) && sol.estado === 'enviado';
	}

	const isSavingCreate = createMut.isPending || updateSolMut.isPending;
	const isSavingItem = addItemMut.isPending || updateItemMut.isPending;

	// columnas items
	const itemColumns: GridColDef<SolicitudItem>[] = [
		{ field: 'codigo', headerName: 'Código', width: 100, display: 'flex' },
		{ field: 'materialNombre', headerName: 'Material', flex: 1, minWidth: 180, display: 'flex' },
		{ field: 'unidadMedida', headerName: 'Unidad', width: 80, display: 'flex' },
		{
			field: 'cantidadSolicitada',
			headerName: 'Solicitado',
			width: 110,
			type: 'number',
			display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2">{Number(value).toLocaleString('es-BO')}</Typography>
		},
		{
			field: 'cantidadDespachada',
			headerName: 'Despachado',
			width: 110,
			type: 'number',
			display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2">{Number(value).toLocaleString('es-BO')}</Typography>
		},
		{
			field: 'cantidadEntregada',
			headerName: 'Entregado',
			width: 110,
			type: 'number',
			display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2">{Number(value).toLocaleString('es-BO')}</Typography>
		},
		{
			field: 'actions',
			headerName: '',
			width: 80,
			sortable: false,
			filterable: false,
			display: 'flex',
			renderCell: ({ row }) =>
				selectedSol?.estado === 'borrador' && (isAdmin || isOwnSol(selectedSol)) ? (
					<Stack direction="row">
						<Tooltip title="Editar">
							<IconButton size="small" onClick={() => openEditItem(row)}>
								<FuseSvgIcon size={16}>lucide:pencil</FuseSvgIcon>
							</IconButton>
						</Tooltip>
						<Tooltip title="Eliminar">
							<IconButton size="small" color="error" onClick={() => setDeleteItemTarget(row)}>
								<FuseSvgIcon size={16}>lucide:trash-2</FuseSvgIcon>
							</IconButton>
						</Tooltip>
					</Stack>
				) : null
		}
	];

	return (
		<>
			<Root
				header={
					<div className="w-full px-4 py-4 md:px-6">
						<PageBreadcrumb className="mb-2" />
						<div className="flex items-center gap-1 sm:flex-row md:items-start">
							<div className="flex flex-auto flex-col gap-1">
								<motion.span
									initial={{ x: -20 }}
									animate={{ x: 0, transition: { delay: 0.2 } }}
								>
									<Typography className="text-4xl leading-none font-extrabold tracking-tight">
										Solicitudes
									</Typography>
								</motion.span>
								<motion.span
									initial={{ y: -20, opacity: 0 }}
									animate={{ y: 0, opacity: 1, transition: { delay: 0.2 } }}
								>
									<Typography
										color="text.secondary"
										className="ml-0.5 text-base font-medium"
									>
										{loadingList ? 'Cargando...' : `${solicitudes.length} solicitudes`}
									</Typography>
								</motion.span>
							</div>
						</div>
					</div>
				}
				content={
					<Box
						sx={{
							p: 3,
							height: '100%',
							display: 'flex',
							flexDirection: 'column',
							gap: 2
						}}
					>
						{/* Filtros */}
						<Stack
							direction="row"
							spacing={2}
							alignItems="center"
						>
							{perfilItem ? (
								<div className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-base font-medium text-emerald-700">
									<span>
										{perfilItem.sigla ? `${perfilItem.sigla} — ` : ''}
										{perfilItem.subAlmacenNombre}
									</span>
									<span className="font-normal opacity-70">({perfilItem.almacenNombre})</span>
								</div>
							) : (
								<div className="inline-flex items-center rounded bg-red-50 px-2 py-1 text-base font-medium text-red-700">
									Perfil incompleto — configure su sub-almacén en la página de Perfil
								</div>
							)}
							<TextField
								select
								label="Estado"
								value={filtroEstado}
								onChange={(e) => setFiltroEstado(e.target.value)}
								size="small"
								sx={{ width: 160 }}
							>
								<MenuItem value="">
									<em>Todos</em>
								</MenuItem>
								<MenuItem value="borrador">Borrador</MenuItem>
								<MenuItem value="enviado">Enviado</MenuItem>
								<MenuItem value="aprobado">Aprobado</MenuItem>
								<MenuItem value="rechazado">Rechazado</MenuItem>
								<MenuItem value="despachado">Despachado</MenuItem>
								<MenuItem value="entregado">Entregado</MenuItem>
							</TextField>
						</Stack>

						<Box sx={{ flex: 1, display: 'flex', gap: 3, minHeight: 0 }}>
							{/* Panel izquierdo: lista */}
							<Paper
								variant="outlined"
								sx={{
									flex: '0 0 40%',
									minWidth: 280,
									display: 'flex',
									flexDirection: 'column',
									overflow: 'hidden'
								}}
							>
								<Box
									sx={{
										p: 2,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between'
									}}
								>
									<Typography
										variant="subtitle1"
										fontWeight={600}
									>
										Solicitudes
									</Typography>
									<Stack
										direction="row"
										spacing={1}
										alignItems="center"
									>
										<Tooltip
											title={
												!canCreate()
													? 'Configure su perfil en la página de Perfil'
													: ''
											}
										>
											<span>
												<Button
													variant="contained"
													size="small"
													startIcon={
														<FuseSvgIcon>lucide:plus</FuseSvgIcon>
													}
													onClick={openCreate}
													disabled={!canCreate()}
												>
													Nueva Solicitud
												</Button>
											</span>
										</Tooltip>
									</Stack>
								</Box>
								<Divider />
								<List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
									{loadingList &&
										Array.from({ length: 6 }).map((_, i) => (
											<Box
												key={i}
												sx={{ px: 2, py: 1.5 }}
											>
												<Skeleton
													variant="text"
													width="70%"
													height={20}
												/>
												<Skeleton
													variant="text"
													width="45%"
													height={16}
												/>
											</Box>
										))}
									{!loadingList && solicitudes.length === 0 && (
										<Box sx={{ p: 4, textAlign: 'center' }}>
											<FuseSvgIcon
												size={48}
												className="mb-2"
												color="disabled"
											>
												lucide:file-text
											</FuseSvgIcon>
											<Typography
												variant="body2"
												color="text.secondary"
											>
												Sin solicitudes
											</Typography>
										</Box>
									)}
									{solicitudes.map((s) => (
									<ListItemButton
										key={s.id}
										selected={selectedId === s.id}
										onClick={() => setSelectedId(s.id)}
										sx={{ gap: 1 }}
									>
										<ListItemText
											primary={
												<Stack
													direction="row"
													spacing={1}
													alignItems="center"
												>
													<Typography
														variant="body2"
														fontWeight={600}
													>
														{s.numero}
													</Typography>
													<Chip
														label={s.estado}
														color={estadoColor[s.estado] ?? 'default'}
														size="small"
														variant="outlined"
														sx={{
															textTransform: 'capitalize',
															height: 20,
															fontSize: 11
														}}
													/>
												</Stack>
											}
											secondary={
												<>
													{s.sigla ? `${s.sigla} — ` : ''}
													{s.subAlmacenNombre} — {s.solicitante} —{' '}
													{new Date(s.fechaSolicitud).toLocaleDateString('es-BO')}
												</>
											}
											slotProps={{ secondary: { noWrap: true } }}
										/>
										{s.estado === 'borrador' && (isAdmin || isOwnSol(s)) && (
											<Stack
												direction="row"
												sx={{ flexShrink: 0 }}
											>
												<Tooltip title="Editar">
													<IconButton
														size="small"
														onClick={(e) => {
															e.stopPropagation();
															openEditSol(s);
														}}
													>
														<FuseSvgIcon size={16}>lucide:pencil</FuseSvgIcon>
													</IconButton>
												</Tooltip>
												<Tooltip title="Enviar">
													<IconButton
														size="small"
														color="primary"
														onClick={(e) => {
															e.stopPropagation();
															setEnviarTarget(s);
														}}
													>
														<FuseSvgIcon size={16}>lucide:send</FuseSvgIcon>
													</IconButton>
												</Tooltip>
												<Tooltip title="Eliminar">
													<IconButton
														size="small"
														color="error"
														onClick={(e) => {
															e.stopPropagation();
															setDeleteSolTarget(s);
														}}
													>
														<FuseSvgIcon size={16}>lucide:trash-2</FuseSvgIcon>
													</IconButton>
												</Tooltip>
											</Stack>
										)}
									</ListItemButton>
									))}
								</List>
							</Paper>

							{/* Panel derecho: detalle */}
							<Paper
								variant="outlined"
								sx={{
									flex: 1,
									display: 'flex',
									flexDirection: 'column',
									overflow: 'hidden'
								}}
							>
								{!selectedSol ? (
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
										<FuseSvgIcon
											size={48}
											className="opacity-30"
										>
											lucide:file-text
										</FuseSvgIcon>
										<Typography variant="body1">
											Seleccione una solicitud para ver su detalle
										</Typography>
									</Box>
								) : (
									<>
										<Box
											sx={{
												p: 2,
												display: 'flex',
												alignItems: 'flex-start',
												justifyContent: 'space-between'
											}}
										>
											<Box>
												<Stack
													direction="row"
													spacing={1}
													alignItems="center"
													sx={{ mb: 0.5 }}
												>
													<Typography
														variant="subtitle1"
														fontWeight={600}
													>
														{selectedSol.numero}
													</Typography>
													<Chip
														label={selectedSol.estado}
														color={estadoColor[selectedSol.estado] ?? 'default'}
														size="small"
														variant="outlined"
														sx={{ textTransform: 'capitalize' }}
													/>
												</Stack>
												<Typography
													variant="body2"
													color="text.secondary"
												>
													{selectedSol.sigla ? `${selectedSol.sigla} — ` : ''}
													{selectedSol.subAlmacenNombre} ({selectedSol.almacenNombre}) —
													Solicitante: {selectedSol.solicitante}
												</Typography>
												<Stack
													direction="row"
													spacing={2}
													sx={{ mt: 0.5, flexWrap: 'wrap' }}
												>
													<Typography
														variant="caption"
														color="text.secondary"
													>
														Creado:{' '}
														{new Date(selectedSol.fechaSolicitud).toLocaleDateString(
															'es-BO'
														)}
													</Typography>
													{selectedSol.fechaAprobacion && (
														<Typography
															variant="caption"
															color="text.secondary"
														>
															{selectedSol.estado === 'rechazado'
																? 'Rechazado'
																: 'Aprobado'}
															:{' '}
															{new Date(selectedSol.fechaAprobacion).toLocaleDateString(
																'es-BO'
															)}
															{selectedSol.aprobador ? ` (${selectedSol.aprobador})` : ''}
														</Typography>
													)}
													{selectedSol.fechaDespacho && (
														<Typography
															variant="caption"
															color="text.secondary"
														>
															Despachado:{' '}
															{new Date(selectedSol.fechaDespacho).toLocaleDateString(
																'es-BO'
															)}
															{selectedSol.almacenero
																? ` (${selectedSol.almacenero})`
																: ''}
														</Typography>
													)}
													{selectedSol.fechaEntrega && (
														<Typography
															variant="caption"
															color="text.secondary"
														>
															Entregado:{' '}
															{new Date(selectedSol.fechaEntrega).toLocaleDateString(
																'es-BO'
															)}
														</Typography>
													)}
												</Stack>
												{selectedSol.observacion && (
													<Typography
														variant="caption"
														color="text.secondary"
														sx={{
															display: 'block',
															mt: 0.5,
															fontStyle: 'italic'
														}}
													>
														Motivo: {selectedSol.observacion}
													</Typography>
												)}
											</Box>
											<Stack
												direction="row"
												spacing={1}
												sx={{ flexShrink: 0, ml: 2 }}
											>
												{canAprobarRechazar(selectedSol) && (
													<>
														<Tooltip title="Aprobar">
															<Button
																variant="outlined"
																color="success"
																size="small"
																startIcon={
																	<FuseSvgIcon>lucide:circle-check</FuseSvgIcon>
																}
																onClick={() => setAprobarId(selectedSol.id)}
															>
																Aprobar
															</Button>
														</Tooltip>
														<Tooltip title="Rechazar">
															<Button
																variant="outlined"
																color="error"
																size="small"
																startIcon={<FuseSvgIcon>lucide:circle-x</FuseSvgIcon>}
																onClick={() => setRechazarId(selectedSol.id)}
															>
																Rechazar
															</Button>
														</Tooltip>
													</>
												)}
												{canDespachar(selectedSol) && (
													<Tooltip title="Despachar">
														<Button
															variant="outlined"
															color="primary"
															size="small"
															startIcon={<FuseSvgIcon>lucide:truck</FuseSvgIcon>}
															onClick={() => setDespachoOpen(true)}
														>
															Despachar
														</Button>
													</Tooltip>
												)}
												{canEntregar(selectedSol) && (
													<Tooltip title="Registrar entrega">
														<Button
															variant="outlined"
															color="primary"
															size="small"
															startIcon={<FuseSvgIcon>lucide:package-check</FuseSvgIcon>}
															onClick={() => setEntregaOpen(true)}
														>
															Entregar
														</Button>
													</Tooltip>
												)}
												{canCancelar(selectedSol) && (
													<Tooltip title="Cancelar">
														<Button
															variant="outlined"
															color="error"
															size="small"
															startIcon={<FuseSvgIcon>lucide:ban</FuseSvgIcon>}
															onClick={() => setCancelarId(selectedSol.id)}
														>
															Cancelar
														</Button>
													</Tooltip>
												)}
											</Stack>
										</Box>
										<Divider />
										<Box
											sx={{
												p: 2,
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'space-between'
											}}
										>
											<Typography
												variant="subtitle2"
												fontWeight={600}
											>
												Materiales solicitados
											</Typography>
											{selectedSol.estado === 'borrador' && (isAdmin || isOwnSol(selectedSol)) && (
												<Button
													variant="contained"
													size="small"
													startIcon={<FuseSvgIcon>lucide:plus</FuseSvgIcon>}
													onClick={openCreateItem}
												>
													Agregar ítem
												</Button>
											)}
										</Box>
										<Divider />
										<Box sx={{ flex: 1, p: 2 }}>
											<DataGrid
												rows={solItems}
												columns={itemColumns}
												loading={loadingDetail}
												disableRowSelectionOnClick
												density="compact"
												getRowId={(r) => r.id}
												pageSizeOptions={[25, 50]}
												sx={{ border: 'none', height: '100%' }}
											/>
										</Box>
									</>
								)}
							</Paper>
						</Box>
					</Box>
				}
			/>

			{/* ── Diálogo crear/editar solicitud ── */}
			<Dialog
				open={createOpen}
				onClose={() => {
					setCreateOpen(false);
					setEditingSolId(null);
				}}
				fullWidth
				maxWidth="sm"
			>
				<DialogTitle>{editingSolId ? 'Editar Solicitud' : 'Nueva Solicitud'}</DialogTitle>
				<DialogContent dividers>
					<Stack
						spacing={2.5}
						sx={{ pt: 0.5 }}
					>
						{!editingSolId &&
							(perfilItem ? (
								<Paper
									variant="outlined"
									sx={{ p: 2, bgcolor: 'action.hover' }}
								>
									<Stack spacing={0.5}>
										<Typography
											variant="caption"
											color="text.secondary"
										>
											Sub-almacén (según su perfil)
										</Typography>
										<Typography
											variant="body1"
											fontWeight={600}
										>
											{perfilItem.sigla
												? `${perfilItem.sigla} — ${perfilItem.subAlmacenNombre}`
												: perfilItem.subAlmacenNombre}
										</Typography>
										<Typography
											variant="body2"
											color="text.secondary"
										>
											{perfilItem.almacenNombre}
										</Typography>
									</Stack>
								</Paper>
							) : (
								<TextField
									select
									label="Sub-almacén *"
									fullWidth
									disabled
									helperText="Configure su perfil para asignar un sub-almacén"
								>
									<MenuItem value="">
										<em>Sin sub-almacén asignado</em>
									</MenuItem>
								</TextField>
							))}
						<TextField
							label="Motivo / Observación"
							value={observacion}
							onChange={(e) => setObservacion(e.target.value)}
							fullWidth
							multiline
							rows={3}
							autoFocus
							placeholder="Describa el motivo de la solicitud..."
						/>
					</Stack>
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 2 }}>
					<Button
						onClick={() => {
							setCreateOpen(false);
							setEditingSolId(null);
						}}
						disabled={isSavingCreate}
					>
						Cancelar
					</Button>
					<Button
						variant="contained"
						onClick={submitCreate}
						disabled={isSavingCreate || (!editingSolId && !canCreate())}
					>
						{isSavingCreate
							? 'Guardando...'
							: editingSolId
								? 'Guardar'
								: 'Crear'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* ── Diálogo crear/editar ítem ── */}
			<Dialog
				open={itemDialogOpen}
				onClose={() => setItemDialogOpen(false)}
				fullWidth
				maxWidth="sm"
			>
				<DialogTitle>{editingItemId ? 'Editar ítem' : 'Agregar ítem'}</DialogTitle>
				<DialogContent dividers>
					<Stack
						spacing={2.5}
						sx={{ pt: 0.5 }}
					>
						<TextField
							select
							label="Material *"
							value={itemForm.materialId}
							onChange={(e) => onMaterialChange(e.target.value === '' ? '' : Number(e.target.value))}
							error={!!itemErrors.materialId}
							helperText={itemErrors.materialId}
							fullWidth
							slotProps={{
								select: { MenuProps: { PaperProps: { sx: { maxHeight: 450 } } } }
							}}
						>
							<ListSubheader sx={{ p: 1 }}>
								<TextField
									size="small"
									placeholder="Escriba al menos 4 letras..."
									fullWidth
									autoFocus
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
								<MenuItem
									key={m.id}
									value={m.id}
								>
									{m.codigo} — {m.nombre}
								</MenuItem>
							))}
						</TextField>
						<TextField
							label="Cantidad *"
							type="number"
							value={itemForm.cantidad}
							onChange={(e) => {
								setItemForm((p) => ({ ...p, cantidad: e.target.value }));
								if (itemErrors.cantidad) setItemErrors((p) => ({ ...p, cantidad: '' }));
							}}
							error={!!itemErrors.cantidad}
							helperText={itemErrors.cantidad}
							fullWidth
						/>
					</Stack>
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 2 }}>
					<Button
						onClick={() => setItemDialogOpen(false)}
						disabled={isSavingItem}
					>
						Cancelar
					</Button>
					<Button
						variant="contained"
						onClick={submitItem}
						disabled={isSavingItem}
					>
						{isSavingItem ? 'Guardando...' : 'Guardar'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* ── Diálogo eliminar ítem ── */}
			<Dialog
				open={!!deleteItemTarget}
				onClose={() => setDeleteItemTarget(null)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Eliminar ítem</DialogTitle>
				<DialogContent>
					<Typography>
						¿Eliminar <strong>{deleteItemTarget?.materialNombre}</strong> de esta solicitud?
					</Typography>
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 2 }}>
					<Button onClick={() => setDeleteItemTarget(null)}>Cancelar</Button>
					<Button
						variant="contained"
						color="error"
						disabled={deleteItemMut.isPending}
						onClick={() => deleteItemTarget && deleteItemMut.mutate(deleteItemTarget.id)}
					>
						{deleteItemMut.isPending ? 'Eliminando...' : 'Eliminar'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* ── Diálogo enviar solicitud ── */}
			<Dialog
				open={!!enviarTarget}
				onClose={() => setEnviarTarget(null)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Enviar solicitud</DialogTitle>
				<DialogContent>
					<Typography>
						¿Enviar la solicitud <strong>{enviarTarget?.numero}</strong> para su aprobación? No
						podrá editarla después.
					</Typography>
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 2 }}>
					<Button onClick={() => setEnviarTarget(null)}>Cancelar</Button>
					<Button
						variant="contained"
						color="primary"
						disabled={enviarMut.isPending}
						onClick={() => enviarTarget && enviarMut.mutate(enviarTarget.id)}
					>
						{enviarMut.isPending ? 'Enviando...' : 'Enviar'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* ── Diálogo eliminar solicitud ── */}
			<Dialog
				open={!!deleteSolTarget}
				onClose={() => setDeleteSolTarget(null)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Eliminar solicitud</DialogTitle>
				<DialogContent>
					<Typography>
						¿Eliminar la solicitud <strong>{deleteSolTarget?.numero}</strong>?
					</Typography>
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 2 }}>
					<Button onClick={() => setDeleteSolTarget(null)}>Cancelar</Button>
					<Button
						variant="contained"
						color="error"
						disabled={deleteSolMut.isPending}
						onClick={() => deleteSolTarget && deleteSolMut.mutate(deleteSolTarget.id)}
					>
						{deleteSolMut.isPending ? 'Eliminando...' : 'Eliminar'}
					</Button>
				</DialogActions>
			</Dialog>

			<AprobarDialog
				open={!!aprobarId}
				onClose={() => setAprobarId(null)}
				isPending={aprobarMut.isPending}
				solicitudId={aprobarId}
				onAprobar={(id) => aprobarMut.mutate(id)}
			/>

			<RechazarDialog
				open={!!rechazarId}
				onClose={() => setRechazarId(null)}
				isPending={rechazarMut.isPending}
				solicitudId={rechazarId}
				onRechazar={(id, obs) => rechazarMut.mutate({ id, obs })}
			/>

			<DespacharDialog
				open={despachoOpen}
				onClose={() => setDespachoOpen(false)}
				isPending={despacharMut.isPending}
				items={solItems}
				onSubmit={(fecha, items) => despacharMut.mutate({ id: selectedId!, fecha, items })}
			/>

			<EntregarDialog
				open={entregaOpen}
				onClose={() => setEntregaOpen(false)}
				isPending={entregarMut.isPending}
				items={solItems}
				onSubmit={(fecha, items) => entregarMut.mutate({ id: selectedId!, fecha, items })}
			/>

			<CancelarDialog
				open={!!cancelarId}
				onClose={() => setCancelarId(null)}
				isPending={cancelarMut.isPending}
				solicitudId={cancelarId}
				onCancelar={(id) => cancelarMut.mutate(id)}
			/>
		</>
	);
}
