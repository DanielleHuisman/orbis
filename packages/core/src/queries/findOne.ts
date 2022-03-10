import {Orbis} from '../orbis';
import {parseRelations, parseUniqueWhereArgument, parseWhereArgument, UniqueWhereArgument} from '../arguments';
import {EntityMetadata} from '../metadata';
import {OperationOptions} from '../util';

export interface FindOneArguments {
    where: UniqueWhereArgument;
    relations?: string[];
}

export interface FindOneOptions extends OperationOptions {
    notFoundError?: boolean;
}

export const findOne = async <Entity>(
    orbis: Orbis,
    metadata: EntityMetadata,
    args: FindOneArguments,
    options: FindOneOptions = {}
): Promise<Entity> => {
    // Create query builder
    const varName = metadata.singularName;
    const qb = orbis.getManager().getRepository(metadata.Entity).createQueryBuilder(varName);

    // Parse arguments
    if (args.relations) {
        const prefix = `${metadata.singularName}.`;
        parseRelations(qb, args.relations.map((relation) => relation.startsWith(prefix) ? relation : `${prefix}${relation}`));
    }
    parseUniqueWhereArgument(varName, qb, args.where);

    // Handle entity scope
    if (metadata.scope && options.context) {
        const whereScope = metadata.scope(options.context);

        if (Array.isArray(whereScope)) {
            parseWhereArgument(orbis, metadata.Entity.name, varName, qb, qb, {
                AND: whereScope
            });
        } else if (whereScope) {
            if (Object.keys(whereScope).length > 0) {
                parseWhereArgument(orbis, metadata.Entity.name, varName, qb, qb, whereScope);
            }
        }
    }

    // Execute query
    const entity = await qb.getOne();
    if (!entity && options.notFoundError) {
        throw new Error(`errors.notFound.${metadata.singularName}`);
    }
    return entity as Entity;
};
