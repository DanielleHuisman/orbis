import {inputObjectType, extendType, arg, stringArg, nonNull, nullable} from 'nexus';
import {Orbis} from '@orbis-framework/core';
import bcrypt from 'bcrypt';

import {createAccessToken, AuthContext} from '../authentication';
import {DEFAULT_BCRYPT_ROUNDS} from '../config';
import {Provider, TokenType} from '../entities';
import {OrbisAuth} from '../module';
import {PROVIDER_TYPE_LOCAL, ProviderLocal} from '../providers';
import {sendEmail} from '../util';

import {generateToken} from './Token';

export const generateTypes = (orbis: Orbis) => {
    const RegisterInput = inputObjectType({
        name: 'RegisterInput',
        definition(t) {
            t.nonNull.string('email');
            t.nonNull.string('password');
            t.nonNull.string('passwordRepeat');

            // Get options
            const options = orbis.getModule<OrbisAuth>('auth').getOptions();

            // Find local provider
            const provider = options.providers.find((provider) => provider instanceof ProviderLocal);
            if (!provider || !(provider instanceof ProviderLocal)) {
                return;
            }

            // Extend the input object type
            const providerOptions = provider.getOptions();
            if (providerOptions.extendRegisterInput) {
                providerOptions.extendRegisterInput(t);
            }
        }
    });

    return {
        RegisterInput,

        MutationAuthLocal: extendType({
            type: 'Mutation',
            definition(t) {
                // Get options
                const options = orbis.getModule<OrbisAuth>('auth').getOptions();

                // Find local provider
                const providerType = options.providers.find((provider) => provider instanceof ProviderLocal);
                if (!providerType || !(providerType instanceof ProviderLocal)) {
                    return;
                }

                // Find local provider options
                const providerOptions = providerType.getOptions();

                interface RegisterArgs {
                    data: {
                        email: string;
                        password: string;
                        passwordRepeat: string;
                    };
                }

                t.boolean('register', {
                    args: {
                        data: nullable(arg({
                            type: RegisterInput
                        }))
                    },
                    resolve(_, {data}: RegisterArgs) {
                        return orbis.transaction(async () => {
                            // Check if the passwords match
                            if (data.password !== data.passwordRepeat) {
                                throw new Error('error.register.password.noMatch');
                            } else if (data.password.length < 8) {
                                throw new Error('errors.register.password.invalid');
                            }

                            // Check if the email already exists
                            const existingProvider = await orbis.findFirst(Provider, {
                                where: {
                                    type: {
                                        equals: 'local'
                                    },
                                    identifier: {
                                        equals: data.email.trim()
                                    }
                                }
                            });
                            if (existingProvider) {
                                throw new Error('error.register.email.exists');
                            }

                            // Calculate password hash
                            const identifier = data.email.trim();
                            const credentials = await bcrypt.hash(data.password, options.bcrypt?.rounds ?? DEFAULT_BCRYPT_ROUNDS);

                            // Create user
                            const user = await providerType.getOptions().createUser({
                                provider: {
                                    type: PROVIDER_TYPE_LOCAL,
                                    identifier,
                                    credentials,
                                    email: identifier
                                },
                                data
                            });

                            // Create provider
                            const provider = await orbis.createOne(Provider, {
                                data: {
                                    type: PROVIDER_TYPE_LOCAL,
                                    identifier,
                                    credentials,
                                    email: identifier,
                                    user: {
                                        connect: {
                                            id: user.id
                                        }
                                    }
                                }
                            });

                            // Create email verification token
                            const token = await generateToken(orbis, provider, TokenType.VERIFY_EMAIL);

                            // Send verification email
                            await sendEmail(orbis, {
                                template: `verify-email`,
                                message: {
                                    to: provider.email
                                },
                                locals: {
                                    user,
                                    url: options.urls.prefix(options.urls.verify ? options.urls.verify(token.token) : `/verify/${token.token}`)
                                }
                            });

                            // Handle register hook
                            if (providerOptions.onRegistered) {
                                await providerOptions.onRegistered(user, provider);
                            }

                            return true;
                        });
                    }
                });

                interface LoginArgs {
                    email: string;
                    password: string;
                }

                t.field('login', {
                    type: 'AccessToken',
                    args: {
                        email: nonNull(stringArg()),
                        password: nonNull(stringArg())
                    },
                    resolve(_, args: LoginArgs) {
                        return orbis.transaction(async () => {
                            // Find provider
                            const provider = await orbis.findFirst(Provider, {
                                where: {
                                    type: {
                                        equals: PROVIDER_TYPE_LOCAL
                                    },
                                    identifier: {
                                        equals: args.email
                                    }
                                },
                                relations: ['user']
                            });

                            if (!provider) {
                                throw new Error('errors.login.email.invalid');
                            }

                            // Verify password
                            if (!await bcrypt.compare(args.password, provider.credentials)) {
                                throw new Error('errors.login.password.invalid');
                            }

                            // Check if email is verified
                            if (!provider.isVerified) {
                                throw new Error(`errors.login.email.unverified`);
                            }

                            // Generate access token for user
                            return createAccessToken(orbis, await provider.user);
                        });
                    }
                });

                interface ChangeEmailArgs {
                    email: string;
                }

                t.boolean('changeEmail', {
                    args: {
                        email: nonNull(stringArg())
                    },
                    resolve(_, args: ChangeEmailArgs, context: AuthContext) {
                        return orbis.transaction(async () => {
                            if (!context.user) {
                                throw new Error('errors.unauthenticated');
                            }

                            // Find the local provider
                            let provider = await orbis.findFirst(Provider, {
                                where: {
                                    user: {
                                        id: {
                                            equals: context.user.id
                                        }
                                    },
                                    type: {
                                        equals: PROVIDER_TYPE_LOCAL
                                    }
                                }
                                // TODO: this might be necessary
                                // relations: ['user']
                            });

                            if (!provider) {
                                throw new Error('errors.changeEmail.noLocalProvider');
                            }

                            // Update the email address
                            provider = await orbis.updateOne(Provider, {
                                where: {
                                    id: provider.id
                                },
                                data: {
                                    identifier: args.email.trim(),
                                    email: args.email.trim(),
                                    isVerified: false
                                }
                            });

                            // Create email verification token
                            const token = await generateToken(orbis, provider, TokenType.VERIFY_EMAIL);

                            // Send verification email
                            const user = await provider.user;
                            await sendEmail(orbis, {
                                template: `verify-email`,
                                message: {
                                    to: provider.email
                                },
                                locals: {
                                    user,
                                    url: options.urls.prefix(options.urls.verify ? options.urls.verify(token.token) : `/verify/${token.token}`)
                                }
                            });

                            // Handle update hook
                            if (providerOptions.onEmailUpdated) {
                                await providerOptions.onEmailUpdated(provider);
                            }

                            return true;
                        });
                    }
                });

                interface ChangePasswordArgs {
                    password: string;
                    passwordRepeat: string;
                }

                t.boolean('changePassword', {
                    args: {
                        password: nonNull(stringArg()),
                        passwordRepeat: nonNull(stringArg())
                    },
                    resolve(_, args: ChangePasswordArgs, context: AuthContext) {
                        return orbis.transaction(async () => {
                            if (!context.user) {
                                throw new Error('errors.unauthenticated');
                            }

                            // Validate password
                            if (args.password !== args.passwordRepeat) {
                                throw new Error('errors.changePassword.password.noMatch');
                            } else if (args.password.length < 8) {
                                throw new Error('errors.changePassword.password.invalid');
                            }

                            // Find the local provider
                            let provider = await orbis.findFirst(Provider, {
                                where: {
                                    user: {
                                        id: {
                                            equals: context.user.id
                                        }
                                    },
                                    type: {
                                        equals: PROVIDER_TYPE_LOCAL
                                    }
                                }
                                // TODO: this might be necessary
                                // relations: ['user']
                            });

                            if (!provider) {
                                throw new Error('errors.changePassword.noLocalProvider');
                            }

                            // Update the password
                            provider = await orbis.updateOne(Provider, {
                                where: {
                                    id: provider.id
                                },
                                data: {
                                    credentials: await bcrypt.hash(args.password, options.bcrypt?.rounds ?? DEFAULT_BCRYPT_ROUNDS)
                                }
                            });

                            // Handle update hook
                            if (providerOptions.onPasswordUpdated) {
                                await providerOptions.onPasswordUpdated(provider);
                            }

                            return true;
                        });
                    }
                });
            }
        })
    };
};
