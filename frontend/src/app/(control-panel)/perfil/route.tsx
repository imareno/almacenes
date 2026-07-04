import { lazy } from 'react';
import { FuseRouteItemType } from '@fuse/utils/FuseUtils';

const PerfilPage = lazy(() => import('./PerfilPage'));

const route: FuseRouteItemType = {
	path: 'perfil',
	element: <PerfilPage />
};

export default route;
