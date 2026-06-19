import themesConfig from 'src/configs/themesConfig';
import { FuseSettingsConfigType } from '@fuse/core/FuseSettings/FuseSettings';

import i18n from '@i18n/i18n';

const settingsConfig: FuseSettingsConfigType = {
	layout: {
		style: 'layout1',
		config: {
			navbar: {
				style: 'style-1'
			}
		}
	},

	customScrollbars: true,

	direction: i18n.dir(i18n.options.lng) || 'ltr',

	theme: {
		main: themesConfig.legacy,
		navbar: themesConfig.legacyDark,
		toolbar: themesConfig.legacy,
		footer: themesConfig.legacy
	},

	defaultAuth: ['admin', 'almacenero', 'solicitante', 'aprobador', 'readonly'],

	loginRedirectUrl: '/dashboard'
};

export default settingsConfig;
