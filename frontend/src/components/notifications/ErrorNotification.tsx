import { forwardRef } from 'react';
import { CustomContentProps, useSnackbar } from 'notistack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import FuseSvgIcon from '@fuse/core/FuseSvgIcon';

const ErrorNotification = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
	const { id, message } = props;
	const { closeSnackbar } = useSnackbar();

	return (
		<Paper
			ref={ref}
			elevation={6}
			sx={{
				display: 'flex',
				alignItems: 'flex-start',
				gap: '12px',
				width: '344px',
				padding: '14px 16px',
				borderRadius: '12px',
				backgroundColor: '#7f1d1d',
				color: 'white'
			}}
		>
			{/* Ícono */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: 36,
					height: 36,
					borderRadius: '50%',
					backgroundColor: 'rgba(0,0,0,0.3)',
					flexShrink: 0,
					marginTop: 2
				}}
			>
				<FuseSvgIcon
					sx={{ color: '#fca5a5' }}
					size={20}
				>
					heroicons-solid:x-circle
				</FuseSvgIcon>
			</div>

			{/* Contenido */}
			<div style={{ flex: 1, minWidth: 0 }}>
				<Typography
					variant="subtitle2"
					sx={{ fontWeight: 700, color: 'white', lineHeight: 1.4 }}
				>
					Acceso denegado
				</Typography>
				<Typography
					variant="body2"
					sx={{ color: '#fca5a5', lineHeight: 1.4, mt: '2px' }}
				>
					{message}
				</Typography>
			</div>

			{/* Cerrar */}
			<IconButton
				size="small"
				onClick={() => closeSnackbar(id)}
				sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: 'white' }, mt: '-4px', mr: '-4px' }}
			>
				<FuseSvgIcon size={16}>heroicons-solid:x-mark</FuseSvgIcon>
			</IconButton>
		</Paper>
	);
});

ErrorNotification.displayName = 'ErrorNotification';

export default ErrorNotification;
