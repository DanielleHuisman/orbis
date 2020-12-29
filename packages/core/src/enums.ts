import {enumType} from 'nexus';

import {getOrbis, OrbisBaseOptions} from './orbis';
import {Enum} from './util';

export interface OrbisEnumOptions extends OrbisBaseOptions {
    name: string;
    members: Enum;
}

export const registerEnumType = (options: OrbisEnumOptions) => {
    const orbis = getOrbis(options);

    // Generate enum type
    const Type = enumType({
        name: options.name,
        members: options.members
    });

    // Store type
    orbis.getMetadata().addType(Type);

    return Type;
};
