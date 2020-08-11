import {Orbis} from '../orbis';
import {WhereArgument, OrderByArgument} from '../arguments';
import {EntityMetadata} from '../metadata';
import {OperationOptions} from '../util';

import {resolveList, EntityList} from './list';

export interface FindManyArguments {
    where?: WhereArgument;
    orderBy?: OrderByArgument;
    skip?: number;
    take?: number;
    relations?: string[];
}

export const findMany = async <Entity>(
    orbis: Orbis,
    metadata: EntityMetadata,
    args: FindManyArguments = {},
    options: OperationOptions = {}
): Promise<EntityList<Entity>> => {
    let whereList: WhereArgument[] = [];

    // Handle entity scope
    if (metadata.scope && options.context) {
        const whereScope = metadata.scope(options.context);

        if (Array.isArray(whereScope)) {
            whereList = whereList.concat(whereScope);
        } else if (whereScope) {
            if (Object.keys(whereScope).length > 0) {
                whereList.push(whereScope);
            }
        }
    }

    // Handle arguments
    if (args.where) {
        whereList.push(args.where);
    }

    // Resolve list
    return await resolveList(orbis, metadata, {
        ...args,
        where: whereList.length === 1 ? whereList[0] : {AND: whereList}
    });
};
