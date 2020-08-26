import {extendType, stringArg} from '@nexus/schema';
import {Orbis} from '@orbis-framework/core';
import bcrypt from 'bcrypt';
import moment from 'moment';
import randomstring from 'randomstring';

import {DEFAULT_BCRYPT_ROUNDS} from '../config';
import {Provider, ProviderType, Token, TokenType} from '../entities';
import {OrbisAuth} from '../module';

export const generateToken = async (orbis: Orbis, provider: Provider, type: TokenType, hoursValid: number = 24): Promise<Token> => {
    // Delete old tokens for this provider of same type
    await orbis.deleteMany(Token, {
        where: {
            provider: {
                id: {
                    equals: provider.id
                }
            }
        }
    });

    // Generate token
    // TODO: improve handling of unique token violation
    let token = null;
    while (!token) {
        const generatedToken = randomstring.generate(32);

        const existingToken = await orbis.findOne(Token, {
            where: {
                token: generatedToken
            }
        });
        if (!existingToken) {
            token = await orbis.createOne(Token, {
                data: {
                    type,
                    token: generatedToken,
                    expiresAt: moment().add(hoursValid, 'hours').toDate(),
                    provider: {
                        connect: {
                            id: provider.id
                        }
                    }
                }
            });
        }
    }
    return token;
};

export const generateTypes = (orbis: Orbis) => {
    // TODO: handle email integration with @orbis-framework/email
    const sendEmail = (_args: unknown) => new Promise((resolve) => resolve());

    return {
        MutationAuthToken: extendType({
            type: 'Mutation',
            definition(t) {
                // Get options
                const options = orbis.getModule<OrbisAuth>('auth').getOptions();

                interface RequestArgs {
                    email: string;
                }

                t.boolean('requestVerifyEmail', {
                    args: {
                        email: stringArg({
                            nullable: false
                        })
                    },
                    resolve(_, args: RequestArgs) {
                        return orbis.transaction(async () => {
                            // Find provider
                            const provider = await orbis.findFirst(Provider, {
                                where: {
                                    type: {
                                        equals: ProviderType.LOCAL
                                    },
                                    identifier: {
                                        equals: args.email
                                    }
                                },
                                relations: ['user']
                            });

                            if (!provider) {
                                throw new Error('errors.requestVerifyEmail.email.notFound');
                            } else if (provider.isVerified) {
                                throw new Error('errors.requestVerifyEmail.email.alreadyVerified');
                            }

                            // Create email verification token (valid 3 days)
                            const token = await generateToken(orbis, provider, TokenType.VERIFY_EMAIL, 3 * 24);

                            // Send verification email
                            const user = await provider.user;
                            await sendEmail({
                                // template: `verify-email/${user.language}`,
                                template: `verify-email`,
                                message: {
                                    to: provider.email
                                },
                                locals: {
                                    user,
                                    // TODO: this URL should be fully customizable
                                    url: `${options.externalUrl}/verify/${token.token}`
                                }
                            });

                            return true;
                        });
                    }
                });

                t.boolean('requestResetPassword', {
                    args: {
                        email: stringArg({
                            nullable: false
                        })
                    },
                    resolve(_, args: RequestArgs) {
                        return orbis.transaction(async () => {
                            // Find provider
                            const provider = await orbis.findFirst(Provider, {
                                where: {
                                    type: {
                                        equals: ProviderType.LOCAL
                                    },
                                    identifier: {
                                        equals: args.email
                                    }
                                },
                                relations: ['user']
                            });

                            if (!provider) {
                                throw new Error('errors.requestResetPassword.email.notFound');
                            }

                            // Create password reset token (valid 24 hours)
                            const token = await generateToken(orbis, provider, TokenType.RESET_PASSWORD, 24);

                            // Send reset password email
                            const user = await provider.user;
                            await sendEmail({
                                // template: `reset-password/${user.language}`,
                                template: `reset-password`,
                                message: {
                                    to: provider.email
                                },
                                locals: {
                                    user,
                                    // TODO: this URL should be fully customizable
                                    url: `${options.externalUrl}/reset/${token.token}`
                                }
                            });

                            return true;
                        });
                    }
                });

                interface VerifyEmailArgs {
                    token: string;
                }

                t.boolean('verifyEmail', {
                    args: {
                        token: stringArg({
                            nullable: false
                        })
                    },
                    resolve(_, args: VerifyEmailArgs) {
                        return orbis.transaction(async () => {
                            // Find verification token
                            const verificationToken = await orbis.findFirst(Token, {
                                where: {
                                    type: {
                                        equals: TokenType.VERIFY_EMAIL
                                    },
                                    token: {
                                        equals: args.token
                                    }
                                },
                                relations: ['provider']
                            });

                            if (!verificationToken) {
                                throw new Error('errors.verifyEmail.token.invalid');
                            } else if (verificationToken.isExpired()) {
                                throw new Error('errors.verifyEmail.token.expired');
                            }

                            const provider = await verificationToken.provider;
                            if (!provider) {
                                throw new Error('errors.verifyEmail.provider.invalid');
                            }

                            // Verifiy the email address
                            await orbis.updateOne(Provider, {
                                where: {
                                    id: provider.id
                                },
                                data: {
                                    isVerified: true
                                }
                            });

                            // Delete verification token
                            await orbis.deleteOne(Token, {
                                where: {
                                    id: verificationToken.id
                                }
                            });

                            return true;
                        });
                    }
                });

                interface ResetPasswordArgs {
                    token: string;
                    password: string;
                    passwordRepeat: string;
                }

                t.boolean('resetPassword', {
                    args: {
                        token: stringArg({
                            nullable: false
                        }),
                        password: stringArg({
                            nullable: false
                        }),
                        passwordRepeat: stringArg({
                            nullable: false
                        })
                    },
                    resolve(_, args: ResetPasswordArgs) {
                        return orbis.transaction(async () => {
                            // Validate password
                            if (args.password !== args.passwordRepeat) {
                                throw new Error('errors.resetPassword.password.noMatch');
                            } else if (args.password.length < 8) {
                                throw new Error('errors.resetPassword.password.invalid');
                            }

                            // Find reset token
                            const resetToken = await orbis.findFirst(Token, {
                                where: {
                                    type: {
                                        equals: TokenType.RESET_PASSWORD
                                    },
                                    token: {
                                        equals: args.token
                                    }
                                },
                                relations: ['provider']
                            });

                            if (!resetToken) {
                                throw new Error('errors.resetPassword.token.invalid');
                            } else if (resetToken.isExpired()) {
                                throw new Error('errors.resetPassword.token.expired');
                            }

                            const provider = await resetToken.provider;
                            if (!provider) {
                                throw new Error('errors.resetPassword.provider.invalid');
                            }

                            // Update the password
                            await orbis.updateOne(Provider, {
                                where: {
                                    id: provider.id
                                },
                                data: {
                                    credentials: await bcrypt.hash(args.password, options.bcrypt?.rounds ?? DEFAULT_BCRYPT_ROUNDS)
                                }
                            });

                            // Delete reset token
                            await orbis.deleteOne(Token, {
                                where: {
                                    id: resetToken.id
                                }
                            });

                            return true;
                        });
                    }
                });
            }
        })
    };
};
