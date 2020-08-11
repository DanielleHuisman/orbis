import {plugin} from '@nexus/schema';
import {NexusObjectTypeDef} from '@nexus/schema/dist/core';

import {getOrbis, OrbisBaseOptions} from './orbis';
import {EntityQueryMetadata, EntityMutationMetadata, EntityCreateMetadata} from './metadata';
import {generateYupSchemas} from './schema';
import {generateNexusInputObjects} from './inputObjects';
import {generateNexusQueries} from './queries';
import {generateNexusMutations} from './mutations';

export interface OrbisPluginOptions extends OrbisBaseOptions {
    query?: EntityQueryMetadata;
    mutation?: EntityMutationMetadata;
    create?: EntityCreateMetadata;
}

export const orbisPlugin = (options: OrbisPluginOptions = {}) => {
    const orbis = getOrbis(options);

    // Store options
    orbis.updateOptions({
        entity: {
            query: options.query,
            mutation: options.mutation,
            create: options.create
        }
    });

    // Generate Yup schemas
    generateYupSchemas(orbis);

    // Generate input objects, queries and mutations
    for (const [entityName, entity] of Object.entries(orbis.getMetadata().getEntities())) {
        const type = orbis.getMetadata().getType<NexusObjectTypeDef<string>>(entityName);

        generateNexusInputObjects(orbis, type, entity);
        generateNexusQueries(orbis, type, entity);
        generateNexusMutations(orbis, type, entity);
    }

    // Return Nexus plugin
    return plugin({
        name: 'orbis-plugin',
        onInstall: () => {
            return {
                types: Object.values(orbis.getMetadata().getTypes())
            };
        }
    });
};
