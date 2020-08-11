import {
    CommonFieldConfig,
    InputDefinitionBlock,
    OutputDefinitionBlock,
    NexusInputFieldConfig,
    NexusOutputFieldConfig,
    NexusEnumTypeDef,
    ScalarInputFieldConfig,
    OutputScalarConfig,
    FieldResolver,
    AllNexusInputTypeDefs,
    AllNexusOutputTypeDefs
} from '@nexus/schema/dist/core';
import {getMetadataArgsStorage} from 'typeorm';

import {getOrbis, Orbis, OrbisBaseOptions} from './orbis';
import {FieldMetadata, TypeFunction} from './metadata';
import {generateNexusRelationListField} from './queries';
import {Constructor} from './util';

export interface OrbisFieldOptions extends OrbisBaseOptions {
    type?: TypeFunction;
    nullable?: boolean;
    float?: boolean;
    graphql?: boolean;
    resolve?: FieldResolver<string, string>;
}

export type OrbisFieldArguments = [] | [TypeFunction | OrbisFieldOptions] | [TypeFunction, OrbisFieldOptions];

export const registerField = (target: Constructor<any>, propertyName: string, options: OrbisFieldOptions) => {
    const orbis = getOrbis(options);

    // Validate type
    if (!options.type) {
        throw new Error(`Type of field "${propertyName}" on "${target.name}" is unknown, you need to specify the type using a field type function`);
    }

    // Check if this field is a column or relation
    const column = getMetadataArgsStorage().columns.find((c) => c.target === target && c.propertyName === propertyName);
    const relation = getMetadataArgsStorage().relations.find((r) => r.target === target && r.propertyName === propertyName);

    // Validate column and relation
    if (column && relation) {
        throw new Error(`Field "${propertyName}" on "${target.name}" can't be both a column and a relation`);
    } else if (relation && !(relation.isLazy || relation.options.lazy || relation.options.eager)) {
        throw new Error(`Relation field "${propertyName}" on "${target.name}" is not lazy or eager`);
    }

    // Store field metadata
    orbis.getMetadata().addField(target.name, propertyName, {
        // Field options
        type: options.type,
        ...options,

        // TypeORM metadata
        column,
        relation
    });
};

export const OrbisField = (...args: OrbisFieldArguments): PropertyDecorator => (targetObj, propertyName) => {
    // Validate property name
    if (typeof propertyName === 'symbol') {
        throw new Error('Property is a symbol');
    }

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


    // Attempt to find field type from metadata
    const target: Constructor<any> = targetObj.constructor;
    const fieldType = Reflect.getMetadata('design:type', targetObj, propertyName);

    // Use field type from metadata if none is provided
    if (fieldType && fieldType !== Object && !type) {
        type = () => fieldType;
    }

    registerField(target, propertyName, {
        ...options,
        type
    });
};

export const resolveFieldType = (field: FieldMetadata) => {
    if (!field.resolvedType) {
        field.resolvedType = field.type();
    }
    return field.resolvedType;
};

const addField = (
    t: InputDefinitionBlock<string> | OutputDefinitionBlock<string>,
    fieldName: string,
    config: NexusInputFieldConfig<string, string> | NexusOutputFieldConfig<string, string>
) => {
    if (t instanceof InputDefinitionBlock) {
        t.field(fieldName, config as NexusInputFieldConfig<string, string>);
    } else {
        t.field(fieldName, config as NexusOutputFieldConfig<string, string>);
    }
};

export const generateNexusFields = (
    orbis: Orbis,
    target: Constructor<any>,
    t: InputDefinitionBlock<string> | OutputDefinitionBlock<string>,
    overrideConfig?: CommonFieldConfig
) => {
    // Merge parent fields into children
    let currentTarget = target;
    while (currentTarget) {
        if (orbis.getMetadata().hasFields(currentTarget.name)) {
            orbis.getMetadata().mergeFields(currentTarget.name, target.name);
        }

        currentTarget = Object.getPrototypeOf(currentTarget);
    }

    // Generate fields
    for (const [fieldName, field] of Object.entries(orbis.getMetadata().getFields(target.name))) {
        if (field.graphql !== false) {
            generateNexusField(orbis, target.name, t, fieldName, field, overrideConfig);
        }
    }
};

export const generateNexusField = (
    orbis: Orbis,
    typeName: string,
    t: InputDefinitionBlock<string> | OutputDefinitionBlock<string>,
    fieldName: string,
    field: FieldMetadata,
    overrideConfig?: CommonFieldConfig
) => {
    let type = resolveFieldType(field);

    const config: ScalarInputFieldConfig<any> | OutputScalarConfig<string, string> = {
        nullable: field.nullable,
        ...overrideConfig
    };

    if (field.resolve) {
        if (t instanceof OutputDefinitionBlock) {
            (config as OutputScalarConfig<string, string>).resolve = field.resolve;
        } else {
            // Fields with a resolver should not be added to input object types
            return;
        }
    }

    if (Array.isArray(type)) {
        type = type[0];

        if (field.relation && t instanceof OutputDefinitionBlock) {
            generateNexusRelationListField(orbis, t, typeName, fieldName, type.name, config);
            return;
        }

        config.list = true;
    }

    if (type === Boolean) {
        t.boolean(fieldName, config);
    } else if (type === Number) {
        if (field.float) {
            t.float(fieldName, config);
        } else {
            t.int(fieldName, config);
        }
    } else if (type === String) {
        t.string(fieldName, config);
    } else if (type === Date) {
        if (field.column && field.column.options.type) {
            const columnType = field.column.options.type.toString();
            if (columnType.startsWith('timestamp') || columnType.startsWith('datetime')) {
                addField(t, fieldName, {
                    type: 'DateTime',
                    ...config
                });
            } else if (columnType.startsWith('date')) {
                addField(t, fieldName, {
                    type: 'Date',
                    ...config
                });
            } else if (columnType.startsWith('time')) {
                addField(t, fieldName, {
                    type: 'Time',
                    ...config
                });
            }
        } else {
            // TODO: add config option, similar to float
            addField(t, fieldName, {
                type: 'DateTime',
                ...config
            });
        }
    } else if (typeof type === 'function') {
        if (t instanceof InputDefinitionBlock) {
            addField(t, fieldName, {
                type: orbis.getMetadata().getType<AllNexusInputTypeDefs>(type.name) || type.name,
                ...config
            });
        } else if (t instanceof OutputDefinitionBlock) {
            addField(t, fieldName, {
                type: orbis.getMetadata().getType<AllNexusOutputTypeDefs>(type.name) || type.name,
                ...config
            });
        }
    } else {
        const enumDef = Object.entries(orbis.getMetadata().getTypes()).find((entry) => entry[1] instanceof NexusEnumTypeDef && entry[1].value.members === type);
        if (enumDef) {
            addField(t, fieldName, {
                type: enumDef[0],
                ...config
            });
        } else {
            throw new Error(`Type of field "${fieldName}" on "${typeName}" can't be an unknown enum "${type}"`);
        }
    }
};
