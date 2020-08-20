import {extendType, arg, stringArg} from '@nexus/schema';

import {createAccessToken, AuthContext} from '../authentication';
import {getUserType} from '../config';
import {BaseUser, Provider, ProviderType} from '../entities';
import {OrbisAuth} from '../module';
import {orbis} from '../orbis';
import {providers} from '../providers';

export const MutationAuthOAuth = extendType({
    type: 'Mutation',
    definition(t) {
        // Get options
        const options = orbis.getModule<OrbisAuth>('auth').getOptions();

        // Check if any OAuth provider are enabled
        if ((options.providers?.oauth ?? []).length === 0) {
            return;
        }

        const constructRedirectUri = (redirectUri: string) => redirectUri.startsWith('/') ? `${options.externalUrl}${redirectUri}` : redirectUri;

        interface OAuthAuthorizeArgs {
            type: ProviderType;
            redirectUri: string;
        }

        t.string('oauthAuthorize', {
            args: {
                type: arg({
                    type: 'ProviderType',
                    nullable: false
                }),
                redirectUri: stringArg({
                    nullable: false
                })
            },
            async resolve(_, args: OAuthAuthorizeArgs) {
                if (!providers[args.type]) {
                    throw new Error('errors.oauth.provider.invalid');
                }

                // Construct full redirect URI
                const fullRedirectUri = constructRedirectUri(args.redirectUri);

                // Generate authorization URL
                return providers[args.type].authorize(fullRedirectUri);
            }
        });

        interface OAuthAuthenticateArgs {
            type: ProviderType;
            redirectUri: string;
            code: string;
            userId?: string;
        }

        t.field('oauthAuthenticate', {
            type: 'AccessToken',
            args: {
                type: arg({
                    type: 'ProviderType',
                    nullable: false
                }),
                redirectUri: stringArg({
                    nullable: false
                }),
                code: stringArg({
                    nullable: false
                }),
                userId: stringArg({
                    nullable: true
                })
            },
            resolve(_, args: OAuthAuthenticateArgs) {
                return orbis.transaction(async () => {
                    if (!providers[args.type]) {
                        throw new Error('errors.oauth.provider.invalid');
                    }

                    // Construct full redirect URI
                    const fullRedirectUri = constructRedirectUri(args.redirectUri);

                    // Authenticate with provider
                    const response = await providers[args.type].authenticate(fullRedirectUri, args.code);

                    // Attempt to find existing provider
                    const provider = await orbis.findFirst(Provider, {
                        where: {
                            type: {
                                equals: response.type
                            },
                            identifier: {
                                equals: response.identifier
                            }
                        },
                        relations: ['user']
                    });

                    let user: BaseUser;
                    if (!provider) {
                        if (args.userId) {
                            // Find user
                            user = await orbis.findOne(getUserType(), {
                                where: {
                                    id: args.userId
                                }
                            }, {
                                notFoundError: true
                            });
                        } else {
                            // Create user
                            user = await options.createUser(response);
                        }

                        // Create provider
                        await orbis.createOne(Provider, {
                            data: {
                                type: response.type,
                                identifier: response.identifier,
                                credentials: response.credentials,
                                email: response.email,
                                isVerified: true,
                                user: {
                                    connect: {
                                        id: user.id
                                    }
                                }
                            }
                        });
                    } else {
                        if (args.userId) {
                            throw new Error('errors.oauth.alreadyLinked');
                        }

                        user = await provider.user;
                    }

                    // Generate access token for user
                    const token = createAccessToken(orbis, user);

                    return token;
                });
            }
        });

        interface OAuthUnlinkArgs {
            type: ProviderType;
        }

        t.field('oauthUnlink', {
            type: 'Provider',
            args: {
                type: arg({
                    type: 'ProviderType',
                    nullable: false
                })
            },
            resolve(_, args: OAuthUnlinkArgs, context: AuthContext) {
                return orbis.transaction(async () => {
                    if (!context.user) {
                        throw new Error('errors.unauthenticated');
                    }

                    if (!providers[args.type]) {
                        throw new Error('errors.oauth.provider.invalid');
                    }

                    // Find the user and their providers
                    const user = await orbis.findOne(getUserType(), {
                        where: {
                            id: context.user.id
                        },
                        relations: ['providers']
                    }, {
                        notFoundError: true
                    });

                    // Find the provider
                    const provider = (await user.providers).find((p) => p.type === args.type);
                    if (!provider) {
                        throw new Error('errors.oauth.provider.invalid');
                    }

                    // Check if there are other providers left
                    const otherProviders = (await user.providers).filter((p) => p.type !== args.type);
                    if (otherProviders.length === 0) {
                        throw new Error('errors.oauthUnlink.noOtherProviders');
                    }

                    // Delete the provider
                    return await orbis.deleteOne(Provider, {
                        where: {
                            id: provider.id
                        }
                    });
                });
            }
        });
    }
});
