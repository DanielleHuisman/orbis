import {Orbis} from '../orbis';
import {parseRelations, parseWhereArgument, parseOrderByArgument, WhereArgument, OrderByArgument} from '../arguments';
import {EntityMetadata} from '../metadata';
import {firstLower} from '../util';

export interface ListArguments {
    where?: WhereArgument;
    orderBy?: OrderByArgument;
    skip?: number;
    take?: number;
    relations?: string[];
}

export interface EntityList<Entity> {
    info: {
        count: number;
    };
    values: Entity[];
}

export const resolveList = async <Entity>(
    orbis: Orbis,
    metadata: EntityMetadata,
    args: ListArguments
): Promise<EntityList<Entity>> => {
    // Create query builder
    const varName = firstLower(metadata.Entity.name);
    const qb = (await orbis.getManager()).getRepository(metadata.Entity).createQueryBuilder(varName);

    // Parse arguments
    if (args.where) {
        parseWhereArgument(orbis, metadata.Entity.name, varName, qb, qb, args.where);
    }
    if (args.orderBy) {
        parseOrderByArgument(orbis, metadata.Entity.name, varName, qb, args.orderBy);
    }
    if (args.skip) {
        qb.skip(args.skip);
    }
    if (args.take) {
        qb.take(args.take);
    }
    if (args.relations) {
        const prefix = `${metadata.singularName}.`;
        parseRelations(qb, args.relations.map((relation) => relation.startsWith(prefix) ? relation : `${prefix}${relation}`));
    }

    // Execute query
    const [values, count] = await qb.getManyAndCount();
    return {
        info: {
            count
        },
        values: (values as unknown[]) as Entity[]
    };
};
