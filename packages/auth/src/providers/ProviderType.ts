import {NexusInputObjectTypeConfig} from '@nexus/schema/dist/definitions/inputObjectType';

import {Provider} from '../entities';

// TODO: consider moving createUser to provider to allow easy data typing for the authentication response

export abstract class ProviderType {

    private name: string;

    constructor(name: string) {
        this.name = name;
    }

    getName() {
        return this.name;
    }
}

export const PROVIDER_TYPE_LOCAL = 'local';

export interface ProviderLocalOptions {
    extendRegisterInput?: NexusInputObjectTypeConfig<string>['definition'];
}

export class ProviderLocal extends ProviderType {

    options: ProviderLocalOptions;

    constructor(options: ProviderLocalOptions = {}) {
        super(PROVIDER_TYPE_LOCAL);
        this.options = options;
    }
}

export abstract class ProviderTypeOAuth extends ProviderType {

    constructor(name: string) {
        super(name);

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

export type CreateUserArgs = AuthenticateResponse & {
    provider: Pick<Provider, 'type'>;
};
