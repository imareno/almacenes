/**
 * The Layout2 Config object.
 */
const Layout2Config = {
	title: 'Layout 2 - Horizontal',
	defaults: {
		mode: 'container',
		containerWidth: 1120,
		navbar: {
			display: true,
			style: 'fixed',
			folded: true
		},
		toolbar: {
			display: true,
			style: 'static',
			position: 'below'
		},
		footer: {
			display: false,
			style: 'fixed'
		}
	}
};

export type Layout2ConfigDefaultsType = (typeof Layout2Config)['defaults'];

export default Layout2Config;
