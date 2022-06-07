import {UniqueWhereArgument} from '../arguments';
import {Orbis} from '../orbis';
import {EntityMetadata} from '../metadata';
import {findOne} from '../queries/findOne';
import {OperationOptions} from '../util';

export interface DeleteOneArguments {
    where: UniqueWhereArgument;
    relations?: string[];
}

export const deleteOne = async <Entity>(
    orbis: Orbis,
    metadata: EntityMetadata,
    args: DeleteOneArguments,
    options: OperationOptions = {}
): Promise<Entity> => {
    // Find entity
    const entity = await findOne<Entity>(orbis, metadata, args, {
        context: options.context,
        notFoundError: true
    });

    // Find entity repository
    const repository = (await orbis.getManager()).getRepository(metadata.Entity);

    // Add data to query runner for subscribers
    repository.queryRunner.data.orbis = {
        id: repository.getId(entity)
    };

    // Delete entity
    await repository
        .createQueryBuilder(metadata.singularName)
        .delete()
        .whereInIds([repository.getId(entity)])
        .execute();

    return entity;
};
