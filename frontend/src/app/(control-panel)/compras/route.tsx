import { lazy } from 'react';
import { FuseRouteItemType } from '@fuse/utils/FuseUtils';

const ComprasPage = lazy(() => import('./ComprasPage'));

const route: FuseRouteItemType = {
	path: 'compras',
	element: <ComprasPage />
};

export default route;
