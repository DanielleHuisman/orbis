import {inputObjectType} from 'nexus';
import {NexusObjectTypeDef, NexusInputObjectTypeDef, NexusEnumTypeDef, InputDefinitionBlock} from 'nexus/dist/core';
import {getMetadataArgsStorage} from 'typeorm';

import {getOrbis, Orbis, OrbisBaseOptions} from './orbis';
import {EntityMetadata} from './metadata';
import {resolveFieldType, generateNexusInputFields, generateNexusInputField} from './fields';
import {isGeneratedField, Constructor} from './util';

export const registerInputObjectType = (target: Constructor<unknown>, options: OrbisBaseOptions = {}) => {
    const orbis = getOrbis(options);

    // Generate input object type
    const Type = inputObjectType({
        name: target.name,
        definition(t) {
            generateNexusInputFields(orbis, target, t);
        }
    });

    // Store type
    orbis.getMetadata().addType(Type);

    return Type;
};

export const OrbisInputObject = (options: OrbisBaseOptions = {}): ClassDecorator => (target) => {
    registerInputObjectType(target, options);
};

export const generateNexusInputObjects = (orbis: Orbis, Type: NexusObjectTypeDef<string>, entity: EntityMetadata) => {
    const inputObjects = [
        inputObjectType({
            name: `${Type.name}WhereUniqueInput`,
            definition(t) {
                // TODO: should not be nullable if id is the only field
                t.nullable.string('id');

                // Add unique columns
                const unique = getMetadataArgsStorage().uniques.find((u) => u.target === entity.Entity);
                if (unique) {
                    if (Array.isArray(unique.columns)) {
                        for (const column of unique.columns) {
                            generateNexusInputField(orbis, Type.name, t, column, orbis.getMetadata().getField(Type.name, column), true);
                        }
                    } else {
                        // TODO: handle unique function
                    }
                }
            }
        })
    ];

    generateNexusWhereInputObject(orbis, entity.Entity, Type.name);
    generateNexusOrderByInputObject(orbis, entity.Entity, Type.name);
    generateNexusMutationInputObject(orbis, entity.Entity, Type.name, false);
    generateNexusMutationInputObject(orbis, entity.Entity, Type.name, true);

    for (const inputObject of inputObjects) {
        orbis.getMetadata().addType(inputObject);
    }
};

export const generateNexusWhereInputObject = (orbis: Orbis, target: Constructor<unknown>, typeName: string) => {
    const name = `${typeName}WhereInput`;

    return orbis.getMetadata().getOrAddType<NexusInputObjectTypeDef<string>>(name, () => inputObjectType({
        name,
        definition(t) {
            let currentTarget = target;
            while (currentTarget) {
                if (orbis.getMetadata().hasFields(currentTarget.name)) {
                    for (const [fieldName, field] of Object.entries(orbis.getMetadata().getFields(currentTarget.name))) {
                        if (field.graphql === false || field.resolve) {
                            continue;
                        }

                        let type = resolveFieldType(field);
                        const definition: Partial<InputDefinitionBlock<string>> = t.nullable;

                        if (Array.isArray(type)) {
                            type = type[0];

                            // NOTE: this is a sort of hacky way to support filtering on list relations
                            if (typeof type !== 'function') {
                                // TODO: handle array filtering for non-relation fields
                                continue;
                            }
                        }

                        if (type === Boolean) {
                            definition.boolean(fieldName);
                        } else if (type === Number) {
                            if (field.float) {
                                definition.field(fieldName, {
                                    type: 'FloatFilter'
                                });
                            } else {
                                definition.field(fieldName, {
                                    type: 'IntFilter'
                                });
                            }
                        } else if (type === String) {
                            definition.field(fieldName, {
                                type: 'StringFilter'
                            });
                        } else if (type === Date) {
                            definition.field(fieldName, {
                                type: 'DateTimeFilter'
                            });
                        } else if (typeof type === 'function') {
                            const whereType = generateNexusWhereInputObject(orbis, type, type.name);
                            definition.field(fieldName, {
                                type: whereType
                            });
                        } else {
                            const enumDef = Object.entries(orbis.getMetadata().getTypes())
                                .find((entry) => entry[1] instanceof NexusEnumTypeDef && entry[1].value.members === type);

                            if (enumDef) {
                                const enumFilterType = generateNexusEnumFilter(orbis, enumDef[0]);
                                definition.field(fieldName, {
                                    type: enumFilterType
                                });
                            } else {
                                throw new Error(`Type of field "${fieldName}" on "${typeName}" can't be an unknown enum "${type}"`);
                            }
                        }
                    }

                    t.nullable.list.nonNull.field('AND', {
                        type: `${typeName}WhereInput`
                    });
                    t.nullable.list.nonNull.field('OR', {
                        type: `${typeName}WhereInput`
                    });
                }

                currentTarget = Object.getPrototypeOf(currentTarget);
            }
        }
    }));
};

export const generateNexusEnumFilter = (orbis: Orbis, enumTypeName: string) => {
    const name = `${enumTypeName}Filter`;

    return orbis.getMetadata().getOrAddType<NexusInputObjectTypeDef<string>>(name, () => inputObjectType({
        name,
        definition(t) {
            t.nullable.field('equals', {
                type: enumTypeName
            });
            t.nullable.field('not', {
                type: enumTypeName
            });
            t.nullable.list.nonNull.field('in', {
                type: enumTypeName
            });
            t.nullable.list.nonNull.field('notIn', {
                type: enumTypeName
            });
        }
    }));
};

export const generateNexusOrderByInputObject = (orbis: Orbis, target: Constructor<unknown>, typeName: string) => {
    const name = `${typeName}OrderByInput`;

    return orbis.getMetadata().getOrAddType<NexusInputObjectTypeDef<string>>(name, () => inputObjectType({
        name,
        definition(t) {
            let currentTarget = target;
            while (currentTarget) {
                if (orbis.getMetadata().hasFields(currentTarget.name)) {
                    for (const [fieldName, field] of Object.entries(orbis.getMetadata().getFields(currentTarget.name))) {
                        if (field.graphql === false || field.resolve) {
                            continue;
                        }

                        const type = resolveFieldType(field);
                        const definition: Partial<InputDefinitionBlock<string>> = t.nullable;

                        if (Array.isArray(type)) {
                            // TODO: handle array ordering
                            continue;
                        }

                        if (type === Boolean || type === Number || type === String || type === Date) {
                            definition.field(fieldName, {
                                type: 'OrderByArg'
                            });
                        } else if (typeof type === 'function') {
                            const orderByType = generateNexusOrderByInputObject(orbis, type, type.name);
                            definition.field(fieldName, {
                                type: orderByType
                            });
                        } else {
                            // Enum
                            definition.field(fieldName, {
                                type: 'OrderByArg'
                            });
                        }
                    }
                }

                currentTarget = Object.getPrototypeOf(currentTarget);
            }
        }
    }));
};

export const generateNexusMutationInputObject = (orbis: Orbis, target: Constructor<unknown>, typeName: string, isUpdate: boolean = false) => {
    const name = isUpdate ? `${typeName}UpdateInput` : `${typeName}CreateInput`;

    return orbis.getMetadata().getOrAddType<NexusInputObjectTypeDef<string>>(name, () => inputObjectType({
        name,
        definition(t) {
            let currentTarget = target;
            while (currentTarget) {
                if (orbis.getMetadata().hasFields(currentTarget.name)) {
                    for (const [fieldName, field] of Object.entries(orbis.getMetadata().getFields(currentTarget.name))) {
                        if (field.graphql === false || field.resolve) {
                            continue;
                        }

                        let type = resolveFieldType(field);
                        let definition: Partial<InputDefinitionBlock<string>> = t;
                        let isNullable = isUpdate || !!field.nullable;

                        if (!isUpdate) {
                            // Columns with defaults or generated values are not required
                            if (isGeneratedField(field)) {
                                isNullable = true;
                            }

                            // One-to-many and many-to-many relations are initialized to an empty list by default
                            if (field.relation && Array.isArray(type)) {
                                isNullable = true;
                            }

                            // Check if the field is generated by entity create metadata
                            const entity = orbis.getMetadata().getEntity(typeName);
                            const globalEntityMetadata = orbis.getOption('entity', {});
                            if (entity) {
                                if ((globalEntityMetadata.create && globalEntityMetadata.create[fieldName]) || (entity.create && entity.create[fieldName])) {
                                    isNullable = true;
                                }
                            }
                        }

                        if (isNullable) {
                            definition = definition.nullable;
                        }

                        if (Array.isArray(type)) {
                            type = type[0];
                            definition = definition.list.nonNull;
                        }

                        if (type === Boolean) {
                            definition.boolean(fieldName);
                        } else if (type === Number) {
                            if (field.float) {
                                definition.int(fieldName);
                            } else {
                                definition.float(fieldName);
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
                            if (field.relation) {
                                // Relation
                                const mutationType = generateNexusRelationInputObject(orbis, type.name, isUpdate);
                                definition.field(fieldName, {
                                    type: mutationType
                                });
                            } else {
                                // Embedded entity
                                const mutationType = generateNexusMutationInputObject(orbis, type, type.name, isUpdate);
                                definition.field(fieldName, {
                                    type: mutationType
                                });
                            }
                        } else {
                            const enumDef = Object.values(orbis.getMetadata().getTypes())
                                .find((typeDef) => typeDef instanceof NexusEnumTypeDef && typeDef.value.members === type);

                            if (enumDef) {
                                definition.field(fieldName, {
                                    type: enumDef as NexusEnumTypeDef<string>
                                });
                            } else {
                                throw new Error(`Type of field "${fieldName}" on "${typeName}" can't be an unknown enum "${type}"`);
                            }
                        }
                    }
                }

                currentTarget = Object.getPrototypeOf(currentTarget);
            }
        }
    }));
};

export const generateNexusRelationInputObject = (orbis: Orbis, typeName: string, isUpdate: boolean = false) => {
    const name = isUpdate ? `${typeName}UpdateRelationInput` : `${typeName}CreateRelationInput`;

    return orbis.getMetadata().getOrAddType<NexusInputObjectTypeDef<string>>(name, () => inputObjectType({
        name,
        definition(t) {
            t.nullable.field('create', {
                type: `${typeName}CreateInput`
            });

            t.nullable.field('connect', {
                type: `${typeName}WhereUniqueInput`
            });

            if (isUpdate) {
                t.nullable.field('disconnect', {
                    type: `${typeName}WhereUniqueInput`
                });
            }
        }
    }));
};
