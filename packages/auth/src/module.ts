import {OrbisModule} from '@orbis-framework/core';

import {orbis} from './orbis';
import {BaseUser} from './entities';
import {ProviderResponse} from './providers';

export interface OrbisAuthOptions {
    providers?: {
        local?: boolean;
        oauth?: string[];
    };
    bcrypt?: {
        rounds?: number;
    };
    jwt: {
        secret: string;
        issuer: string;
        audience: string;
        expiresIn: number;
    };
    createUser: (response: ProviderResponse) => Promise<BaseUser>;
    externalUrl: string;
}

export class OrbisAuth extends OrbisModule<OrbisAuthOptions> {

    getName() {
        return 'auth';
    }

    getProvidedNames() {
        return [];
    }

    getOrbis() {
        return orbis;
    }
}
