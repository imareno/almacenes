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
import DeleteIcon from '@mui/icons-material/Delete';
import UndoIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import DescriptionIcon from '@mui/icons-material/Description';
import {
	SolicitudListItem,
	SolicitudDetail,
	SolicitudItem,
	getSolicitudes,
	getSolicitud,
	createSolicitud,
	aprobarSolicitud,
	rechazarSolicitud,
	despacharSolicitud,
	entregarSolicitud,
	cancelarSolicitud,
	SolicitudCreateInput,
	DespachoItemInput,
	EntregaItemInput
} from '../../../api/solicitudes';
import { AlmacenAsignado, getAlmacenesAsignados } from '../../../api/almacenes';
import { getMateriales, Material } from '../../../api/materiales';
import { getMyPerfil } from '../../../api/perfil';
import useUser from '@auth/useUser';

// ─── constantes ──────────────────────────────────────────────────────────────

const estadoColor: Record<string, 'default' | 'success' | 'error' | 'warning' | 'info'> = {
	pendiente: 'warning',
	aprobada: 'info',
	rechazada: 'error',
	despachada: 'info',
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
			try { const body = await response.json(); msg = body?.error ?? msg; } catch { /* */ }
		} else if (err instanceof Error) { msg = err.message; }
		enqueueSnackbar(msg, { variant: 'error' });
	};
}

function getRole(role: string | string[] | null | undefined): string {
	if (!role) return '';
	if (Array.isArray(role)) return role[0] ?? '';
	return role;
}

// ─── componente ──────────────────────────────────────────────────────────────

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

	// ─── state ────────────────────────────────────────────────────────────────
	const [filtroEstado, setFiltroEstado] = useState('');
	const [selectedId, setSelectedId] = useState<number | null>(null);

	// crear
	const [createOpen, setCreateOpen] = useState(false);
	const [createSubAlmacenId, setCreateSubAlmacenId] = useState<number | ''>('');
	const [createObservacion, setCreateObservacion] = useState('');
	const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
	const [createItemMatId, setCreateItemMatId] = useState<number | ''>('');
	const [createItemCant, setCreateItemCant] = useState('');
	const [createItems, setCreateItems] = useState<{ materialId: number; codigo: string; materialNombre: string; cantidad: number }[]>([]);

	// aprobar
	const [aprobarId, setAprobarId] = useState<number | null>(null);

	// rechazar
	const [rechazarId, setRechazarId] = useState<number | null>(null);
	const [rechazarObs, setRechazarObs] = useState('');

	// despachar
	const [despachoOpen, setDespachoOpen] = useState(false);
	const [despachoFecha, setDespachoFecha] = useState(new Date().toISOString().slice(0, 10));
	const [despachoCantidades, setDespachoCantidades] = useState<Record<number, string>>({});

	// entregar
	const [entregaOpen, setEntregaOpen] = useState(false);
	const [entregaFecha, setEntregaFecha] = useState(new Date().toISOString().slice(0, 10));
	const [entregaCantidades, setEntregaCantidades] = useState<Record<number, string>>({});

	// cancelar
	const [cancelarId, setCancelarId] = useState<number | null>(null);

	// material search para crear
	const [matSearch, setMatSearch] = useState('');

	// ─── queries ──────────────────────────────────────────────────────────────

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
		queryFn: () => getSolicitudes({
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

	const matSearchReady = matSearch.trim().length >= 4;
	const { data: materialesData } = useQuery({
		queryKey: ['materiales-sol', matSearch.trim()],
		queryFn: () => getMateriales({ buscar: matSearch.trim(), soloActivos: true, pageSize: 1000 }),
		enabled: matSearchReady
	});
	const materiales = materialesData?.items ?? [];

	// ─── invalidations ────────────────────────────────────────────────────────

	const invalidate = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
		queryClient.invalidateQueries({ queryKey: ['solicitud-detail'] });
	}, [queryClient]);

	// ─── mutations ────────────────────────────────────────────────────────────

	const createMut = useMutation({
		mutationFn: (data: SolicitudCreateInput) => createSolicitud(data),
		onSuccess: (res) => {
			invalidate();
			enqueueSnackbar(`Solicitud ${res.numero} creada`, { variant: 'success' });
			setCreateOpen(false);
			setSelectedId(res.id);
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
			setRechazarObs('');
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

	// ─── helpers ──────────────────────────────────────────────────────────────

	function isOwnSol(sol: { solicitanteId: number }) {
		return sol.solicitanteId === Number(userId);
	}

	function canCreate() { return (isAdmin || isSolicitante) && perfilItem !== null; }
	function canAprobarRechazar(sol: SolicitudDetail | null) {
		return sol && (isAdmin || isAprobador) && sol.estado === 'pendiente';
	}
	function canDespachar(sol: SolicitudDetail | null) {
		return sol && (isAdmin || isAlmacenero) && sol.estado === 'aprobada';
	}
	function canEntregar(sol: SolicitudDetail | null) {
		return sol && (isAdmin || isAlmacenero) && sol.estado === 'despachada';
	}
	function canCancelar(sol: SolicitudDetail | null) {
		return sol && (isAdmin || (isSolicitante && isOwnSol(sol))) && sol.estado === 'pendiente';
	}

	// ─── handlers ─────────────────────────────────────────────────────────────

	function openCreate() {
		setCreateSubAlmacenId(perfilItem?.subAlmacenId ?? '');
		setCreateObservacion('');
		setCreateItems([]);
		setCreateErrors({});
		setCreateItemMatId('');
		setCreateItemCant('');
		setMatSearch('');
		setCreateOpen(true);
	}

	function addCreateItem() {
		const next: Record<string, string> = {};
		if (createSubAlmacenId === '') next.subAlmacen = 'Seleccione un sub-almacén';
		if (createItemMatId === '') next.material = 'Seleccione un material';
		if (!createItemCant || Number(createItemCant) <= 0) next.cantidad = 'Debe ser mayor a 0';
		setCreateErrors(next);
		if (Object.keys(next).length > 0) return;

		const mat = materiales.find(m => m.id === createItemMatId);
		if (!mat) return;

		const already = createItems.find(i => i.materialId === createItemMatId);
		if (already) {
			enqueueSnackbar('Ese material ya fue agregado', { variant: 'warning' });
			return;
		}

		setCreateItems(prev => [...prev, {
			materialId: mat.id,
			codigo: mat.codigo,
			materialNombre: mat.nombre,
			cantidad: Number(createItemCant)
		}]);
		setCreateItemMatId('');
		setCreateItemCant('');
		setMatSearch('');
	}

	function submitCreate() {
		if (createSubAlmacenId === '') {
			setCreateErrors({ subAlmacen: 'Requerido' });
			return;
		}
		if (createItems.length === 0) {
			enqueueSnackbar('Agregue al menos un material', { variant: 'warning' });
			return;
		}
		createMut.mutate({
			subAlmacenId: createSubAlmacenId as number,
			items: createItems.map(i => ({ materialId: i.materialId, cantidad: i.cantidad })),
			observacion: createObservacion.trim() || undefined
		});
	}

	function openDespacho() {
		if (!solItems.length) return;
		const cants: Record<number, string> = {};
		solItems.forEach(item => {
			cants[item.id] = String(item.cantidadSolicitada);
		});
		setDespachoCantidades(cants);
		setDespachoFecha(new Date().toISOString().slice(0, 10));
		setDespachoOpen(true);
	}

	function submitDespacho() {
		const items = solItems
			.filter(item => despachoCantidades[item.id] && Number(despachoCantidades[item.id]) > 0)
			.map(item => ({
				solicitudItemId: item.id,
				cantidadDespachada: Number(despachoCantidades[item.id])
			}));
		if (items.length === 0) {
			enqueueSnackbar('Indique al menos una cantidad a despachar', { variant: 'warning' });
			return;
		}
		despacharMut.mutate({ id: selectedId!, fecha: despachoFecha, items });
	}

	function openEntrega() {
		if (!solItems.length) return;
		const cants: Record<number, string> = {};
		solItems.forEach(item => {
			cants[item.id] = String(item.cantidadDespachada);
		});
		setEntregaCantidades(cants);
		setEntregaFecha(new Date().toISOString().slice(0, 10));
		setEntregaOpen(true);
	}

	function submitEntrega() {
		const items = solItems
			.filter(item => entregaCantidades[item.id] && Number(entregaCantidades[item.id]) > 0)
			.map(item => ({
				solicitudItemId: item.id,
				cantidadEntregada: Number(entregaCantidades[item.id])
			}));
		if (items.length === 0) {
			enqueueSnackbar('Indique al menos una cantidad entregada', { variant: 'warning' });
			return;
		}
		entregarMut.mutate({ id: selectedId!, fecha: entregaFecha, items });
	}

	function onMaterialSeleccion(materialId: number | '') {
		setCreateItemMatId(materialId);
		const mat = materiales.find(m => m.id === materialId);
		if (mat) {
			setCreateItemCant('1');
		}
		if (createErrors.material) setCreateErrors(p => ({ ...p, material: '' }));
	}

	// ─── columnas ─────────────────────────────────────────────────────────────

	const itemColumns: GridColDef<SolicitudItem>[] = [
		{ field: 'codigo', headerName: 'Código', width: 100, display: 'flex' },
		{ field: 'materialNombre', headerName: 'Material', flex: 1, minWidth: 180, display: 'flex' },
		{ field: 'unidadMedida', headerName: 'Unidad', width: 80, display: 'flex' },
		{
			field: 'cantidadSolicitada', headerName: 'Solicitado', width: 110, type: 'number', display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2">{Number(value).toLocaleString('es-BO')}</Typography>
		},
		{
			field: 'cantidadDespachada', headerName: 'Despachado', width: 110, type: 'number', display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2">{Number(value).toLocaleString('es-BO')}</Typography>
		},
		{
			field: 'cantidadEntregada', headerName: 'Entregado', width: 110, type: 'number', display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2">{Number(value).toLocaleString('es-BO')}</Typography>
		}
	];

	// ─── render ───────────────────────────────────────────────────────────────

	return (
		<Root
			header={
				<Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<Typography variant="h5" fontWeight={600}>Solicitudes</Typography>
				</Box>
			}
			content={
				<Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
					{/* Filtros */}
					<Stack direction="row" spacing={2} alignItems="center">
						{perfilItem ? (
							<Paper variant="outlined" sx={{ px: 2, py: 0.75, bgcolor: 'action.hover' }}>
								<Typography variant="body2">
									<strong>{perfilItem.sigla ? `${perfilItem.sigla} — ` : ''}{perfilItem.subAlmacenNombre}</strong>
									<Typography component="span" variant="body2" color="text.secondary"> ({perfilItem.almacenNombre})</Typography>
								</Typography>
							</Paper>
						) : (
							<Paper variant="outlined" sx={{ px: 2, py: 0.75, bgcolor: 'warning.light', borderColor: 'warning.main' }}>
								<Typography variant="body2" color="warning.dark">
									Perfil incompleto — configure su sub-almacen en la pagina de Perfil
								</Typography>
							</Paper>
						)}
						<TextField
							select label="Estado" value={filtroEstado}
							onChange={(e) => setFiltroEstado(e.target.value)}
							size="small" sx={{ width: 160 }}
						>
							<MenuItem value=""><em>Todos</em></MenuItem>
							<MenuItem value="pendiente">Pendiente</MenuItem>
							<MenuItem value="aprobada">Aprobada</MenuItem>
							<MenuItem value="rechazada">Rechazada</MenuItem>
							<MenuItem value="despachada">Despachada</MenuItem>
							<MenuItem value="entregado">Entregado</MenuItem>
						</TextField>
					</Stack>

					<Box sx={{ flex: 1, display: 'flex', gap: 3, minHeight: 0 }}>
						{/* ── Panel izquierdo: lista ── */}
						<Paper variant="outlined" sx={{ flex: '0 0 40%', minWidth: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
							<Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
								<Typography variant="subtitle1" fontWeight={600}>Solicitudes</Typography>
								<Stack direction="row" spacing={1} alignItems="center">
									{(isAdmin || isSolicitante) && !perfilItem && (
										<Typography variant="caption" color="text.secondary">Configure su perfil para crear solicitudes</Typography>
									)}
									{canCreate() && (
										<Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
											Nueva Solicitud
										</Button>
									)}
								</Stack>
							</Box>
							<Divider />
							<List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
								{loadingList && <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">Cargando...</Typography></Box>}
								{!loadingList && solicitudes.length === 0 && <Box sx={{ p: 2, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">Sin solicitudes</Typography></Box>}
								{solicitudes.map(s => (
									<ListItemButton key={s.id} selected={selectedId === s.id} onClick={() => setSelectedId(s.id)} sx={{ gap: 1, flexWrap: 'wrap' }}>
										<ListItemText
											primary={
												<Stack direction="row" spacing={1} alignItems="center">
													<Typography variant="body2" fontWeight={600}>{s.numero}</Typography>
													<Chip label={s.estado} color={estadoColor[s.estado] ?? 'default'} size="small" variant="outlined" sx={{ textTransform: 'capitalize', height: 20, fontSize: 11 }} />
												</Stack>
											}
											secondary={
												<>
													{s.sigla ? `${s.sigla} — ` : ''}{s.subAlmacenNombre} — {s.solicitante} — {new Date(s.fechaSolicitud).toLocaleDateString('es-BO')}
												</>
											}
											slotProps={{ secondary: { noWrap: true } }}
										/>
									</ListItemButton>
								))}
							</List>
						</Paper>

						{/* ── Panel derecho: detalle ── */}
						<Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
							{!selectedSol ? (
								<Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary' }}>
									<DescriptionIcon sx={{ fontSize: 48, opacity: 0.3 }} />
									<Typography variant="body1">Seleccione una solicitud para ver su detalle</Typography>
								</Box>
							) : (
								<>
									<Box sx={{ p: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
										<Box>
											<Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
												<Typography variant="subtitle1" fontWeight={600}>{selectedSol.numero}</Typography>
												<Chip label={selectedSol.estado} color={estadoColor[selectedSol.estado] ?? 'default'} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
											</Stack>
											<Typography variant="body2" color="text.secondary">
												{selectedSol.sigla ? `${selectedSol.sigla} — ` : ''}{selectedSol.subAlmacenNombre} ({selectedSol.almacenNombre}) — Solicitante: {selectedSol.solicitante}
											</Typography>
											<Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
												<Typography variant="caption" color="text.secondary">
													Creado: {new Date(selectedSol.fechaSolicitud).toLocaleDateString('es-BO')}
												</Typography>
												{selectedSol.fechaAprobacion && (
													<Typography variant="caption" color="text.secondary">
														{selectedSol.estado === 'rechazada' ? 'Rechazado' : 'Aprobado'}: {new Date(selectedSol.fechaAprobacion).toLocaleDateString('es-BO')}
														{selectedSol.aprobador ? ` (${selectedSol.aprobador})` : ''}
													</Typography>
												)}
												{selectedSol.fechaDespacho && (
													<Typography variant="caption" color="text.secondary">
														Despachado: {new Date(selectedSol.fechaDespacho).toLocaleDateString('es-BO')}
														{selectedSol.almacenero ? ` (${selectedSol.almacenero})` : ''}
													</Typography>
												)}
												{selectedSol.fechaEntrega && (
													<Typography variant="caption" color="text.secondary">
														Entregado: {new Date(selectedSol.fechaEntrega).toLocaleDateString('es-BO')}
													</Typography>
												)}
											</Stack>
											{selectedSol.observacion && (
												<Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
													Nota: {selectedSol.observacion}
												</Typography>
											)}
										</Box>
										<Stack direction="row" spacing={1} sx={{ flexShrink: 0, ml: 2 }}>
											{canAprobarRechazar(selectedSol) && (
												<>
													<Tooltip title="Aprobar">
														<Button variant="outlined" color="success" size="small" startIcon={<CheckCircleIcon />} onClick={() => setAprobarId(selectedSol.id)}>Aprobar</Button>
													</Tooltip>
													<Tooltip title="Rechazar">
														<Button variant="outlined" color="error" size="small" startIcon={<UndoIcon />} onClick={() => setRechazarId(selectedSol.id)}>Rechazar</Button>
													</Tooltip>
												</>
											)}
											{canDespachar(selectedSol) && (
												<Tooltip title="Despachar">
													<Button variant="outlined" color="primary" size="small" startIcon={<LocalShippingIcon />} onClick={openDespacho}>Despachar</Button>
												</Tooltip>
											)}
											{canEntregar(selectedSol) && (
												<Tooltip title="Registrar entrega">
													<Button variant="outlined" color="primary" size="small" startIcon={<AssignmentTurnedInIcon />} onClick={openEntrega}>Entregar</Button>
												</Tooltip>
											)}
											{canCancelar(selectedSol) && (
												<Tooltip title="Cancelar">
													<Button variant="outlined" color="error" size="small" startIcon={<UndoIcon />} onClick={() => setCancelarId(selectedSol.id)}>Cancelar</Button>
												</Tooltip>
											)}
										</Stack>
									</Box>
									<Divider />
									<Box sx={{ flex: 1, p: 2 }}>
										<DataGrid
											rows={solItems} columns={itemColumns} loading={loadingDetail}
											disableRowSelectionOnClick density="compact" getRowId={r => r.id}
											pageSizeOptions={[25, 50]} sx={{ border: 'none', height: '100%' }}
										/>
									</Box>
								</>
							)}
						</Paper>
					</Box>

					{/* ── Diálogo: crear solicitud ── */}
					<Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
						<DialogTitle>Nueva Solicitud</DialogTitle>
						<DialogContent dividers>
							<Stack spacing={2.5} sx={{ pt: 0.5 }}>
								{perfilItem ? (
									<Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
										<Stack spacing={0.5}>
											<Typography variant="caption" color="text.secondary">Sub-almacén (según su perfil)</Typography>
											<Typography variant="body1" fontWeight={600}>{perfilItem.sigla ? `${perfilItem.sigla} — ${perfilItem.subAlmacenNombre}` : perfilItem.subAlmacenNombre}</Typography>
											<Typography variant="body2" color="text.secondary">{perfilItem.almacenNombre}</Typography>
										</Stack>
									</Paper>
								) : (
									<TextField
										select label="Sub-almacén *" value={createSubAlmacenId}
										onChange={(e) => {
											setCreateSubAlmacenId(e.target.value === '' ? '' : Number(e.target.value));
											setCreateItems([]);
											setCreateItemMatId('');
											setMatSearch('');
											if (createErrors.subAlmacen) setCreateErrors(p => ({ ...p, subAlmacen: '' }));
										}}
										error={!!createErrors.subAlmacen} helperText={createErrors.subAlmacen}
										fullWidth
									>
										<MenuItem value=""><em>Seleccione un sub-almacén</em></MenuItem>
										{almacenesAsignados.flatMap((a) => [
											<ListSubheader key={`h-${a.id}`}>{a.nombre}</ListSubheader>,
											...a.subAlmacenes.map((s) => (
												<MenuItem key={s.id} value={s.id}>
													{s.sigla ? `${s.sigla} — ${s.nombre}` : s.nombre}
												</MenuItem>
											))
										])}
									</TextField>
								)}

								{createSubAlmacenId !== '' && (
									<>
										<Paper variant="outlined" sx={{ p: 2 }}>
											<Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Materiales solicitados</Typography>

											<Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
												<TextField
													select label="Material *" value={createItemMatId}
													onChange={(e) => onMaterialSeleccion(e.target.value === '' ? '' : Number(e.target.value))}
													error={!!createErrors.material}
													sx={{ flex: 1 }}
													size="small"
													slotProps={{ select: { MenuProps: { PaperProps: { sx: { maxHeight: 450 } } } } }}
												>
													<ListSubheader sx={{ p: 1 }}>
														<TextField
															size="small" placeholder="Escriba al menos 4 letras..." fullWidth autoFocus
															value={matSearch}
															onChange={(e) => setMatSearch(e.target.value)}
															onKeyDown={(e) => e.stopPropagation()}
														/>
													</ListSubheader>
													{!matSearchReady && <MenuItem disabled>Escriba al menos 4 letras para buscar</MenuItem>}
													{matSearchReady && materiales.length === 0 && <MenuItem disabled>Sin resultados</MenuItem>}
													{materiales.map(m => (
														<MenuItem key={m.id} value={m.id}>{m.codigo} — {m.nombre}</MenuItem>
													))}
												</TextField>
												<TextField
													label="Cant." type="number" value={createItemCant}
													onChange={(e) => { setCreateItemCant(e.target.value); if (createErrors.cantidad) setCreateErrors(p => ({ ...p, cantidad: '' })); }}
													error={!!createErrors.cantidad}
													size="small" sx={{ width: 110 }}
												/>
												<Button variant="contained" size="small" onClick={addCreateItem}>Agregar</Button>
											</Stack>

											{createErrors.material && (
												<Typography variant="caption" color="error">{createErrors.material}</Typography>
											)}
											{createErrors.cantidad && (
												<Typography variant="caption" color="error">{createErrors.cantidad}</Typography>
											)}

											{createItems.length === 0 ? (
												<Typography variant="body2" color="text.secondary">No hay materiales agregados</Typography>
											) : (
												<Stack spacing={1}>
													{createItems.map((item, idx) => (
														<Paper key={idx} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
															<Box>
																<Typography variant="body2" fontWeight={600}>{item.codigo} — {item.materialNombre}</Typography>
															<Typography variant="caption" color="text.secondary">
																Cantidad: {item.cantidad.toLocaleString('es-BO')}
															</Typography>
															</Box>
															<IconButton size="small" color="error" onClick={() => setCreateItems(prev => prev.filter((_, i) => i !== idx))}>
																<DeleteIcon sx={{ fontSize: 18 }} />
															</IconButton>
														</Paper>
													))}
												</Stack>
											)}
										</Paper>
									</>
								)}

								<TextField
									label="Observación" value={createObservacion}
									onChange={(e) => setCreateObservacion(e.target.value)}
									fullWidth multiline rows={2}
								/>
							</Stack>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setCreateOpen(false)} disabled={createMut.isPending}>Cancelar</Button>
							<Button variant="contained" onClick={submitCreate} disabled={createMut.isPending}>
								{createMut.isPending ? 'Creando...' : 'Crear'}
							</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo: aprobar ── */}
					<Dialog open={!!aprobarId} onClose={() => setAprobarId(null)} maxWidth="xs" fullWidth>
						<DialogTitle>Aprobar solicitud</DialogTitle>
						<DialogContent><Typography>¿Aprobar la solicitud <strong>#{aprobarId}</strong>? Pasará a estado "aprobada".</Typography></DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setAprobarId(null)}>Cancelar</Button>
							<Button variant="contained" color="success" disabled={aprobarMut.isPending}
								onClick={() => aprobarId && aprobarMut.mutate(aprobarId)}>
								{aprobarMut.isPending ? 'Procesando...' : 'Aprobar'}
							</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo: rechazar ── */}
					<Dialog open={!!rechazarId} onClose={() => { setRechazarId(null); setRechazarObs(''); }} maxWidth="sm" fullWidth>
						<DialogTitle>Rechazar solicitud</DialogTitle>
						<DialogContent dividers>
							<TextField
								label="Motivo del rechazo" value={rechazarObs}
								onChange={(e) => setRechazarObs(e.target.value)}
								fullWidth multiline rows={3} autoFocus
							/>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => { setRechazarId(null); setRechazarObs(''); }}>Cancelar</Button>
							<Button variant="contained" color="error" disabled={rechazarMut.isPending}
								onClick={() => rechazarId && rechazarMut.mutate({ id: rechazarId, obs: rechazarObs })}>
								{rechazarMut.isPending ? 'Procesando...' : 'Rechazar'}
							</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo: despachar ── */}
					<Dialog open={despachoOpen} onClose={() => setDespachoOpen(false)} fullWidth maxWidth="md">
						<DialogTitle>Despachar solicitud</DialogTitle>
						<DialogContent dividers>
							<Stack spacing={2.5} sx={{ pt: 0.5 }}>
								<TextField label="Fecha de despacho" type="date" value={despachoFecha}
									onChange={(e) => setDespachoFecha(e.target.value)}
									fullWidth slotProps={{ inputLabel: { shrink: true } }}
								/>
								<Paper variant="outlined" sx={{ p: 2 }}>
									<Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Ítems a despachar</Typography>
									<Stack spacing={1.5}>
										{solItems.map(item => (
											<Stack key={item.id} direction="row" spacing={2} alignItems="center">
												<Box sx={{ flex: 1, minWidth: 0 }}>
													<Typography variant="body2" noWrap>
														<strong>{item.codigo}</strong> — {item.materialNombre}
													</Typography>
													<Typography variant="caption" color="text.secondary">
														Solicitado: {Number(item.cantidadSolicitada).toLocaleString('es-BO')} {item.unidadMedida}
													</Typography>
												</Box>
												<TextField
													label="Cant. a despachar" type="number"
													value={despachoCantidades[item.id] ?? ''}
													onChange={(e) => setDespachoCantidades(p => ({ ...p, [item.id]: e.target.value }))}
													size="small" sx={{ width: 160 }}
												/>
											</Stack>
										))}
									</Stack>
								</Paper>
							</Stack>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setDespachoOpen(false)} disabled={despacharMut.isPending}>Cancelar</Button>
							<Button variant="contained" color="primary" disabled={despacharMut.isPending} onClick={submitDespacho}>
								{despacharMut.isPending ? 'Procesando...' : 'Despachar'}
							</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo: entregar ── */}
					<Dialog open={entregaOpen} onClose={() => setEntregaOpen(false)} fullWidth maxWidth="md">
						<DialogTitle>Registrar entrega</DialogTitle>
						<DialogContent dividers>
							<Stack spacing={2.5} sx={{ pt: 0.5 }}>
								<TextField label="Fecha de entrega" type="date" value={entregaFecha}
									onChange={(e) => setEntregaFecha(e.target.value)}
									fullWidth slotProps={{ inputLabel: { shrink: true } }}
								/>
								<Paper variant="outlined" sx={{ p: 2 }}>
									<Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>Ítems entregados</Typography>
									<Stack spacing={1.5}>
										{solItems.map(item => (
											<Stack key={item.id} direction="row" spacing={2} alignItems="center">
												<Box sx={{ flex: 1, minWidth: 0 }}>
													<Typography variant="body2" noWrap>
														<strong>{item.codigo}</strong> — {item.materialNombre}
													</Typography>
													<Typography variant="caption" color="text.secondary">
														Despachado: {Number(item.cantidadDespachada).toLocaleString('es-BO')} {item.unidadMedida}
													</Typography>
												</Box>
												<TextField
													label="Cant. entregada" type="number"
													value={entregaCantidades[item.id] ?? ''}
													onChange={(e) => setEntregaCantidades(p => ({ ...p, [item.id]: e.target.value }))}
													size="small" sx={{ width: 160 }}
												/>
											</Stack>
										))}
									</Stack>
								</Paper>
							</Stack>
						</DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setEntregaOpen(false)} disabled={entregarMut.isPending}>Cancelar</Button>
							<Button variant="contained" color="primary" disabled={entregarMut.isPending} onClick={submitEntrega}>
								{entregarMut.isPending ? 'Procesando...' : 'Confirmar entrega'}
							</Button>
						</DialogActions>
					</Dialog>

					{/* ── Diálogo: cancelar ── */}
					<Dialog open={!!cancelarId} onClose={() => setCancelarId(null)} maxWidth="xs" fullWidth>
						<DialogTitle>Cancelar solicitud</DialogTitle>
						<DialogContent><Typography>¿Cancelar la solicitud <strong>#{cancelarId}</strong>? Esta acción no se puede deshacer.</Typography></DialogContent>
						<DialogActions sx={{ px: 3, py: 2 }}>
							<Button onClick={() => setCancelarId(null)}>Volver</Button>
							<Button variant="contained" color="error" disabled={cancelarMut.isPending}
								onClick={() => cancelarId && cancelarMut.mutate(cancelarId)}>
								{cancelarMut.isPending ? 'Cancelando...' : 'Cancelar solicitud'}
							</Button>
						</DialogActions>
					</Dialog>
				</Box>
			}
		/>
	);
}
