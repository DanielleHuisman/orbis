import {NexusInputObjectTypeConfig} from '@nexus/schema/dist/definitions/inputObjectType';

import {BaseUser, Provider} from '../entities';

export type CreateUserArgs = AuthenticateResponse & {
    provider: Pick<Provider, 'type'>;
};

export interface ProviderOptions {
    createUser: (args: CreateUserArgs) => Promise<BaseUser>;
}

export abstract class ProviderType<Options extends ProviderOptions = ProviderOptions> {

    private name: string;
    private options: Options;

    constructor(name: string, options: Options) {
        this.name = name;
        this.options = options;
    }

    getName() {
        return this.name;
    }

    getOptions() {
        return this.options;
    }
}

export const PROVIDER_TYPE_LOCAL = 'local';

export interface ProviderLocalOptions extends ProviderOptions {
    onEmailUpdated?: (provider: Provider) => Promise<void>;
    onPasswordUpdated?: (provider: Provider) => Promise<void>;

    extendRegisterInput?: NexusInputObjectTypeConfig<string>['definition'];
}

export class ProviderLocal extends ProviderType<ProviderLocalOptions> {

    constructor(options: ProviderLocalOptions) {
        super(PROVIDER_TYPE_LOCAL, options);
    }
}

export abstract class ProviderTypeOAuth<Options extends ProviderOptions = ProviderOptions> extends ProviderType<Options> {

    constructor(name: string, options: Options) {
        super(name, options);

        if (this.getName() === PROVIDER_TYPE_LOCAL) {
            throw new Error(`Only the local provider type can have the name "${PROVIDER_TYPE_LOCAL}"`);
        }
    }

    abstract authorize(redirectUri: string): string;

    abstract async authenticate(redirectUri: string, code: string): Promise<AuthenticateResponse>;
}

export type AuthenticateResponse<Data = unknown> = {
    provider: Pick<Provider, 'identifier' | 'credentials' | 'email'>;
    data: Data;
};


