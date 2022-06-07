import {core as nexus, interfaceType} from 'nexus';
import {BaseEntity} from 'typeorm';
import pluralize from 'pluralize';

import {getOrbis, OrbisBaseOptions} from './orbis';
import {generateNexusOutputFields} from './fields';
import {EntityQueryMetadata, EntityMutationMetadata, EntityCreateMetadata} from './metadata';
import {isEntity, firstLower, Constructor, SchemaFunction} from './util';


export interface OrbisInterfaceOptions<InterfaceType> extends OrbisBaseOptions {
    schema?: SchemaFunction<Omit<InterfaceType, keyof BaseEntity>>;
    resolveType?: nexus.AbstractTypeResolver<string>;
    query?: EntityQueryMetadata;
    mutation?: EntityMutationMetadata;
    create?: EntityCreateMetadata<Omit<InterfaceType, keyof BaseEntity>>;
    scope?: (context: any) => any;
}

export const registerInterfaceType = <InterfaceType>(target: Constructor<unknown>, options: OrbisInterfaceOptions<InterfaceType> = {}) => {
    const orbis = getOrbis(options);

    // Generate interface type
    const Type = interfaceType({
        name: target.name,
        definition(t) {
            generateNexusOutputFields(orbis, target, t);
        },
        resolveType: options.resolveType ? options.resolveType : (root) => Object.getPrototypeOf(root).constructor.name
    });

    // Store type
    orbis.getMetadata().addType(Type);

    // Store interface metadata
    orbis.getMetadata().addInterface(Type.name, options);

    // Check if the object is a TypeORM entity
    if (isEntity(target)) {
        // Generate entity names
        const singularName = firstLower(Type.name);
        const pluralName = pluralize(singularName);

        // Store entity metadata
        const entity = {
            Entity: target,
            singularName,
            pluralName,
            columns: Object.entries(orbis.getMetadata().getFields(Type.name)).filter(([_, field]) => !!field.column).map(([fieldName]) => fieldName),
            relations: Object.entries(orbis.getMetadata().getFields(Type.name)).filter(([_, field]) => !!field.relation).map(([fieldName]) => fieldName),
            query: options.query,
            mutation: options.mutation,
            create: options.create,
            scope: options.scope
        };
        orbis.getMetadata().addEntity(target.name, entity);
    }

    return Type;
};

export const OrbisInterface = <InterfaceType>(options: OrbisInterfaceOptions<InterfaceType> = {}): ClassDecorator => (target) => {
    registerInterfaceType(target, options);
};
