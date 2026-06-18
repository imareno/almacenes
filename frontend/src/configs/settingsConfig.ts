import themesConfig from 'src/configs/themesConfig';
import { FuseSettingsConfigType } from '@fuse/core/FuseSettings/FuseSettings';

import i18n from '@i18n/i18n';

/**
 * The settingsConfig object is a configuration object for the Fuse application's settings.
 */
const settingsConfig: FuseSettingsConfigType = {
	layout: {
		style: 'layout1', // layout1 layout2 layout3
		config: {
			navbar: {
				style: 'style-1'
			}
		}
	},

	customScrollbars: true,

	direction: i18n.dir(i18n.options.lng) || 'ltr',

	theme: {
<<<<<<< HEAD
		main: themesConfig.defaultDark,
		navbar: themesConfig.defaultNavbar,
		toolbar: themesConfig.default,
		footer: themesConfig.default
=======
		main: themesConfig.legacy,
		navbar: themesConfig.legacyDark,
		toolbar: themesConfig.legacy,
		footer: themesConfig.legacy
>>>>>>> 33ba602eb6c38e056e198fe65530d87bb7d51c8f
	},

	defaultAuth: ['admin', 'staff', 'user'],

	loginRedirectUrl: '/example'
};

export default settingsConfig;
