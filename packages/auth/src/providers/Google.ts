import {google, oauth2_v2 as OAuthV2} from 'googleapis';
import {OAuth2Client, OAuth2ClientOptions} from 'google-auth-library';

import {ProviderOptions, ProviderTypeOAuth, AuthenticateResponse} from './ProviderType';

export type ProviderGoogleOptions = ProviderOptions & OAuth2ClientOptions;

export class ProviderGoogle extends ProviderTypeOAuth<ProviderGoogleOptions> {

    auth: OAuth2Client;
    oauth: OAuthV2.Oauth2;

    constructor(options: ProviderGoogleOptions) {
        super('google', options);

        this.auth = new google.auth.OAuth2(options);
        this.oauth = google.oauth2({
            auth: this.auth,
            version: 'v2'
        });
    }

    authorize(redirectUri: string): string {
        return this.auth.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'openid',
                'profile',
                'email'
            ],
            redirect_uri: redirectUri
        });
    }

    async authenticate(redirectUri: string, code: string): Promise<AuthenticateResponse> {
        // Fetch access token
        const {tokens} = await this.auth.getToken({
            redirect_uri: redirectUri,
            code
        });

        // Fetch user info
        this.auth.setCredentials(tokens);
        const user = await this.oauth.userinfo.get();

        if (!user.data.id || !user.data.email) {
            throw new Error('errors.oauth.google.missingData');
        }

        // TODO: handle a null refresh token (happens if after first authentication with the Google OAuth application)

        // Create provider
        return {
            provider: {
                identifier: user.data.id,
                credentials: tokens.refresh_token as string,
                email: user.data.email
            },
            data: user.data
        };
    }
}
