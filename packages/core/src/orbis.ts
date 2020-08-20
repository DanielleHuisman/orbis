import {getConnection, Connection, EntityManager} from 'typeorm';

import {registerEnumType, OrbisEnumOptions} from './enums';
import {registerField, OrbisField, OrbisFieldArguments, OrbisFieldOptions} from './fields';
import {registerInterfaceType, OrbisInterface, OrbisInterfaceOptions} from './interfaces';
import {registerInputObjectType, OrbisInputObject} from './inputObjects';
import {OrbisMetadata, GlobalEntityMetadata} from './metadata';
import {OrbisModule} from './module';
import {CreateOneArguments, UpdateOneArguments, DeleteOneArguments, DeleteManyArguments} from './mutations';
import {registerObjectType, OrbisObject, OrbisObjectOptions} from './objects';
import {FindOneArguments, FindOneOptions, FindFirstArguments, FindManyArguments} from './queries';
import {Repository} from './repository';
import {registerScalarType, OrbisScalarOptions} from './scalars';
import {registerUnionType, OrbisUnionOptions} from './unions';
import {Constructor, OperationOptions} from './util';

export interface OrbisOptions {
    connection?: Connection;

    entity?: GlobalEntityMetadata;
}

export interface OrbisBaseOptions {
    orbis?: Orbis;
}

export class Orbis {
    private options: OrbisOptions = {};
    private metadata: OrbisMetadata = new OrbisMetadata();
    private repositories: {[k: string]: Repository<unknown>} = {};
    private modules: OrbisModule<unknown>[] = [];

    private currentManager: EntityManager = null;

    constructor(options: OrbisOptions = {}) {
        this.options = options;
    }

    getOptions() {
        return this.options;
    }

    getOption<T extends keyof OrbisOptions>(name: T, defaultValue?: OrbisOptions[T]) {
        return this.options[name] === undefined ? defaultValue : this.options[name];
    }

    updateOptions(options: Partial<OrbisOptions>) {
        this.options = {
            ...this.options,
            ...options
        };
    }

    getConnection() {
        if (!this.options.connection) {
            this.options.connection = getConnection();
        }
        return this.options.connection;
    }

    getManager() {
        return this.currentManager || this.getConnection().manager;
    }

    getMetadata() {
        return this.metadata;
    }

    hasModule(name: string) {
        return this.modules.some((module) => module.getName() === name || module.getProvidedNames().includes(name));
    }

    getModules() {
        return this.modules;
    }

    getModule<ModuleType extends OrbisModule<unknown>>(name: string) {
        return this.modules.find((module) => module.getName() === name || module.getProvidedNames().includes(name)) as ModuleType;
    }

    addModule(module: OrbisModule<unknown>) {
        this.modules.push(module);

        this.merge(module.getOrbis());
    }

    addModules(modules: OrbisModule<unknown>[]) {
        for (const module of modules) {
            this.addModule(module);
        }
    }

    registerScalarType(options: OrbisScalarOptions) {
        return registerScalarType({
            ...options,
            orbis: this
        });
    }

    registerEnumType(options: OrbisEnumOptions) {
        return registerEnumType({
            ...options,
            orbis: this
        });
    }

    registerInterfaceType<InterfaceType>(target: Constructor<unknown>, options: OrbisInterfaceOptions<InterfaceType> = {}) {
        return registerInterfaceType(target, {
            ...options,
            orbis: this
        });
    }

    registerObjectType<ObjectType>(target: Constructor<unknown>, options: OrbisObjectOptions<ObjectType> = {}) {
        return registerObjectType(target, {
            ...options,
            orbis: this
        });
    }

    registerInputObjectType(target: Constructor<unknown>, options: OrbisBaseOptions = {}) {
        return registerInputObjectType(target, {
            ...options,
            orbis: this
        });
    }

    registerUnionType(options: OrbisUnionOptions) {
        return registerUnionType({
            ...options,
            orbis: this
        });
    }

    registerField(target: Constructor<unknown>, propertyName: string, options: OrbisFieldOptions) {
        return registerField(target, propertyName, {
            ...options,
            orbis: this
        });
    }

    Interface = <InterfaceType>(options: OrbisInterfaceOptions<InterfaceType> = {}): ClassDecorator => {
        return OrbisInterface({
            ...options,
            orbis: this
        });
    }

    Object = <ObjectType>(options: OrbisObjectOptions<ObjectType> = {}): ClassDecorator => {
        return OrbisObject({
            ...options,
            orbis: this
        });
    }

    InputObject() {
        return OrbisInputObject({
            orbis: this
        });
    }

    Field = (...args: OrbisFieldArguments): PropertyDecorator => {
        // Parse arguments
        let type = null;
        let options = {};
        if (args.length === 1) {
            if (typeof args[0] === 'function') {
                type = args[0];
            } else if (typeof args[0] === 'object') {
                options = args[0];
            }
        } else if (args.length === 2) {
            type = args[0];
            options = args[1];
        }

        return type == null ? OrbisField({
            ...options,
            orbis: this
        }) : OrbisField(type, {
            ...options,
            orbis: this
        });
    }

    merge(other: Orbis) {
        // Merge options
        if (Object.keys(other.options).length > 0) {
            throw new Error('Merging options it currently not supported');
        }

        // Merge metadata
        this.metadata.merge(other.getMetadata());
    }

    async transaction<Result>(operation: () => Promise<Result>, errorOnActiveTransaction: boolean = true): Promise<Result> {
        // Check if a transaction is already active
        if (this.currentManager) {
            if (errorOnActiveTransaction) {
                throw new Error('A transaction is already active, only one transaction can be active at the same time.');
            }

            return await operation();
        } else {
            // Create query runner
            const queryRunner = this.getConnection().createQueryRunner();

            // Change entity manager
            const oldManager = this.currentManager;
            this.currentManager = queryRunner.manager;

            try {
                // Start transaction
                await queryRunner.startTransaction();

                // Execute operation
                const result = await operation();

                // Commit transaction
                await queryRunner.commitTransaction();

                return result;
            } catch (err) {
                // Rollback transaction
                await queryRunner.rollbackTransaction();

                throw err;
            } finally {
                // Release query runner
                await queryRunner.release();

                // Restore entity manager
                this.currentManager = oldManager;
            }
        }
    }

    getRepository<Entity>(entityType: string | Constructor<Entity>) {
        const typeName = typeof entityType === 'string' ? entityType : entityType.name;

        if (!this.repositories[typeName]) {
            if (!this.getMetadata().hasEntity(typeName)) {
                throw new Error(`Entity type "${typeName}" does not exist`);
            }

            this.repositories[typeName] = new Repository(this, this.getMetadata().getEntity(typeName));
        }

        return this.repositories[typeName] as Repository<Entity>;
    }

    findOne<Entity>(entityType: string | Constructor<Entity>, args: FindOneArguments, options?: FindOneOptions) {
        return this.getRepository(entityType).findOne(args, options);
    }

    findFirst<Entity>(entityType: string | Constructor<Entity>, args?: FindFirstArguments, options?: OperationOptions) {
        return this.getRepository(entityType).findFirst(args, options);
    }

    findMany<Entity>(entityType: string | Constructor<Entity>, args?: FindManyArguments, options?: OperationOptions) {
        return this.getRepository(entityType).findMany(args, options);
    }

    createOne<Entity>(entityType: string | Constructor<Entity>, args?: CreateOneArguments, options?: OperationOptions) {
        return this.getRepository(entityType).createOne(args, options);
    }

    updateOne<Entity>(entityType: string | Constructor<Entity>, args?: UpdateOneArguments, options?: OperationOptions) {
        return this.getRepository(entityType).updateOne(args, options);
    }

    deleteOne<Entity>(entityType: string | Constructor<Entity>, args?: DeleteOneArguments, options?: OperationOptions) {
        return this.getRepository(entityType).deleteOne(args, options);
    }

    deleteMany<Entity>(entityType: string | Constructor<Entity>, args?: DeleteManyArguments, options?: OperationOptions) {
        return this.getRepository(entityType).deleteMany(args, options);
    }
}

// Default Orbis instance
export const defaultOrbis = new Orbis();

export const getOrbis = (options: OrbisBaseOptions) => options.orbis || defaultOrbis;
