import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import _ from 'lodash';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
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

function JwtSignInForm() {
	const { signIn } = useJwtAuth();

	const { control, formState, handleSubmit, setError } = useForm<FormType>({
		mode: 'onChange',
		defaultValues,
		resolver: zodResolver(schema)
	});

	const { isValid, dirtyFields, errors } = formState;

	function onSubmit(formData: FormType) {
		signIn(formData).catch(async (error) => {
			const body = await error?.response?.json?.().catch(() => null);
			const message = body?.error || 'Credenciales inválidas';
			setError('username', { type: 'manual', message });
			setError('password', { type: 'manual', message: ' ' });
		});
	}

	return (
		<form
			name="loginForm"
			noValidate
			className="flex w-full flex-col justify-center"
			onSubmit={handleSubmit(onSubmit)}
		>
			<Controller
				name="username"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mb-6"
						label="Usuario"
						autoFocus
						autoComplete="username"
						error={!!errors.username}
						helperText={errors?.username?.message}
						variant="outlined"
						required
						fullWidth
					/>
				)}
			/>

			<Controller
				name="password"
				control={control}
				render={({ field }) => (
					<TextField
						{...field}
						className="mb-6"
						label="Contraseña"
						type="password"
						autoComplete="current-password"
						error={!!errors.password && errors.password.message !== ' '}
						helperText={errors?.password?.message !== ' ' ? errors?.password?.message : ''}
						variant="outlined"
						required
						fullWidth
					/>
				)}
			/>

			<Button
				variant="contained"
				color="secondary"
				className="mt-4 w-full"
				aria-label="Ingresar"
				disabled={_.isEmpty(dirtyFields) || !isValid}
				type="submit"
				size="large"
			>
				Ingresar
			</Button>
		</form>
	);
}

export default JwtSignInForm;
