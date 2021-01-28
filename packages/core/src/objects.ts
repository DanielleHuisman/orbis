import pluralize from 'pluralize';
import {objectType} from 'nexus';
import {BaseEntity} from 'typeorm';

import {getOrbis, OrbisBaseOptions} from './orbis';
import {EntityQueryMetadata, EntityMutationMetadata, EntityCreateMetadata} from './metadata';
import {generateNexusOutputFields} from './fields';
import {isEntity, firstLower, Constructor, SchemaFunction} from './util';

export interface OrbisObjectOptions<ObjectType> extends OrbisBaseOptions {
    implements?: Constructor<unknown> | Constructor<unknown>[];
    schema?: SchemaFunction<Omit<ObjectType, keyof BaseEntity>>;
    query?: EntityQueryMetadata;
    mutation?: EntityMutationMetadata;
    create?: EntityCreateMetadata<Omit<ObjectType, keyof BaseEntity>>;
    scope?: (context: any) => any;
}

export const registerObjectType = <ObjectType>(target: Constructor<unknown>, options: OrbisObjectOptions<ObjectType> = {}) => {
    const orbis = getOrbis(options);

    // Generate object type
    const Type = objectType({
        name: target.name,
        definition(t) {
            if (options.implements) {
                if (Array.isArray(options.implements)) {
                    for (const i of options.implements) {
                        t.implements(i.name);
                    }
                } else {
                    t.implements(options.implements.name);
                }
            }

            generateNexusOutputFields(orbis, target, t);
        }
    });

    // Store type
    orbis.getMetadata().addType(Type);

    // Store object metadata
    orbis.getMetadata().addObject(target.name, {
        implements: options.implements ? Array.isArray(options.implements) ? options.implements : [options.implements] : [],
        schema: options.schema
    });

    // Check if the object is a TypeORM entity
    if (isEntity(target)) {
        // Generate entity names
        const singularName = firstLower(Type.name);
        const pluralName = pluralize(singularName);

        // Determine which fields are columns and which are relations
        const fields = orbis.getMetadata().hasFields(Type.name) ? Object.entries(orbis.getMetadata().getFields(Type.name)) : [];
        let columns = fields.filter(([_, field]) => !!field.column).map(([fieldName]) => fieldName);
        let relations = fields.filter(([_, field]) => !!field.relation).map(([fieldName]) => fieldName);

        // Merge columns and relations of interfaces with this entity
        if (options.implements) {
            if (Array.isArray(options.implements)) {
                for (const i of options.implements) {
                    if (orbis.getMetadata().hasEntity(i.name)) {
                        const e = orbis.getMetadata().getEntity(i.name);
                        columns = columns.concat(e.columns);
                        relations = relations.concat(e.relations);
                    }
                }
            } else {
                const i = options.implements;
                if (orbis.getMetadata().hasEntity(i.name)) {
                    const e = orbis.getMetadata().getEntity(i.name);
                    columns = columns.concat(e.columns);
                    relations = relations.concat(e.relations);
                }
            }
        }

        // Store entity metadata
        const entity = {
            Entity: target,
            singularName,
            pluralName,
            columns,
            relations,
            query: options.query,
            mutation: options.mutation,
            create: options.create,
            scope: options.scope
        };
        orbis.getMetadata().addEntity(target.name, entity);
    }

    return Type;
};

export const OrbisObject = <ObjectType>(options: OrbisObjectOptions<ObjectType> = {}): ClassDecorator => (target) => {
    registerObjectType(target, options);
};
