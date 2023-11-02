import {core as nexus} from 'nexus';
import {getMetadataArgsStorage} from 'typeorm';

import {getOrbis, Orbis, OrbisBaseOptions} from './orbis';
import {FieldMetadata, Type, TypeFunction} from './metadata';
import {generateNexusRelationListField} from './queries';
import {Constructor} from './util';

export interface OrbisFieldOptions extends OrbisBaseOptions {
    type?: TypeFunction;
    nullable?: boolean;
    float?: boolean;
    graphql?: boolean;
    resolve?: nexus.FieldResolver<string, string>;
}

export type OrbisFieldArguments = [] | [TypeFunction | OrbisFieldOptions] | [TypeFunction, OrbisFieldOptions];

export const registerField = (target: Constructor<unknown>, propertyName: string, options: OrbisFieldOptions) => {
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
    let type: TypeFunction = null;
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
    const target: Constructor<unknown> = targetObj.constructor;
    const fieldType = Reflect.getMetadata('design:type', targetObj, propertyName);

    // Use field type from metadata if none is provided
    if (fieldType && fieldType !== Object && !type) {
        type = () => fieldType as Type;
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

const mergeFields = (orbis: Orbis, target: Constructor<unknown>) => {
    // Merge parent fields into children
    let currentTarget = target;
    while (currentTarget) {
        if (orbis.getMetadata().hasFields(currentTarget.name)) {
            orbis.getMetadata().mergeFields(currentTarget.name, target.name);
        }

        currentTarget = Object.getPrototypeOf(currentTarget);
    }
};

export const generateNexusInputFields = (
    orbis: Orbis,
    target: Constructor<unknown>,
    t: nexus.InputDefinitionBlock<string>
) => {
    mergeFields(orbis, target);

    // Generate fields
    for (const [fieldName, field] of Object.entries(orbis.getMetadata().getFields(target.name))) {
        if (field.graphql !== false) {
            generateNexusInputField(orbis, target.name, t, fieldName, field);
        }
    }
};

export const generateNexusOutputFields = (
    orbis: Orbis,
    target: Constructor<unknown>,
    t: nexus.OutputDefinitionBlock<string>
) => {
    mergeFields(orbis, target);

    // Generate fields
    for (const [fieldName, field] of Object.entries(orbis.getMetadata().getFields(target.name))) {
        if (field.graphql !== false) {
            generateNexusOutputField(orbis, target.name, t, fieldName, field);
        }
    }
};

export const generateNexusInputField = (
    orbis: Orbis,
    typeName: string,
    t: nexus.InputDefinitionBlock<string>,
    fieldName: string,
    field: FieldMetadata,
    forceNullable: boolean = false
) => {
    let type = resolveFieldType(field);

    if (field.resolve) {
        // Fields with a resolver should not be added to input object types
        return;
    }

    let definition: Partial<nexus.InputDefinitionBlock<string>> = t;

    if (field.nullable || forceNullable) {
        definition = definition.nullable;
    } else {
        definition = definition.nonNull;
    }

    if (Array.isArray(type)) {
        type = type[0];
        definition = definition.list.nonNull;
    }

    if (type === Boolean) {
        definition.boolean(fieldName);
    } else if (type === Number) {
        if (field.float) {
            definition.float(fieldName);
        } else {
            definition.int(fieldName);
        }
    } else if (type === String) {
        definition.string(fieldName);
    } else if (type === Date) {
        if (field.column && field.column.options.type) {
            const columnType = field.column.options.type.toString();
            if (columnType.startsWith('timestamp') || columnType.startsWith('datetime')) {
                definition.field(fieldName, {
                    type: 'DateTime'
                });
            } else if (columnType.startsWith('date')) {
                definition.field(fieldName, {
                    type: 'Date'
                });
            } else if (columnType.startsWith('time')) {
                definition.field(fieldName, {
                    type: 'Time'
                });
            }
        } else {
            // TODO: add config option, similar to float
            definition.field(fieldName, {
                type: 'DateTime'
            });
        }
    } else if (typeof type === 'function') {
        definition.field(fieldName, {
            type: orbis.getMetadata().getType<nexus.AllNexusNamedInputTypeDefs>(type.name) || type.name
        });
    } else {
        const enumDef = Object.entries(orbis.getMetadata().getTypes()).find(
            (entry) => entry[1] instanceof nexus.NexusEnumTypeDef && entry[1].value.members === type
        );
        if (enumDef) {
            definition.field(fieldName, {
                type: enumDef[0]
            });
        } else {
            throw new Error(`Type of field "${fieldName}" on "${typeName}" can't be an unknown enum`);
        }
    }
};

export const generateNexusOutputField = (
    orbis: Orbis,
    typeName: string,
    t: nexus.OutputDefinitionBlock<string>,
    fieldName: string,
    field: FieldMetadata
) => {
    let type = resolveFieldType(field);

    const config: Partial<nexus.NexusOutputFieldConfig<string, string>> = {};

    if (field.resolve) {
        config.resolve = field.resolve;
    }

    let definition: Partial<nexus.OutputDefinitionBlock<string>> = t;

    if (field.nullable) {
        definition = definition.nullable;
    } else {
        definition = definition.nonNull;
    }

    if (Array.isArray(type)) {
        type = type[0];

        if (field.relation) {
            generateNexusRelationListField(orbis, t, typeName, fieldName, type.name, config);
            return;
        }

        definition = definition.list.nonNull;
    }

    if (type === Boolean) {
        definition.boolean(fieldName, config);
    } else if (type === Number) {
        if (field.float) {
            definition.float(fieldName, config);
        } else {
            definition.int(fieldName, config);
        }
    } else if (type === String) {
        definition.string(fieldName, config);
    } else if (type === Date) {
        if (field.column && field.column.options.type) {
            const columnType = field.column.options.type.toString();
            if (columnType.startsWith('timestamp') || columnType.startsWith('datetime')) {
                definition.field(fieldName, {
                    type: 'DateTime',
                    ...config
                });
            } else if (columnType.startsWith('date')) {
                definition.field(fieldName, {
                    type: 'Date',
                    ...config
                });
            } else if (columnType.startsWith('time')) {
                definition.field(fieldName, {
                    type: 'Time',
                    ...config
                });
            }
        } else {
            // TODO: add config option, similar to float
            definition.field(fieldName, {
                type: 'DateTime',
                ...config
            });
        }
    } else if (typeof type === 'function') {
        definition.field(fieldName, {
            type: orbis.getMetadata().getType<nexus.AllNexusNamedOutputTypeDefs>(type.name) || type.name,
            ...config
        });
    } else {
        const enumDef = Object.entries(orbis.getMetadata().getTypes()).find(
            (entry) => entry[1] instanceof nexus.NexusEnumTypeDef && entry[1].value.members === type
        );
        if (enumDef) {
            definition.field(fieldName, {
                type: enumDef[0],
                ...config
            });
        } else {
            throw new Error(`Type of field "${fieldName}" on "${typeName}" can't be an unknown enum`);
        }
    }
};
