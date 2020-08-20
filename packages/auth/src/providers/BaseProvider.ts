import {Provider} from '../entities';

export type ProviderResponse = Pick<Provider, 'type' | 'identifier' | 'credentials' | 'email'> & {name: string};

export abstract class BaseProvider {

    abstract authorize(redirectUri: string): string;

    abstract async authenticate(redirectUri: string, code: string): Promise<ProviderResponse>;
}
