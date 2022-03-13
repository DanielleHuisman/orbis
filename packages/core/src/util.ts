import {ArgsValue, GetGen} from 'nexus/dist/core';
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

export const firstLower = (text: string) => `${text.substring(0, 1).toLowerCase()}${text.substring(1)}`;
export const firstUpper = (text: string) => `${text.substring(0, 1).toUpperCase()}${text.substring(1)}`;

export const hasPrototype = (obj: unknown, prototype: Constructor<unknown>): boolean => {
    const p = Object.getPrototypeOf(obj);
    return p === prototype || (!!p && hasPrototype(p, prototype));
};

export const fixNullPrototypes = (data: unknown) => {
    for (const value of Object.values(data)) {
        if (typeof value === 'object' && value) {
            if (value.__proto__ === undefined) {
                Object.setPrototypeOf(value, {});
            }

            fixNullPrototypes(value);
        }
    }
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

export type Context = GetGen<'context'>;

export type EntityFieldResolver<Type, Options = Record<string, unknown>> = (
    orbis: Orbis,
    metadata: EntityMetadata,
    args: ArgsValue<string, string>,
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
