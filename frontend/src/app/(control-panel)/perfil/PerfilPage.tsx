import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import FusePageSimple from '@fuse/core/FusePageSimple';
import { styled } from '@mui/material/styles';
import {
	Autocomplete,
	Box,
	Button,
	Paper,
	Stack,
	TextField,
	Typography
} from '@mui/material';
import { getMyPerfil, getSubAlmacenesPerfil, getAprobadores, savePerfil, PerfilItem, SubAlmacenPerfil, Aprobador, PerfilSaveInput } from '../../../api/perfil';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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

export default function PerfilPage() {
	const { enqueueSnackbar } = useSnackbar();
	const queryClient = useQueryClient();
	const handleApiError = useApiError();

	const [selectedSub, setSelectedSub] = useState<SubAlmacenPerfil | null>(null);
	const [selectedAprobador, setSelectedAprobador] = useState<Aprobador | null>(null);

	// ─── queries ──────────────────────────────────────────────────────────────

	const { data: perfilData, isLoading: loadingPerfil } = useQuery({
		queryKey: ['perfil'],
		queryFn: getMyPerfil
	});
	const perfilItems = perfilData?.items ?? [];

	const { data: subData } = useQuery({
		queryKey: ['perfil-sub-almacenes'],
		queryFn: getSubAlmacenesPerfil
	});
	const subAlmacenes = subData?.items ?? [];

	const { data: aprobadoresData } = useQuery({
		queryKey: ['perfil-aprobadores'],
		queryFn: getAprobadores
	});
	const aprobadores = aprobadoresData?.items ?? [];

	// ─── pre-select from existing perfil ──────────────────────────────────────

	useEffect(() => {
		if (perfilItems.length > 0 && subAlmacenes.length > 0) {
			const ids = new Set(perfilItems.map(p => p.subAlmacenId));
			const subsEnPerfil = subAlmacenes.filter(s => ids.has(s.id));
			setSelectedSub(subsEnPerfil[0] ?? null);

			const firstAprob = perfilItems[0]?.aprobadorId;
			if (firstAprob && aprobadores.length > 0 && perfilItems.every(p => p.aprobadorId === firstAprob)) {
				const found = aprobadores.find(a => a.ci === firstAprob);
				setSelectedAprobador(found ?? null);
			}
		}
	}, [perfilItems, subAlmacenes, aprobadores]);

	// ─── mutation ─────────────────────────────────────────────────────────────

	const saveMut = useMutation({
		mutationFn: (data: PerfilSaveInput) => savePerfil(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['perfil'] });
			enqueueSnackbar('Perfil guardado', { variant: 'success' });
		},
		onError: handleApiError
	});

	function handleSave() {
		if (!selectedSub) {
			enqueueSnackbar('Seleccione un sub-almacén', { variant: 'warning' });
			return;
		}
		if (!selectedAprobador) {
			enqueueSnackbar('Seleccione un aprobador', { variant: 'warning' });
			return;
		}
		saveMut.mutate({
			subAlmacenIds: [selectedSub.id],
			aprobadorId: selectedAprobador.ci,
			aprobadorNombre: selectedAprobador.nombreCompleto,
			aprobadorCargo: selectedAprobador.cargo
		});
	}

	// ─── grouped sub-almacenes for display ────────────────────────────────────

	const groupedSubs = useMemo(() => {
		const map = new Map<string, SubAlmacenPerfil[]>();
		subAlmacenes.forEach(s => {
			const key = s.almacenNombre;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(s);
		});
		return Array.from(map.entries());
	}, [subAlmacenes]);

	// ─── render ───────────────────────────────────────────────────────────────

	return (
		<Root
			header={
				<Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<Typography variant="h5" fontWeight={600}>Perfil</Typography>
				</Box>
			}
			content={
				<Box sx={{ p: 3, maxWidth: '60%', minWidth: 600, mx: 'auto' }}>
					<Stack spacing={4}>
						{/* ── Formulario ── */}
						<Paper variant="outlined" sx={{ p: 4 }}>
							<Typography variant="subtitle1" fontWeight={600} sx={{ mb: 3 }}>
								Configuración de perfil
							</Typography>

							<Stack spacing={3}>
								<Autocomplete
									options={subAlmacenes}
									value={selectedSub}
									onChange={(_e, newValue) => setSelectedSub(newValue)}
									groupBy={(option) => option.almacenNombre}
									getOptionLabel={(option) => option.sigla ? `${option.sigla} — ${option.nombre}` : option.nombre}
									isOptionEqualToValue={(opt, val) => opt.id === val.id}
									renderOption={(props, option) => (
										<li {...props} key={option.id}>
											{option.sigla ? `${option.sigla} — ${option.nombre}` : option.nombre}
										</li>
									)}
									renderInput={(params) => (
										<TextField {...params} label="Sub-almacén *" placeholder="Buscar..." />
									)}
									renderGroup={(params) => (
										<li key={params.key}>
											<Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', fontWeight: 600, fontSize: 13 }}>
												{params.group}
											</Box>
											<ul style={{ padding: 0 }}>{params.children}</ul>
										</li>
									)}
								/>

								<Autocomplete
									options={aprobadores}
									value={selectedAprobador}
									onChange={(_e, newValue) => setSelectedAprobador(newValue)}
									getOptionLabel={(option) => option.nombreCompleto}
									isOptionEqualToValue={(opt, val) => opt.ci === val.ci}
									renderOption={(props, option) => (
										<li {...props} key={option.ci}>
											<Stack sx={{ width: '100%' }}>
												<Typography variant="body2" fontWeight={600} noWrap>
													{option.nombreCompleto}
												</Typography>
												<Typography variant="caption" color="text.secondary" noWrap>
													{option.cargo}
												</Typography>
											</Stack>
										</li>
									)}
									renderInput={(params) => (
										<TextField {...params} label="Aprobador por defecto *" placeholder="Buscar..." />
									)}
								/>

								<Button
									variant="contained"
									size="large"
									startIcon={<CheckCircleIcon />}
									onClick={handleSave}
									disabled={saveMut.isPending}
								>
									{saveMut.isPending ? 'Guardando...' : 'Guardar perfil'}
								</Button>
							</Stack>
						</Paper>

						{/* ── Perfil actual ── */}
						<Paper variant="outlined" sx={{ p: 3 }}>
							<Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
								Perfil actual
							</Typography>

							{loadingPerfil && (
								<Typography variant="body2" color="text.secondary">Cargando...</Typography>
							)}
							{!loadingPerfil && perfilItems.length === 0 && (
								<Typography variant="body2" color="text.secondary">No tiene sub-almacenes asignados en su perfil.</Typography>
							)}
							{!loadingPerfil && perfilItems.length > 0 && (
								<Stack spacing={1.5}>
									{groupedSubs.map(([almacen, subs]) => {
										const subsInPerfil = subs.filter(s => perfilItems.some(p => p.subAlmacenId === s.id));
										if (subsInPerfil.length === 0) return null;
										return (
											<Box key={almacen}>
												<Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
													{almacen}
												</Typography>
												{subsInPerfil.map(s => {
													const perfil = perfilItems.find(p => p.subAlmacenId === s.id)!;
													return (
														<Paper key={s.id} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ml: 2, mb: 1 }}>
															<Stack direction="row" spacing={1} alignItems="center">
																<Typography variant="body2" fontWeight={600}>
																	{s.sigla ? `${s.sigla} — ${s.nombre}` : s.nombre}
																</Typography>
															</Stack>
															<Stack direction="row" spacing={1} alignItems="center">
																<Typography variant="caption" color="text.secondary">Aprobador:</Typography>
																<Stack>
																	<Typography variant="body2" fontWeight={600}>{perfil.aprobadorNombre ?? perfil.aprobadorId}</Typography>
																	{perfil.aprobadorCargo && (
																		<Typography variant="caption" color="text.secondary">{perfil.aprobadorCargo}</Typography>
																	)}
																</Stack>
															</Stack>
														</Paper>
													);
												})}
											</Box>
										);
									})}
								</Stack>
							)}
						</Paper>
					</Stack>
				</Box>
			}
		/>
	);
}
