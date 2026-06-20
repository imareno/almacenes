import Typography from '@mui/material/Typography';

function SignInPageTitle() {
	return (
		<div className="flex w-full flex-col items-center text-center">
			<img
				className="w-16"
				src="/assets/images/logo/logo.svg"
				alt="logo"
			/>

			<Typography className="mt-4 text-3xl leading-tight font-bold tracking-tight">
				Autenticación
			</Typography>
			<Typography color="text.secondary" className="mt-1">
				Ingresa tu usuario y contraseña
			</Typography>
		</div>
	);
}

export default SignInPageTitle;
