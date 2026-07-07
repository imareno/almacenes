import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';

type Props = {
	open: boolean;
	onClose: () => void;
	isPending: boolean;
	solicitudId: number | null;
	onRechazar: (id: number, obs?: string) => void;
};

export default function RechazarDialog({ open, onClose, isPending, solicitudId, onRechazar }: Props) {
	const [obs, setObs] = useState('');

	const handleClose = () => {
		setObs('');
		onClose();
	};

	const handleRechazar = () => {
		if (solicitudId) {
			onRechazar(solicitudId, obs.trim() || undefined);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={handleClose}
			maxWidth="sm"
			fullWidth
		>
			<DialogTitle>Rechazar solicitud</DialogTitle>
			<DialogContent dividers>
				<TextField
					label="Motivo del rechazo"
					value={obs}
					onChange={(e) => setObs(e.target.value)}
					fullWidth
					multiline
					rows={3}
					autoFocus
				/>
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button
					onClick={handleClose}
					disabled={isPending}
				>
					Cancelar
				</Button>
				<Button
					variant="contained"
					color="error"
					disabled={isPending}
					startIcon={<FuseSvgIcon>lucide:circle-x</FuseSvgIcon>}
					onClick={handleRechazar}
				>
					{isPending ? 'Procesando...' : 'Rechazar'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
