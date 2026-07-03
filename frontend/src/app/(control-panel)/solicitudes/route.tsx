import { lazy } from 'react';
import { FuseRouteItemType } from '@fuse/utils/FuseUtils';

const SolicitudesPage = lazy(() => import('./SolicitudesPage'));

const route: FuseRouteItemType = {
	path: 'solicitudes',
	element: <SolicitudesPage />
};

export default route;
