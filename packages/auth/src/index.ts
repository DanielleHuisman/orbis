import {OrbisModule} from '@orbis-framework/core';

import {orbis} from './orbis';

export interface OrbisAuthOptions {
    providers?: {
        local?: boolean;
        oauth?: string[];
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
}

export * from './config';
export * from './entities';
