import { lazy } from 'react';
import { FuseRouteItemType } from '@fuse/utils/FuseUtils';

const DashboardPage = lazy(() => import('./DashboardPage'));

const route: FuseRouteItemType = {
	path: 'dashboard',
	element: <DashboardPage />
};

export default route;
