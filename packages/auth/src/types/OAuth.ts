import {extendType, stringArg} from '@nexus/schema';
import {Orbis} from '@orbis-framework/core';

import {createAccessToken, AuthContext} from '../authentication';
import {getUserType} from '../config';
import {BaseUser, Provider} from '../entities';
import {OrbisAuth} from '../module';
import {ProviderTypeOAuth} from '../providers';

export const generateTypes = (orbis: Orbis) => ({
    MutationAuthOAuth: extendType({
        type: 'Mutation',
        definition(t) {
            // Get options
            const options = orbis.getModule<OrbisAuth>('auth').getOptions();

            // Find OAuth providers
            const providers = options.providers.filter((provider) => provider instanceof ProviderTypeOAuth);

            // Check if any OAuth provider are enabled
            if (providers.length === 0) {
                return;
            }

            interface OAuthAuthorizeArgs {
                type: string;
                redirectUri: string;
            }

            t.string('oauthAuthorize', {
                args: {
                    type: stringArg({
                        nullable: false
                    }),
                    redirectUri: stringArg({
                        nullable: false
                    })
                },
                async resolve(_, args: OAuthAuthorizeArgs) {
                    // Find provider
                    const providerType = providers.find((p) => p.getName() === args.type);
                    if (!providerType || !(providerType instanceof ProviderTypeOAuth)) {
                        throw new Error('errors.oauth.provider.invalid');
                    }

                    // Construct full redirect URI
                    const fullRedirectUri = options.urls.prefix(args.redirectUri);

                    // Generate authorization URL
                    return providerType.authorize(fullRedirectUri);
                }
            });

            interface OAuthAuthenticateArgs {
                type: string;
                redirectUri: string;
                code: string;
                userId?: string;
            }

            t.field('oauthAuthenticate', {
                type: 'AccessToken',
                args: {
                    type: stringArg({
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
                        // Find provider
                        const providerType = providers.find((p) => p.getName() === args.type);
                        if (!providerType || !(providerType instanceof ProviderTypeOAuth)) {
                            throw new Error('errors.oauth.provider.invalid');
                        }

                        // Construct full redirect URI
                        const fullRedirectUri = options.urls.prefix(args.redirectUri);

                        // Authenticate with provider
                        const response = await providerType.authenticate(fullRedirectUri, args.code);

                        // Attempt to find existing provider
                        const provider = await orbis.findFirst(Provider, {
                            where: {
                                type: {
                                    equals: providerType.getName()
                                },
                                identifier: {
                                    equals: response.provider.identifier
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
                                user = await options.createUser({
                                    ...response,
                                    provider: {
                                        ...response.provider,
                                        type: providerType.getName()
                                    }
                                });
                            }

                            // Create provider
                            await orbis.createOne(Provider, {
                                data: {
                                    type: providerType.getName(),
                                    ...response.provider,
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
                type: string;
            }

            t.field('oauthUnlink', {
                type: 'Provider',
                args: {
                    type: stringArg({
                        nullable: false
                    })
                },
                resolve(_, args: OAuthUnlinkArgs, context: AuthContext) {
                    return orbis.transaction(async () => {
                        if (!context.user) {
                            throw new Error('errors.unauthenticated');
                        }

                        // Find provider
                        const providerType = providers.find((p) => p.getName() === args.type);
                        if (!providerType) {
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
    })
});
