import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import _ from 'lodash';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSnackbar } from 'notistack';
import useJwtAuth from '../useJwtAuth';

const schema = z.object({
	username: z.string().min(1, 'Ingresa tu usuario'),
	password: z.string().min(1, 'Ingresa tu contraseña')
});

type FormType = z.infer<typeof schema>;

const defaultValues: FormType = {
	username: '',
	password: ''
};

const autofillSx = {
	'& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus': {
		WebkitBoxShadow: '0 0 0 100px white inset',
		WebkitTextFillColor: 'inherit',
		caretColor: 'inherit',
		transition: 'background-color 5000s ease-in-out 0s'
	}
};

function JwtSignInForm() {
	const { signIn } = useJwtAuth();
	const { enqueueSnackbar } = useSnackbar();

	const { control, formState, handleSubmit } = useForm<FormType>({
		mode: 'onChange',
		defaultValues,
		resolver: zodResolver(schema)
	});

	const [showPassword, setShowPassword] = useState(false);
	const { isValid, dirtyFields } = formState;

	function onSubmit(formData: FormType) {
		signIn(formData).catch(async () => {
			enqueueSnackbar('Usuario o contraseña incorrectos. Por favor, intente nuevamente.', {
				variant: 'error',
				autoHideDuration: 5000
			});
		});
	}

	return (
		<form
			name="loginForm"
			noValidate
			className="flex w-full flex-col justify-center gap-5"
			onSubmit={handleSubmit(onSubmit)}
		>
			<Controller
				name="username"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						label="Usuario"
						autoFocus
						autoComplete="username"
						error={!!formState.errors.username}
						helperText={formState.errors.username?.message}
						variant="outlined"
						required
						fullWidth
						sx={autofillSx}
					/>
				)}
			/>

			<Controller
				name="password"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						label="Contraseña"
						type={showPassword ? 'text' : 'password'}
						autoComplete="current-password"
						error={!!formState.errors.password}
						helperText={formState.errors.password?.message}
						variant="outlined"
						required
						fullWidth
						sx={autofillSx}
						slotProps={{
							input: {
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											onClick={() => setShowPassword((prev) => !prev)}
											edge="end"
											size="small"
										>
											{showPassword ? <VisibilityOff /> : <Visibility />}
										</IconButton>
									</InputAdornment>
								)
							}
						}}
					/>
				)}
			/>

			<Button
				variant="contained"
				color="primary"
				className="mt-2 w-full"
				aria-label="Ingresar"
				disabled={_.isEmpty(dirtyFields) || !isValid}
				type="submit"
				size="large"
				sx={{
					py: 1.5,
					borderRadius: 2,
					fontWeight: 600,
					fontSize: '1rem',
					textTransform: 'none',
					boxShadow: 2
				}}
			>
				Ingresar
			</Button>
		</form>
	);
}

export default JwtSignInForm;
