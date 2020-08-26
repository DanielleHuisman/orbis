import {Orbis} from '@orbis-framework/core';

import {generateTypes as generateTypesLocal} from './Local';
import {generateTypes as generateTypesOAuth} from './OAuth';
import {generateTypes as generateTypesToken} from './Token';
import {generateTypes as generateTypesUser} from './User';

export const generateTypes = (orbis: Orbis) => {
    return {
        ...generateTypesLocal(orbis),
        ...generateTypesOAuth(orbis),
        ...generateTypesToken(orbis),
        ...generateTypesUser()
    };
};
