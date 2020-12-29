import {plugin} from 'nexus';
import {NexusObjectTypeDef} from 'nexus/dist/core';

import {getOrbis, OrbisBaseOptions} from './orbis';
import {EntityQueryMetadata, EntityMutationMetadata, EntityCreateMetadata} from './metadata';
import {generateYupSchemas} from './schema';
import {generateNexusInputObjects} from './inputObjects';
import {generateNexusQueries} from './queries';
import {generateNexusMutations} from './mutations';
import {registerOrbisTypes} from './types';

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

    // Register types included with Orbis
    registerOrbisTypes(orbis);

    // Generate Yup schemas
    generateYupSchemas(orbis);

    // Generate input objects, queries and mutations
    for (const [entityName, entity] of Object.entries(orbis.getMetadata().getEntities())) {
        const type = orbis.getMetadata().getType<NexusObjectTypeDef<string>>(entityName);

        generateNexusInputObjects(orbis, type, entity);
        generateNexusQueries(orbis, type, entity);
        generateNexusMutations(orbis, type, entity);
    }

    // Merge types
    const types = orbis.getModules().reduce(
        (prev, module) => prev.concat(
            Object.values(module.getTypes(orbis))
        ),
        Object.values(orbis.getMetadata().getTypes())
    );

    // Return Nexus plugin
    return plugin({
        name: 'orbis-plugin',
        onInstall: (builder) => {
            for (const type of types) {
                if (builder.hasType(type.name)) {
                    throw new Error(`Type "${type.name}" already exists.`);
                }

                builder.addType(type);
            }
        }
    });
};
