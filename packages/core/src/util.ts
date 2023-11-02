import path from 'path';
import {readdir} from 'fs/promises';
import {fileURLToPath} from 'url';
import {core as nexus} from 'nexus';
import {GraphQLResolveInfo} from 'graphql';
import {getMetadataArgsStorage, BaseEntity} from 'typeorm';
import * as yup from 'yup';

import {Orbis} from './orbis';
import {EntityMetadata, FieldMetadata} from './metadata';

export type Constructor<T> = (new () => T) | Function;

export type Enum = {
    [key: number]: string;
};

export type Relation<Type> = Promise<Type> | Type;

export const hasPrototype = (obj: unknown, prototype: Constructor<unknown>): boolean => {
    const p = Object.getPrototypeOf(obj);
    return p === prototype || (p && hasPrototype(p, prototype));
};

export const fixNullPrototypes = (data: object) => {
    for (const value of Object.values(data)) {
        if (typeof value === 'object' && value && value.__proto__ === undefined) {
            Object.setPrototypeOf(value, {});

            fixNullPrototypes(value as object);
        }
    }
};

export const firstLower = (text: string) => `${text.substring(0, 1).toLowerCase()}${text.substring(1)}`;
export const firstUpper = (text: string) => `${text.substring(0, 1).toUpperCase()}${text.substring(1)}`;

export const shouldGenerateField = (orbis: Orbis, typeName: string, type: 'query' | 'mutation', field: string) => {
    const entity = orbis.getMetadata().getEntity(typeName);
    if (entity[type]) {
        return entity[type][field] !== false;
    }

    const globalEntityMetadata = orbis.getOption('entity', {});
    if (globalEntityMetadata[type]) {
        return globalEntityMetadata[type][field] !== false;
    }

    return true;
};

export const isEntity = (target: Constructor<unknown>) =>
    hasPrototype(target, BaseEntity) || getMetadataArgsStorage().tables.some((table) => table.target === target);

export const isGeneratedField = (field: FieldMetadata) => {
    if (!field.column) {
        return false;
    }

    if (field.column.options.default || field.column.options.generated) {
        return true;
    }

    if (field.column.mode === 'createDate' || field.column.mode === 'updateDate' || field.column.mode === 'deleteDate') {
        return true;
    }

    return false;
};

export const findEntities = (possibleEntities: (unknown[] | Record<string, unknown>)[]): Function[] =>
    possibleEntities
        .flatMap((possible) => typeof possible == 'object' ? Object.values(possible) : possible)
        .filter((possibleEntity) => typeof possibleEntity === 'function') as Function[];

export const findMigrations = async (url: string, name = 'migrations') => {
    let migrations: Function[] = [];

    const directory = path.dirname(fileURLToPath(url));
    const files = await readdir(path.join(directory, name));

    for (const file of files) {
        const module = await import(path.join(directory, name, file)) as Record<string, unknown>;
        migrations = migrations.concat(Object.values(module).filter((value) => typeof value === 'function') as Function[]);
    }

    return migrations;
};

export const findSubscribers = (possibleSubscribers: (unknown[] | Record<string, unknown>)[]): Function[] =>
    possibleSubscribers
        .flatMap((possible) => typeof possible == 'object' ? Object.values(possible) : possible)
        .filter((possibleSubscriber) => typeof possibleSubscriber === 'function') as Function[];

export type Context = nexus.GetGen<'context'>;

export type EntityFieldResolver<Type, Options = Record<string, unknown>> = (
    orbis: Orbis,
    metadata: EntityMetadata,
    args: nexus.ArgsValue<string, string>,
    context: Context,
    info: GraphQLResolveInfo,
    options?: Options
) => Promise<Type>;

export interface OperationOptions {
    context?: Context;
}

export type SchemaFunction<ObjectType> = (
    schema: YupObjectSchema<ObjectType>,
    yupInstance: typeof yup
) => YupObjectSchema<unknown>;

export type YupObjectSchema<T> = Omit<yup.ObjectSchema<T>, 'fields'> & {
    fields: {
        [k in keyof T]:
        T[k] extends boolean ? yup.BooleanSchema<T[k]> :
            T[k] extends number ? yup.NumberSchema<T[k]> :
                T[k] extends string ? yup.StringSchema<T[k]> :
                    T[k] extends Date ? yup.DateSchema<T[k]> :
                        T[k] extends object ? YupObjectSchema<T[k]> :
                            yup.MixedSchema<T[k]>;
    };
};
