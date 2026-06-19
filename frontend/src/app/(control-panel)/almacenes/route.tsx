import { lazy } from 'react';
import { FuseRouteItemType } from '@fuse/utils/FuseUtils';

const AlmacenesPage = lazy(() => import('./AlmacenesPage'));

const route: FuseRouteItemType = {
	path: 'almacenes',
	element: <AlmacenesPage />
};

export default route;
