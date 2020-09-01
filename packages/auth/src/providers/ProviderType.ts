import {Provider} from '../entities';

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

export class ProviderTypeLocal extends ProviderType {

    constructor() {
        super(PROVIDER_TYPE_LOCAL);
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
