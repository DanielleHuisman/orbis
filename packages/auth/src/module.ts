import {Orbis, OrbisModule} from '@orbis-framework/core';

import {orbis} from './orbis';
import {BaseUser} from './entities';
import {ProviderResponse} from './providers';
import {generateTypes} from './types';

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

    getTypes(orbis: Orbis) {
        return generateTypes(orbis);
    }
}
