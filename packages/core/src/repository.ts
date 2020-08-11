import {Orbis} from './orbis';
import {EntityMetadata} from './metadata';
import {
    findOne,
    findFirst,
    findMany,
    EntityList,
    FindOneArguments,
    FindOneOptions,
    FindFirstArguments,
    FindManyArguments
} from './queries';
import {
    createOne,
    updateOne,
    deleteOne,
    deleteMany,
    CreateOneArguments,
    UpdateOneArguments,
    DeleteOneArguments,
    DeleteManyArguments
} from './mutations';
import {OperationOptions} from './util';

export class Repository<Entity> {
    private orbis: Orbis;
    private metadata: EntityMetadata;

    constructor(orbis: Orbis, metadata: EntityMetadata) {
        this.orbis = orbis;
        this.metadata = metadata;
    }

    transaction<Result>(operation: () => Promise<Result>): Promise<Result> {
        return this.orbis.transaction(operation);
    }

    findOne(args: FindOneArguments, options?: FindOneOptions): Promise<Entity> {
        return findOne<Entity>(this.orbis, this.metadata, args, options);
    }

    findFirst(args?: FindFirstArguments, options?: OperationOptions): Promise<Entity> {
        return findFirst<Entity>(this.orbis, this.metadata, args, options);
    }

    findMany(args?: FindManyArguments, options?: OperationOptions): Promise<EntityList<Entity>> {
        return findMany<Entity>(this.orbis, this.metadata, args, options);
    }

    createOne(args: CreateOneArguments, options?: OperationOptions): Promise<Entity> {
        return createOne<Entity>(this.orbis, this.metadata, args, options);
    }

    updateOne(args: UpdateOneArguments, options?: OperationOptions): Promise<Entity> {
        return updateOne<Entity>(this.orbis, this.metadata, args, options);
    }

    deleteOne(args: DeleteOneArguments, options?: OperationOptions): Promise<Entity> {
        return deleteOne<Entity>(this.orbis, this.metadata, args, options);
    }

    deleteMany(args?: DeleteManyArguments, options?: OperationOptions): Promise<EntityList<Entity>> {
        return deleteMany<Entity>(this.orbis, this.metadata, args, options);
    }
}
