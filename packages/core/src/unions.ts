import {unionType} from '@nexus/schema';

import {getOrbis, OrbisBaseOptions} from './orbis';

export interface OrbisUnionOptions extends OrbisBaseOptions {
    name: string;
    members: string[];
}

export const registerUnionType = (options: OrbisUnionOptions) => {
    const orbis = getOrbis(options);

    // Generate union type
    const Type = unionType({
        name: options.name,
        definition(t) {
            t.resolveType((type) => type.__typename);

            t.members(...options.members);
        }
    });

    // Store type
    orbis.getMetadata().addType(Type);

    return Type;
};
