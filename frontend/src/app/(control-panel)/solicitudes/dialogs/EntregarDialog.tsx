import { useState, useEffect } from 'react';
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
import { SolicitudItem } from '../../../../api/solicitudes';

type Props = {
	open: boolean;
	onClose: () => void;
	isPending: boolean;
	items: SolicitudItem[];
	onSubmit: (fecha: string) => void;
};

export default function EntregarDialog({ open, onClose, isPending, items, onSubmit }: Props) {
	const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

	useEffect(() => {
		if (open) {
			setFecha(new Date().toISOString().slice(0, 10));
		}
	}, [open]);

	const handleSubmit = () => {
		onSubmit(fecha);
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			fullWidth
			maxWidth="md"
		>
			<DialogTitle>Registrar entrega</DialogTitle>
			<DialogContent dividers>
				<Stack
					spacing={2.5}
					sx={{ pt: 0.5 }}
				>
					<TextField
						label="Fecha de entrega"
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
							Ítems a entregar
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
											Despachado: {Number(item.cantidadAprobada).toLocaleString('es-BO')}
										</Typography>
									</Box>
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
					startIcon={<FuseSvgIcon>lucide:package-check</FuseSvgIcon>}
					onClick={handleSubmit}
				>
					{isPending ? 'Procesando...' : 'Confirmar entrega'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
