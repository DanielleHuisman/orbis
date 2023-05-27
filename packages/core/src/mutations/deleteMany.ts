import {Orbis} from '../orbis';
import {WhereArgument, OrderByArgument} from '../arguments';
import {EntityMetadata} from '../metadata';
import {findMany, EntityList} from '../queries';
import {OperationOptions} from '../util';

export interface DeleteManyArguments {
    where?: WhereArgument;
    orderBy?: OrderByArgument;
    skip?: number;
    take?: number;
    relations?: string[];
}

export const deleteMany = async <Entity>(
    orbis: Orbis,
    metadata: EntityMetadata,
    args: DeleteManyArguments = {},
    options: OperationOptions = {}
): Promise<EntityList<Entity>> => {
    // Find entities
    const list = await findMany<Entity>(orbis, metadata, args, {
        context: options.context
    });

    // Validate
    if (metadata.validate?.delete) {
        for (const entity of list.values) {
            await metadata.validate.delete(entity);
        }
    }

    // Find entity repository
    const repository = (await orbis.getManager()).getRepository(metadata.Entity);

    // Delete entities
    if (list.values.length > 0) {
        await repository
            .createQueryBuilder(metadata.singularName)
            .delete()
            .whereInIds(list.values.map((entity) => repository.getId(entity)))
            .execute();
    }

    return list;
};
