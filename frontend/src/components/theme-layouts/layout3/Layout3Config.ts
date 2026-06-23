/**
 * The Layout3 Config object.
 */
const Layout3Config = {
	title: 'Layout 3 - Horizontal',
	defaults: {
		mode: 'container',
		containerWidth: 1120,
		scroll: 'content',
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

export type Layout3ConfigDefaultsType = (typeof Layout3Config)['defaults'];

export default Layout3Config;
