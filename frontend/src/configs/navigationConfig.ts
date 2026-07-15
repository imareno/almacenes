import i18n from '@i18n';
import { FuseNavItemType } from '@fuse/core/FuseNavigation/types/FuseNavItemType';
import ar from './navigation-i18n/ar';
import en from './navigation-i18n/en';
import tr from './navigation-i18n/tr';

i18n.addResourceBundle('en', 'navigation', en);
i18n.addResourceBundle('tr', 'navigation', tr);
i18n.addResourceBundle('ar', 'navigation', ar);

/**
 * The navigationConfig object is an array of navigation items for the Fuse application.
 */
const navigationConfig: FuseNavItemType[] = [
	{
		id: 'dashboard',
		title: 'Dashboard',
		type: 'item',
		icon: 'lucide:layout-dashboard',
		url: '/dashboard'
	},
	{
		id: 'gestion',
		title: 'Gestión',
		type: 'group',
		children: [
			{
				id: 'almacenes',
				title: 'Almacenes',
				type: 'item',
				icon: 'lucide:warehouse',
				url: '/almacenes',
				auth: ['admin']
			},
			{
				id: 'materiales',
				title: 'Materiales',
				type: 'item',
				icon: 'lucide:package',
				url: '/materiales',
				auth: ['admin', 'almacenero']
			},
			{
				id: 'compras',
				title: 'Compras',
				type: 'item',
				icon: 'lucide:shopping-cart',
				url: '/compras',
				auth: ['admin', 'almacenero']
			},
			{
				id: 'solicitudes',
				title: 'Solicitudes',
				type: 'item',
				icon: 'lucide:clipboard-list',
				url: '/solicitudes'
			},
			{
				id: 'despachos',
				title: 'Despachos',
				type: 'item',
				icon: 'lucide:truck',
				url: '/despachos',
				auth: ['admin', 'almacenero']
			}
		]
	},
	{
		id: 'reportes',
		title: 'Reportes',
		type: 'group',
		auth: ['admin', 'almacenero'],
		children: [
			{
				id: 'reporte-existencias',
				title: 'Existencias',
				type: 'item',
				icon: 'lucide:boxes',
				url: '/reportes/existencias'
			},
			{
				id: 'reporte-kardex',
				title: 'Kárdex',
				type: 'item',
				icon: 'lucide:scroll-text',
				url: '/reportes/kardex'
			},
			{
				id: 'reporte-valorizado',
				title: 'Valorizado',
				type: 'item',
				icon: 'lucide:trending-up',
				url: '/reportes/valorizado'
			},
			{
				id: 'reporte-compras',
				title: 'Compras',
				type: 'item',
				icon: 'lucide:receipt',
				url: '/reportes/compras'
			}
		]
	}
];

export default navigationConfig;
