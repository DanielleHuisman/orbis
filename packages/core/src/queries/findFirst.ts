import {Orbis} from '../orbis';
import {WhereArgument, OrderByArgument} from '../arguments';
import {EntityMetadata} from '../metadata';
import {OperationOptions} from '../util';

import {findMany} from './findMany';

export interface FindFirstArguments {
    where?: WhereArgument;
    orderBy?: OrderByArgument;
    skip?: number;
    take?: number;
    relations?: string[];
}

export const findFirst = async <Entity>(
    orbis: Orbis,
    metadata: EntityMetadata,
    args: FindFirstArguments = {},
    options: OperationOptions = {}
): Promise<Entity> => {
    const list = await findMany<Entity>(orbis, metadata, args, options);
    return list.info.count === 0 ? null : list.values[0];
};
