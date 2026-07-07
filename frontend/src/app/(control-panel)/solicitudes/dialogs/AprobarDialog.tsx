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
	onAprobar: (id: number) => void;
};

export default function AprobarDialog({ open, onClose, isPending, solicitudId, onAprobar }: Props) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="xs"
			fullWidth
		>
			<DialogTitle>Aprobar solicitud</DialogTitle>
			<DialogContent>
				<Typography>
					¿Aprobar la solicitud <strong>#{solicitudId}</strong>? Pasará a estado &quot;aprobada&quot;.
				</Typography>
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
					color="success"
					disabled={isPending}
					startIcon={<FuseSvgIcon>lucide:circle-check</FuseSvgIcon>}
					onClick={() => solicitudId && onAprobar(solicitudId)}
				>
					{isPending ? 'Procesando...' : 'Aprobar'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
