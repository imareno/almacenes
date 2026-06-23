const Layout1Config = {
	title: 'Layout 1 - Vertical',
	defaults: {
		mode: 'fullwidth',
		containerWidth: 1120,
		navbar: {
			display: true,
			style: 'style-1',
			folded: false,
			position: 'left',
			open: true
		},
		toolbar: {
			display: true,
			style: 'fixed'
		},
		footer: {
			display: false,
			style: 'fixed'
		}
	}
};

export type Layout1ConfigDefaultsType = (typeof Layout1Config)['defaults'];

export default Layout1Config;
