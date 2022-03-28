import {ObjectLiteral} from 'typeorm';
import {RelationMetadata} from 'typeorm/metadata/RelationMetadata';

import {DataArgument, UniqueWhereArgument} from '../arguments';
import {Orbis} from '../orbis';
import {EntityMetadata, EntityCreateMetadata} from '../metadata';
import {findOne} from '../queries/findOne';
import {OperationOptions} from '../util';

import {updateRelation} from './relations';

export interface CreateOneArguments {
    data: DataArgument;
    relations?: string[];
}

interface ToManyRelation {
    fieldName: string;
    fieldValue: DataArgument[];
    relationMetadata: RelationMetadata;
}

const mergeCreateMetadata = (values: ObjectLiteral, create: EntityCreateMetadata) => {
    if (create) {
        for (const [fieldName, fieldValue] of Object.entries(create)) {
            if (values[fieldName] === undefined) {
                values[fieldName] = typeof fieldValue === 'function' ? fieldValue(values) : fieldValue;
            }
        }
    }
};

// TODO: improve typing of return identity identifier

export const createEntity = async (
    orbis: Orbis,
    metadata: EntityMetadata,
    args: CreateOneArguments,
    options: OperationOptions = {}
): Promise<UniqueWhereArgument> => {
    // Find entity repository
    const repository = orbis.getManager().getRepository(metadata.Entity);

    // Find entity metadata
    const entityMetadata = orbis.getDataSource().entityMetadatas.find((e) => e.name === metadata.Entity.name);

    // Create insert query builder
    const qb = repository
        .createQueryBuilder(metadata.singularName)
        .insert();

    // Parse data
    const values: ObjectLiteral = {};
    const toManyRelations: ToManyRelation[] = [];
    for (const [fieldName, fieldValue] of Object.entries(args.data)) {
        // Handle relationship
        if (metadata.relations.includes(fieldName)) {
            // Find relation metadata
            const relationMetadata = entityMetadata.relations.find((relation) => relation.propertyName === fieldName);

            if (relationMetadata.isOneToMany || relationMetadata.isManyToMany) {
                if (!Array.isArray(fieldValue)) {
                    throw new Error(`Field "${fieldName}" has to be an array, but is "${typeof fieldValue}".`);
                }

                // These relations are handled after the entity is created
                toManyRelations.push({
                    fieldName,
                    fieldValue: fieldValue as DataArgument[],
                    relationMetadata
                });
            } else {
                if (Array.isArray(fieldValue) || typeof fieldValue !== 'object' || fieldValue instanceof Date) {
                    throw new Error(`Field "${fieldName}" has to be an object, but is "${Array.isArray(fieldValue) ? 'array' : typeof fieldValue}".`);
                }

                const identifier = await updateRelation(orbis, metadata, fieldName, fieldValue, false, {
                    context: options.context
                });

                if (relationMetadata.isOwning) {
                    values[fieldName] = identifier;
                }
            }
        } else {
            values[fieldName] = fieldValue;
        }
    }

    // Merge values from create metadata
    mergeCreateMetadata(values, orbis.getOption('entity', {}).create);
    mergeCreateMetadata(values, metadata.create);

    // Schema validation
    if (orbis.getMetadata().hasSchema(metadata.Entity.name)) {
        await orbis.getMetadata().getSchema(metadata.Entity.name).validate(values);
    }

    // Set insert values
    qb.values(values);

    // Add data to query runner for subscribers
    repository.queryRunner.data.orbis = {
        values
    };

    // Execute insert query
    const result = await qb.execute();

    // Get entity identifier from insert query
    const identifier = result.identifiers[0] as UniqueWhereArgument;

    // Handle one-to-many and many-to-many relationships
    for (const {fieldName, fieldValue, relationMetadata} of toManyRelations) {
        for (const value of fieldValue) {
            // Add the entity's identifier to the relationship data
            if (value.create) {
                value.create[relationMetadata.inverseSidePropertyPath] = {
                    connect: identifier
                };
            } else if (value.connect) {
                value.connect[relationMetadata.inverseSidePropertyPath] = {
                    connect: identifier
                };
            }

            await updateRelation(orbis, metadata, fieldName, value, false, {
                context: options.context
            });
        }
    }

    // Return entity identifier
    return identifier;
};

export const createOne = async <Entity>(
    orbis: Orbis,
    metadata: EntityMetadata,
    args: CreateOneArguments,
    options: OperationOptions = {}
): Promise<Entity> => {
    let identifier: UniqueWhereArgument;

    // Run create in a transaction
    await orbis.transaction(async () => {
        // Create entity
        identifier = await createEntity(orbis, metadata, args, {
            context: options.context
        });
    }, false);

    // Find entity with relations
    return identifier ? await findOne<Entity>(orbis, metadata, {
        where: identifier,
        relations: args.relations
    }, {
        context: options.context
    }) : null;
};
