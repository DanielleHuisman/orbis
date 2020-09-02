import {Orbis, OrbisModule} from '@orbis-framework/core';

import {orbis} from './orbis';
import {ProviderType} from './providers';
import {generateTypes} from './types';

export interface OrbisAuthOptions {
    providers: ProviderType[];
    bcrypt?: {
        rounds?: number;
    };
    jwt: {
        secret: string;
        issuer: string;
        audience: string;
        expiresIn: number;
    };
    urls: {
        prefix: (url: string) => string;
        verify?: (token: string) => string;
        reset?: (token: string) => string;
    };
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
