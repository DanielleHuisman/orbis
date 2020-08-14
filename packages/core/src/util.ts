import {ArgsValue, GetGen} from '@nexus/schema/dist/core';
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

export const hasPrototype = (obj: unknown, prototype: Constructor<unknown>) => {
    const p = Object.getPrototypeOf(obj);
    return p === prototype || (p && hasPrototype(p, prototype));
};

export const fixNullPrototypes = (data: unknown) => {
    for (const value of Object.values(data)) {
        // @ts-ignore: TypeScript doesn't allow __proto__ to be accessed
        if (typeof value === 'object' && value && value.__proto__ === undefined) {
            Object.setPrototypeOf(value, {});

            fixNullPrototypes(value);
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

export type YupCommonSchema<T> = yup.Schema<T> & {
    nullable(isNullable?: true): YupCommonSchema<T | null>;
    nullable(isNullable: false): YupCommonSchema<Exclude<T, null>>;
    nullable(isNullable?: boolean): YupCommonSchema<T>;
    required(message?: yup.TestOptionsMessage): YupCommonSchema<Exclude<T, undefined>>;
};

export interface YupObjectSchema<T extends object | null | undefined = object> extends yup.ObjectSchema<T> {
    fields: {
        [k in keyof T]:
            T[k] extends boolean ? yup.BooleanSchema<T[k]> :
            T[k] extends number ? yup.NumberSchema<T[k]> :
            T[k] extends string ? yup.StringSchema<T[k]> :
            T[k] extends Date ? yup.DateSchema<T[k]> :
            T[k] extends object ? yup.ObjectSchema<T[k]> :
            yup.MixedSchema<T[k]>;
    };
}

export type SchemaFunction<ObjectType> = (
    schema: YupObjectSchema<{
        [k in keyof ObjectType]: ObjectType[k];
    }>,
    yupInstance: typeof yup) => yup.ObjectSchema;
