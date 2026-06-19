import React from 'react';

import JwtAuthProvider from '@auth/services/jwt/JwtAuthProvider';
import { FuseAuthProviderType } from '@fuse/core/FuseAuthProvider/types/FuseAuthTypes';
import FuseAuthProvider from '@fuse/core/FuseAuthProvider';
import FuseAuthorization from '@fuse/core/FuseAuthorization';
import { User } from '@auth/user';
import settingsConfig from '@/configs/settingsConfig';

const authProviders: FuseAuthProviderType[] = [
	{
		name: 'jwt',
		Provider: JwtAuthProvider
	}
];

type AuthenticationProps = {
	children: React.ReactNode;
};

function Authentication(props: AuthenticationProps) {
	const { children } = props;

	return (
		<FuseAuthProvider providers={authProviders}>
			{(authState) => {
				const userRole = authState?.user?.role as User['role'];
				return (
					<FuseAuthorization
						userRole={userRole}
						loginRedirectUrl={settingsConfig.loginRedirectUrl}
					>
						{children}
					</FuseAuthorization>
				);
			}}
		</FuseAuthProvider>
	);
}

export default Authentication;
