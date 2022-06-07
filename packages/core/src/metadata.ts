
import {core as nexus} from 'nexus';
import {ColumnMetadataArgs} from 'typeorm/metadata-args/ColumnMetadataArgs';
import {RelationMetadataArgs} from 'typeorm/metadata-args/RelationMetadataArgs';
import {ObjectSchema} from 'yup';

import {WhereArgument} from './arguments';
import {Constructor, Enum, SchemaFunction} from './util';

/* Type definitions */
export type TypeDef = nexus.AllNexusNamedTypeDefs | nexus.NexusExtendInputTypeDef<string> | nexus.NexusExtendTypeDef<string>;

export interface TypeDefs {
    [typeName: string]: TypeDef;
}

/* Interfaces */
export interface Interfaces {
    [name: string]: InterfaceMetadata<unknown>;
}

export interface InterfaceMetadata<ObjectType> {
    schema?: SchemaFunction<ObjectType>;
}

/* Objects */
export interface Objects {
    [name: string]: ObjectMetadata<unknown>;
}

export interface ObjectMetadata<ObjectType> {
    implements: Constructor<unknown>[];
    schema?: SchemaFunction<ObjectType>;
}

/* Entities */
export interface Entities {
    [name: string]: EntityMetadata;
}

export interface EntityMetadata {
    Entity: Constructor<any>;
    singularName: string;
    pluralName: string;
    columns: string[];
    relations: string[];
    query?: EntityQueryMetadata;
    mutation?: EntityMutationMetadata;
    create?: EntityCreateMetadata;
    // TODO: add entity generic types for scope where arguments
    scope?: (context: any) => WhereArgument | WhereArgument[];
}

export interface EntityQueryMetadata {
    findOne?: boolean;
    findMany?: boolean;
}

export interface EntityMutationMetadata {
    createOne?: boolean;
    updateOne?: boolean;
    deleteOne?: boolean;
    deleteMany?: boolean;
}

export type EntityCreateMetadata<Entity = unknown> = {
    [key in keyof Entity]?: Entity[key] | ((values: Partial<Entity>) => Entity[key]);
};

/* Fields */
export interface Fields {
    [typeName: string]: {
        [fieldName: string]: FieldMetadata;
    };
}

export interface FieldMetadata {
    type: TypeFunction;
    resolvedType?: Type;
    nullable?: boolean;
    float?: boolean;
    graphql?: boolean;
    resolve?: nexus.FieldResolver<string, string>;

    column?: ColumnMetadataArgs;
    relation?: RelationMetadataArgs;
}

export type Type = Constructor<unknown> | Constructor<unknown>[] | Enum;
export type TypeFunction = () => Type;

/* Schemas */
export interface Schemas {
    [typeName: string]: ObjectSchema<unknown>;
}

/* Global */
export interface GlobalEntityMetadata {
    query?: EntityQueryMetadata;
    mutation?: EntityMutationMetadata;
    create?: EntityCreateMetadata;
}

/* Metadata class */
export class OrbisMetadata {
    private types: TypeDefs = {};
    private interfaces: Interfaces = {};
    private objects: Objects = {};
    private entities: Entities = {};
    private fields: Fields = {};
    private schemas: Schemas = {};

    hasType(typeName: string) {
        return !!this.types[typeName];
    }

    getTypes() {
        return this.types;
    }

    getType<Kind extends TypeDef>(typeName: string) {
        return this.types[typeName] as Kind;
    }

    getOrAddType<Kind extends TypeDef>(typeName: string, type: () => TypeDef) {
        if (!this.types[typeName]) {
            this.types[typeName] = type();
        }
        return this.getType<Kind>(typeName);
    }

    addType(type: TypeDef) {
        this.addTypeByName(type.name, type);
    }

    addTypeByName(typeName: string, type: TypeDef) {
        if (this.types[typeName]) {
            throw new Error(`Type "${typeName}" is already registered`);
        }
        this.types[typeName] = type;
    }

    getInterfaces() {
        return this.interfaces;
    }

    getInterface(typeName: string) {
        return this.interfaces[typeName];
    }

    addInterface(typeName: string, metadata: InterfaceMetadata<any>) {
        if (this.interfaces[typeName]) {
            throw new Error(`Interface type "${typeName}" is already registered`);
        }
        this.interfaces[typeName] = metadata;
    }

    hasObject(typeName: string) {
        return !!this.objects[typeName];
    }

    getObjects() {
        return this.objects;
    }

    getObject(typeName: string) {
        return this.objects[typeName];
    }

    addObject(typeName: string, metadata: ObjectMetadata<any>) {
        if (this.objects[typeName]) {
            throw new Error(`Object type "${typeName}" is already registered`);
        }
        this.objects[typeName] = metadata;
    }

    hasEntity(typeName: string) {
        return !!this.entities[typeName];
    }

    getEntities() {
        return this.entities;
    }

    getEntity(typeName: string) {
        return this.entities[typeName];
    }

    addEntity(typeName: string, metadata: EntityMetadata) {
        if (this.entities[typeName]) {
            throw new Error(`Entity type "${typeName}" is already registered`);
        }
        this.entities[typeName] = metadata;
    }

    hasFields(typeName: string) {
        return !!this.fields[typeName];
    }

    hasField(typeName: string, fieldName: string) {
        return this.hasFields(typeName) && !!this.fields[typeName][fieldName];
    }

    getAllFields() {
        return this.fields;
    }

    getFields(typeName: string) {
        return this.fields[typeName];
    }

    getField(typeName: string, fieldName: string) {
        return this.getFields(typeName)[fieldName];
    }

    addField(typeName: string, fieldName: string, metadata: FieldMetadata) {
        if (!this.fields[typeName]) {
            this.fields[typeName] = {};
        }

        if (this.fields[typeName][fieldName]) {
            throw new Error(`Field "${fieldName}" on type "${typeName}" is already registered`);
        }

        this.fields[typeName][fieldName] = metadata;
    }

    mergeFields(fromTypeName: string, toTypeName: string) {
        if (!this.fields[toTypeName]) {
            this.fields[toTypeName] = {};
        }

        this.fields[toTypeName] = {
            ...this.fields[fromTypeName],
            ...this.fields[toTypeName]
        };
    }

    hasSchema(typeName: string) {
        return !!this.schemas[typeName];
    }

    getSchemas() {
        return this.schemas;
    }

    getSchema(typeName: string) {
        return this.schemas[typeName];
    }

    addSchema(typeName: string, schema: ObjectSchema<unknown>) {
        this.schemas[typeName] = schema;
    }

    merge(other: OrbisMetadata) {
        // Merge types
        for (const type of Object.values(other.getTypes())) {
            this.addType(type);
        }

        // Merge interfaces
        for (const [typeName, metadata] of Object.entries(other.getInterfaces())) {
            this.addInterface(typeName, metadata);
        }

        // Merge objects
        for (const [typeName, metadata] of Object.entries(other.getObjects())) {
            this.addObject(typeName, metadata);
        }

        // Merge entities
        for (const [typeName, metadata] of Object.entries(other.getEntities())) {
            this.addEntity(typeName, metadata);
        }

        // Merge fields
        for (const [typeName, fields] of Object.entries(other.getAllFields())) {
            for (const [fieldName, metadata] of Object.entries(fields)) {
                this.addField(typeName, fieldName, metadata);
            }
        }

        // Merge schemas
        for (const [typeName, schema] of Object.entries(other.getSchemas())) {
            this.addSchema(typeName, schema);
        }
    }
}
