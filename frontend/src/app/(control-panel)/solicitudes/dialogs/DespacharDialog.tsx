import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';
import { SolicitudItem, DespachoItemInput } from '../../../../api/solicitudes';

type Props = {
	open: boolean;
	onClose: () => void;
	isPending: boolean;
	items: SolicitudItem[];
	onSubmit: (fecha: string, items: DespachoItemInput[]) => void;
};

export default function DespacharDialog({ open, onClose, isPending, items, onSubmit }: Props) {
	const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
	const [cantidades, setCantidades] = useState<Record<number, string>>({});

	const initAndOpen = () => {
		if (open && items.length > 0) {
			const cants: Record<number, string> = {};
			items.forEach((item) => {
				cants[item.id] = String(item.cantidadSolicitada);
			});
			setCantidades(cants);
			setFecha(new Date().toISOString().slice(0, 10));
		}
	};

	if (open && Object.keys(cantidades).length === 0) {
		initAndOpen();
	}

	const handleSubmit = () => {
		const despachoItems = items
			.filter((item) => cantidades[item.id] && Number(cantidades[item.id]) > 0)
			.map((item) => ({
				solicitudItemId: item.id,
				cantidadDespachada: Number(cantidades[item.id])
			}));

		if (despachoItems.length === 0) return;

		onSubmit(fecha, despachoItems);
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			fullWidth
			maxWidth="md"
		>
			<DialogTitle>Despachar solicitud</DialogTitle>
			<DialogContent dividers>
				<Stack
					spacing={2.5}
					sx={{ pt: 0.5 }}
				>
					<TextField
						label="Fecha de despacho"
						type="date"
						value={fecha}
						onChange={(e) => setFecha(e.target.value)}
						fullWidth
						slotProps={{ inputLabel: { shrink: true } }}
					/>
					<Paper
						variant="outlined"
						sx={{ p: 2 }}
					>
						<Typography
							variant="subtitle2"
							fontWeight={600}
							sx={{ mb: 1.5 }}
						>
							Ítems a despachar
						</Typography>
						<Stack spacing={1.5}>
							{items.map((item) => (
								<Stack
									key={item.id}
									direction="row"
									spacing={2}
									alignItems="center"
								>
									<Box sx={{ flex: 1, minWidth: 0 }}>
										<Typography
											variant="body2"
											noWrap
										>
											<strong>{item.codigo}</strong> — {item.materialNombre}
										</Typography>
										<Typography
											variant="caption"
											color="text.secondary"
										>
											Solicitado: {Number(item.cantidadSolicitada).toLocaleString('es-BO')}{' '}
											{item.unidadMedida}
										</Typography>
									</Box>
									<TextField
										label="Cant. a despachar"
										type="number"
										value={cantidades[item.id] ?? ''}
										onChange={(e) => setCantidades((p) => ({ ...p, [item.id]: e.target.value }))}
										size="small"
										sx={{ width: 160 }}
									/>
								</Stack>
							))}
						</Stack>
					</Paper>
				</Stack>
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button
					onClick={onClose}
					disabled={isPending}
				>
					Cancelar
				</Button>
				<Button
					variant="contained"
					color="primary"
					disabled={isPending}
					startIcon={<FuseSvgIcon>lucide:truck</FuseSvgIcon>}
					onClick={handleSubmit}
				>
					{isPending ? 'Procesando...' : 'Despachar'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
