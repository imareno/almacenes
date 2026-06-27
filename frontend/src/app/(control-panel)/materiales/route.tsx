import { lazy } from 'react';
import { FuseRouteItemType } from '@fuse/utils/FuseUtils';

const MaterialesPage = lazy(() => import('./MaterialesPage'));

const route: FuseRouteItemType = {
	path: 'materiales',
	element: <MaterialesPage />
};

export default route;
