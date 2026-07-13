import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import useUser from '@auth/useUser';
import { getMisAprobaciones } from '@/api/solicitudes';
import { useNavigationContext } from '@/components/theme-layouts/components/navigation/contexts/useNavigationContext';

const APROBACIONES_ITEM = {
	id: 'aprobaciones',
	title: 'Aprobaciones',
	type: 'item',
	icon: 'lucide:clipboard-check',
	url: '/aprobaciones'
};

/**
 * Muestra el ítem de navegación "Aprobaciones" solo cuando el usuario
 * autenticado tiene solicitudes asignadas para aprobar (por CI en el JWT).
 */
function AprobacionesNavGuard() {
	const { data: user } = useUser();
	const isAuthenticated = Boolean(user?.role);
	const { navigationItems, appendNavigationItem, removeNavigationItem } = useNavigationContext();

	const { data: pendientes } = useQuery({
		queryKey: ['mis-aprobaciones-count', 'enviado'],
		queryFn: () => getMisAprobaciones({ estado: 'enviado', pageSize: 1 }),
		enabled: isAuthenticated
	});

	const { data: aprobadas } = useQuery({
		queryKey: ['mis-aprobaciones-count', 'aprobado'],
		queryFn: () => getMisAprobaciones({ estado: 'aprobado', pageSize: 1 }),
		enabled: isAuthenticated
	});

	const hasAprobaciones = (pendientes?.total ?? 0) + (aprobadas?.total ?? 0) > 0;

	useEffect(() => {
		const exists = navigationItems.some((item) => item.id === 'aprobaciones');

		if (isAuthenticated && hasAprobaciones && !exists) {
			appendNavigationItem(APROBACIONES_ITEM, 'gestion');
		} else if ((!isAuthenticated || !hasAprobaciones) && exists) {
			removeNavigationItem('aprobaciones');
		}
	}, [isAuthenticated, hasAprobaciones, navigationItems, appendNavigationItem, removeNavigationItem]);

	return null;
}

export default AprobacionesNavGuard;
