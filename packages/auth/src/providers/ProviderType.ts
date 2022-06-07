import {blocks} from 'nexus';

import {BaseUser, Provider} from '../entities';

export type AuthenticateResponse<Data = unknown> = {
    provider: Pick<Provider, 'identifier' | 'credentials' | 'email'>;
    data: Data;
};

export type CreateUserArgs<Data> = AuthenticateResponse<Data> & {
    provider: Pick<Provider, 'type'>;
};

export interface ProviderOptions<Data> {
    createUser: (args: CreateUserArgs<Data>) => Promise<BaseUser>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class ProviderType<Options extends ProviderOptions<any> = ProviderOptions<any>> {

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

export interface ProviderLocalOptions<Data> extends ProviderOptions<Data> {
    onEmailUpdated?: (provider: Provider) => Promise<void>;
    onPasswordUpdated?: (provider: Provider) => Promise<void>;
    onRegistered?: (user: BaseUser, provider: Provider) => Promise<void>;

    extendRegisterInput?: (t: blocks.InputDefinitionBlock<string>) => void;
}

export class ProviderLocal<Data = unknown> extends ProviderType<ProviderLocalOptions<Data>> {

    constructor(options: ProviderLocalOptions<Data>) {
        super(PROVIDER_TYPE_LOCAL, options);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class ProviderTypeOAuth<Options extends ProviderOptions<any>> extends ProviderType<Options> {

    constructor(name: string, options: Options) {
        super(name, options);

        if (this.getName() === PROVIDER_TYPE_LOCAL) {
            throw new Error(`Only the local provider type can have the name "${PROVIDER_TYPE_LOCAL}"`);
        }
    }

    abstract authorize(redirectUri: string): string;

    abstract authenticate(redirectUri: string, code: string): Promise<AuthenticateResponse>;
}
