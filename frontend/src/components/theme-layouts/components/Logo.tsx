import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import clsx from 'clsx';

const Root = styled('div')(({ theme }) => ({
	'& > .logo-icon': {
		transition: theme.transitions.create(['width', 'height'], {
			duration: theme.transitions.duration.shortest,
			easing: theme.transitions.easing.easeInOut
		})
	},
	'& > .badge': {
		transition: theme.transitions.create('opacity', {
			duration: theme.transitions.duration.shortest,
			easing: theme.transitions.easing.easeInOut
		})
	}
}));

type LogoProps = {
	className?: string;
};

/**
 * The logo component.
 */
function Logo(props: LogoProps) {
	const { className = '' } = props;
	return (
		<Root className={clsx('flex flex-shrink-0 flex-grow items-center gap-3', className)}>
			
			<div className="flex flex-1 items-center gap-2 my-4 md:my-6">
				<img
					className="logo-icon h-18 w-18"
					src="/assets/images/logo/logo.svg"
					alt="logo"
				/>
				<div className="logo-text flex flex-auto flex-col gap-0.5">
					<Typography className="tracking-light text-lg leading-none font-semibold">ALMACENES</Typography>
					<Typography
						className="tracking-light text-[12px] leading-none font-semibold"
						color="text.secondary"
					>
						MOPSV
					</Typography>
				</div>
			</div>
			
		</Root>
	);
}

export default Logo;
