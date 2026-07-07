import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';

type Props = {
	open: boolean;
	onClose: () => void;
	isPending: boolean;
	solicitudId: number | null;
	onCancelar: (id: number) => void;
};

export default function CancelarDialog({ open, onClose, isPending, solicitudId, onCancelar }: Props) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="xs"
			fullWidth
		>
			<DialogTitle>Cancelar solicitud</DialogTitle>
			<DialogContent>
				<Typography>
					¿Cancelar la solicitud <strong>#{solicitudId}</strong>? Esta acción no se puede deshacer.
				</Typography>
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button
					onClick={onClose}
					disabled={isPending}
				>
					Volver
				</Button>
				<Button
					variant="contained"
					color="error"
					disabled={isPending}
					startIcon={<FuseSvgIcon>lucide:ban</FuseSvgIcon>}
					onClick={() => solicitudId && onCancelar(solicitudId)}
				>
					{isPending ? 'Cancelando...' : 'Cancelar solicitud'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
