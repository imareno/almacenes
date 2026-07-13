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
	Divider,
	List,
	ListItemButton,
	ListItemText,
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
	SolicitudItem,
	getMisAprobaciones,
	getSolicitud,
	aprobarSolicitud,
	rechazarSolicitud
} from '../../../api/solicitudes';
import AprobarDialog from '../solicitudes/dialogs/AprobarDialog';
import RechazarDialog from '../solicitudes/dialogs/RechazarDialog';

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

export default function AprobacionesPage() {
	const { enqueueSnackbar } = useSnackbar();
	const queryClient = useQueryClient();
	const handleApiError = useApiError();

	const [filtroEstado, setFiltroEstado] = useState('enviado');
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [aprobarId, setAprobarId] = useState<number | null>(null);
	const [rechazarId, setRechazarId] = useState<number | null>(null);

	const { data: solicitudesData, isLoading: loadingList } = useQuery({
		queryKey: ['mis-aprobaciones', filtroEstado],
		queryFn: () => getMisAprobaciones({ estado: filtroEstado || undefined, pageSize: 100 })
	});
	const solicitudes = solicitudesData?.items ?? [];

	const { data: detailData, isLoading: loadingDetail } = useQuery({
		queryKey: ['solicitud-detail', selectedId],
		queryFn: () => getSolicitud(selectedId!),
		enabled: selectedId !== null
	});
	const selectedSol = detailData?.solicitud ?? null;
	const solItems = detailData?.items ?? [];

	const invalidate = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ['mis-aprobaciones'] });
		queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
		queryClient.invalidateQueries({ queryKey: ['solicitud-detail'] });
	}, [queryClient]);

	const aprobarMut = useMutation({
		mutationFn: (id: number) => aprobarSolicitud(id),
		onSuccess: () => {
			invalidate();
			enqueueSnackbar('Solicitud aprobada', { variant: 'success' });
			setAprobarId(null);
			setSelectedId(null);
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

	function canResolver(sol: SolicitudDetail | null) {
		return sol && sol.estado === 'enviado';
	}

	const itemColumns: GridColDef<SolicitudItem>[] = [
		{ field: 'codigo', headerName: 'Código', width: 100, display: 'flex' },
		{ field: 'materialNombre', headerName: 'Material', flex: 1, minWidth: 180, display: 'flex' },
		{
			field: 'cantidadSolicitada',
			headerName: 'Solicitado',
			width: 110,
			type: 'number',
			display: 'flex',
			renderCell: ({ value }) => <Typography variant="body2">{Number(value).toLocaleString('es-BO')}</Typography>
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
										Aprobaciones
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
										{loadingList
											? 'Cargando...'
											: `${solicitudes.length} solicitud(es) asignadas a usted`}
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
							<TextField
								select
								label="Estado"
								value={filtroEstado}
								onChange={(e) => setFiltroEstado(e.target.value)}
								size="small"
								sx={{ width: 200 }}
							>
								<MenuItem value="enviado">Pendientes</MenuItem>
								<MenuItem value="aprobado">Aprobadas</MenuItem>
								<MenuItem value="rechazado">Rechazadas</MenuItem>
								<MenuItem value="">Todas (histórico)</MenuItem>
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
								<Box sx={{ p: 2 }}>
									<Typography
										variant="subtitle1"
										fontWeight={600}
									>
										{filtroEstado === 'enviado' ? 'Pendientes de aprobación' : 'Solicitudes'}
									</Typography>
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
												lucide:clipboard-check
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
														<Box
															component="span"
															sx={{ display: 'block' }}
														>
															{s.sigla ? `${s.sigla} — ` : ''}
															{s.subAlmacenNombre} — {s.solicitante} —{' '}
															{new Date(s.fechaSolicitud).toLocaleDateString('es-BO')}
														</Box>
														{s.observacion && (
															<Box
																component="span"
																sx={{ display: 'block', fontStyle: 'italic' }}
															>
																Motivo: {s.observacion}
															</Box>
														)}
													</>
												}
												slotProps={{ secondary: { noWrap: true } }}
											/>
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
											lucide:clipboard-check
										</FuseSvgIcon>
										<Typography variant="body1">
											Seleccione una solicitud para revisarla
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
													variant="caption"
													color="text.secondary"
													sx={{ display: 'block' }}
												>
													{selectedSol.sigla ? `${selectedSol.sigla} — ` : ''}
													{selectedSol.subAlmacenNombre} ({selectedSol.almacenNombre})
												</Typography>
												<Typography
													variant="caption"
													color="text.secondary"
													sx={{ display: 'block' }}
												>
													Solicitante: {selectedSol.solicitante} —{' '}
													{new Date(selectedSol.fechaSolicitud).toLocaleDateString('es-BO')}
												</Typography>
												{selectedSol.fechaAprobacion && (
													<Typography
														variant="caption"
														color="text.secondary"
														sx={{ display: 'block' }}
													>
														{selectedSol.estado === 'rechazado' ? 'Rechazado' : 'Aprobado'}:{' '}
														{new Date(selectedSol.fechaAprobacion).toLocaleDateString('es-BO')}
													</Typography>
												)}
												{selectedSol.observacion && (
													<Typography
														variant="caption"
														color="text.secondary"
														sx={{ display: 'block', fontStyle: 'italic' }}
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
												{canResolver(selectedSol) && (
													<>
														<Tooltip title="Aprobar">
															<Button
																variant="contained"
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
																startIcon={
																	<FuseSvgIcon>lucide:circle-x</FuseSvgIcon>
																}
																onClick={() => setRechazarId(selectedSol.id)}
															>
																Rechazar
															</Button>
														</Tooltip>
													</>
												)}
											</Stack>
										</Box>
										<Divider />
										<Box sx={{ p: 2 }}>
											<Typography
												variant="subtitle2"
												fontWeight={600}
											>
												Materiales solicitados
											</Typography>
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
		</>
	);
}
