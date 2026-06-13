import Box from '@mui/material/Box';

function AuthPagesMessageSection() {
	return (
		<Box
			className="relative hidden h-full min-h-screen flex-auto flex-col items-center justify-center overflow-hidden p-16 md:flex lg:px-28"
			sx={{
				backgroundImage: 'url(/assets/images/backgrounds/logInBakground.jpg)',
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				color: 'primary.contrastText'
			}}
		>
			{/* Overlay oscuro para que el texto sea legible */}
			<div className="absolute inset-0 bg-black/50" />

			<div className="relative z-10 w-full max-w-4xl text-center">
				<div className="text-7xl leading-none font-bold text-gray-100">
					<div>Bienvenido al</div>
					<div>Sistema de Almacenes y Materiales</div>
				</div>
			</div>

			<div className="absolute bottom-8 z-10 font-medium tracking-tight text-white">
				Copyright (c) MOPSV | UDTI
			</div>
		</Box>
	);
}

export default AuthPagesMessageSection;
