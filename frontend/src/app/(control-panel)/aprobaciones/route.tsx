import { lazy } from 'react';
import { FuseRouteItemType } from '@fuse/utils/FuseUtils';

const AprobacionesPage = lazy(() => import('./AprobacionesPage'));

const route: FuseRouteItemType = {
	path: 'aprobaciones',
	element: <AprobacionesPage />
};

export default route;
