import { FuseRouteItemType } from '@fuse/utils/FuseUtils';
import authRoles from '@auth/authRoles';
import SignInPageView from './components/views/SignInPageView';
import SignUpPageView from './components/views/SignUpPageView';
import SignOutPageView from './components/views/SignOutPageView';

const authLayoutConfig = {
	layout: {
		config: {
			navbar: { display: false },
			toolbar: { display: false },
			footer: { display: false }
		}
	}
};

const route: FuseRouteItemType = {
	children: [
		{
			path: 'login',
			element: <SignInPageView />,
			settings: authLayoutConfig,
			auth: authRoles.onlyGuest
		},
		{
			path: 'sign-up',
			element: <SignUpPageView />,
			settings: authLayoutConfig,
			auth: authRoles.onlyGuest
		},
		{
			path: 'sign-out',
			element: <SignOutPageView />,
			settings: authLayoutConfig,
			auth: null
		}
	]
};

export default route;
