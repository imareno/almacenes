import { lazy } from 'react';
import { FuseRouteItemType } from '@fuse/utils/FuseUtils';

const DespachosPage = lazy(() => import('./DespachosPage'));

const route: FuseRouteItemType = {
	path: 'despachos',
	element: <DespachosPage />
};

export default route;
