import {ObjectLiteral} from 'typeorm';
import {RelationMetadata} from 'typeorm/metadata/RelationMetadata';

import {Orbis} from '../orbis';
import {EntityMetadata, EntityCreateMetadata} from '../metadata';
import {findOne} from '../queries/findOne';
import {OperationOptions} from '../util';

import {updateRelation} from './relations';

// TODO: find a way to have correct data typing (typegen?)
export interface CreateOneArguments {
    data: {[key: string]: any};
    relations?: string[];
}

interface ToManyRelation {
    fieldName: string;
    fieldValue: any[];
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

export const createEntity = async <Entity>(
    orbis: Orbis,
    metadata: EntityMetadata,
    args: CreateOneArguments,
    options: OperationOptions = {}
): Promise<Entity> => {
    // Find entity repository
    const repository = orbis.getManager().getRepository(metadata.Entity);

    // Find entity metadata
    const entityMetadata = orbis.getConnection().entityMetadatas.find((e) => e.name === metadata.Entity.name);

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
                    throw new Error(`Value of relationship "${fieldName}" has to be an array.`);
                }

                // These relations are handled after the entity is created
                toManyRelations.push({
                    fieldName,
                    fieldValue,
                    relationMetadata
                });
            } else {
                if (Array.isArray(fieldValue)) {
                    throw new Error(`Value of relationship "${fieldName}" can't be an array.`);
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
    const identifier = result.identifiers[0] as Entity;

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
    let identifier: any;

    // Run create in a transaction
    await orbis.transaction(async () => {
        // Create entity
        identifier = await createEntity<Entity>(orbis, metadata, args, {
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
