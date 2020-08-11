import {ObjectLiteral} from 'typeorm';

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
        for (const [fieldName, fieldValue] of Object.entries(args.data)) {
            if (metadata.relations.includes(fieldName)) {
                // Find relation metadata
                const relationMetadata = entityMetadata.relations.find((relation) => relation.propertyName === fieldName);

                if (Array.isArray(fieldValue)) {
                    for (const value of fieldValue as any[]) {
                        await updateRelation(orbis, metadata, fieldName, value, false, {
                            context: options.context
                        });

                        // TODO: is it possible for this side to be owning? Many-to-many?
                        // if (relationMetadata.isOwning) {
                        //     values[] = identifier;
                        // }
                    }
                } else {
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

        // Execute insert query
        qb.values(values);
        const result = await qb.execute();

        // Return entity identifier
        return result.identifiers[0] as Entity;
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
