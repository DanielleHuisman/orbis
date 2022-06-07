import {core as nexus, scalarType} from 'nexus';

import {getOrbis, OrbisBaseOptions} from './orbis';

export interface OrbisScalarOptions extends OrbisBaseOptions, nexus.ScalarBase {
    name: string;
}

export const registerScalarType = (options: OrbisScalarOptions) => {
    const orbis = getOrbis(options);

    // Generate scalar type
    const Type = scalarType(options);

    // Store type
    orbis.getMetadata().addType(Type);

    return Type;
};
