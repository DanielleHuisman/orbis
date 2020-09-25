import {inputObjectType} from '@nexus/schema';
import {CommonFieldConfig, NexusObjectTypeDef, NexusInputObjectTypeDef, NexusEnumTypeDef} from '@nexus/schema/dist/core';
import {getMetadataArgsStorage} from 'typeorm';

import {getOrbis, Orbis, OrbisBaseOptions} from './orbis';
import {EntityMetadata} from './metadata';
import {resolveFieldType, generateNexusFields, generateNexusField} from './fields';
import {isGeneratedField, Constructor} from './util';

export const registerInputObjectType = (target: Constructor<unknown>, options: OrbisBaseOptions = {}) => {
    const orbis = getOrbis(options);

    // Generate input object type
    const Type = inputObjectType({
        name: target.name,
        definition(t) {
            generateNexusFields(orbis, target, t);
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
                t.string('id', {
                    nullable: true
                });

                // Add unique columns
                const unique = getMetadataArgsStorage().uniques.find((u) => u.target === entity.Entity);
                if (unique) {
                    if (Array.isArray(unique.columns)) {
                        for (const column of unique.columns) {
                            generateNexusField(orbis, Type.name, t, column, orbis.getMetadata().getField(Type.name, column), {
                                nullable: true
                            });
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
                        let type = resolveFieldType(field);

                        const config: CommonFieldConfig = {
                            nullable: true
                        };

                        if (field.graphql === false || field.resolve) {
                            continue;
                        }

                        if (Array.isArray(type)) {
                            type = type[0];

                            // NOTE: this is a sort of hacky way to support filtering on list relations
                            if (typeof type !== 'function') {
                                // TODO: handle array filtering for non-relation fields
                                continue;
                            }
                        }

                        if (type === Boolean) {
                            t.boolean(fieldName, config);
                        } else if (type === Number) {
                            if (field.float) {
                                t.field(fieldName, {
                                    type: 'FloatFilter',
                                    ...config
                                });
                            } else {
                                t.field(fieldName, {
                                    type: 'IntFilter',
                                    ...config
                                });
                            }
                        } else if (type === String) {
                            t.field(fieldName, {
                                type: 'StringFilter',
                                ...config
                            });
                        } else if (type === Date) {
                            t.field(fieldName, {
                                type: 'DateTimeFilter',
                                ...config
                            });
                        } else if (typeof type === 'function') {
                            const whereType = generateNexusWhereInputObject(orbis, type, type.name);
                            t.field(fieldName, {
                                type: whereType,
                                ...config
                            });
                        } else {
                            const enumDef = Object.entries(orbis.getMetadata().getTypes())
                                .find((entry) => entry[1] instanceof NexusEnumTypeDef && entry[1].value.members === type);

                            if (enumDef) {
                                const enumFilterType = generateNexusEnumFilter(orbis, enumDef[0]);
                                t.field(fieldName, {
                                    type: enumFilterType,
                                    ...config
                                });
                            } else {
                                throw new Error(`Type of field "${fieldName}" on "${typeName}" can't be an unknown enum "${type}"`);
                            }
                        }
                    }

                    t.field('AND', {
                        type: `${typeName}WhereInput`,
                        list: true,
                        nullable: true
                    });
                    t.field('OR', {
                        type: `${typeName}WhereInput`,
                        list: true,
                        nullable: true
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
            t.field('equals', {
                type: enumTypeName,
                nullable: true
            });
            t.field('not', {
                type: enumTypeName,
                nullable: true
            });
            t.field('in', {
                type: enumTypeName,
                list: true,
                nullable: true
            });
            t.field('notIn', {
                type: enumTypeName,
                list: true,
                nullable: true
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
                        const type = resolveFieldType(field);

                        const config: CommonFieldConfig = {
                            nullable: true
                        };

                        if (field.graphql === false || field.resolve) {
                            continue;
                        }

                        if (Array.isArray(type)) {
                            // TODO: handle array ordering
                            continue;
                        }

                        if (type === Boolean || type === Number || type === String || type === Date) {
                            t.field(fieldName, {
                                type: 'OrderByArg',
                                ...config
                            });
                        } else if (typeof type === 'function') {
                            const orderByType = generateNexusOrderByInputObject(orbis, type, type.name);
                            t.field(fieldName, {
                                type: orderByType,
                                ...config
                            });
                        } else {
                            // Enum
                            t.field(fieldName, {
                                type: 'OrderByArg',
                                ...config
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
                        let type = resolveFieldType(field);

                        const config: CommonFieldConfig = {
                            nullable: isUpdate || !!field.nullable
                        };

                        if (field.graphql === false || field.resolve) {
                            continue;
                        }

                        if (!isUpdate) {
                            // Columns with defaults or generated values are not required
                            if (isGeneratedField(field)) {
                                config.nullable = true;
                            }

                            // One-to-many and many-to-many relations are initialized to an empty list by default
                            if (field.relation && Array.isArray(type)) {
                                config.nullable = true;
                            }

                            // Check if the field is generated by entity create metadata
                            const entity = orbis.getMetadata().getEntity(typeName);
                            const globalEntityMetadata = orbis.getOption('entity', {});
                            if (entity) {
                                if ((globalEntityMetadata.create && globalEntityMetadata.create[fieldName]) || (entity.create && entity.create[fieldName])) {
                                    config.nullable = true;
                                }
                            }
                        }

                        if (Array.isArray(type)) {
                            type = type[0];
                            config.list = true;
                        }

                        if (type === Boolean) {
                            t.boolean(fieldName, config);
                        } else if (type === Number) {
                            if (field.float) {
                                t.int(fieldName, config);
                            } else {
                                t.float(fieldName, config);
                            }
                        } else if (type === String) {
                            t.string(fieldName, config);
                        } else if (type === Date) {
                            if (field.column && field.column.options.type) {
                                const columnType = field.column.options.type.toString();
                                if (columnType.startsWith('timestamp') || columnType.startsWith('datetime')) {
                                    t.field(fieldName, {
                                        type: 'DateTime',
                                        ...config
                                    });
                                } else if (columnType.startsWith('date')) {
                                    t.field(fieldName, {
                                        type: 'Date',
                                        ...config
                                    });
                                } else if (columnType.startsWith('time')) {
                                    t.field(fieldName, {
                                        type: 'Time',
                                        ...config
                                    });
                                }
                            } else {
                                // TODO: add config option, similar to float
                                t.field(fieldName, {
                                    type: 'DateTime',
                                    ...config
                                });
                            }
                        } else if (typeof type === 'function') {
                            if (field.relation) {
                                // Relation
                                const mutationType = generateNexusRelationInputObject(orbis, type.name, isUpdate);
                                t.field(fieldName, {
                                    type: mutationType,
                                    ...config
                                });
                            } else {
                                // Embedded entity
                                const mutationType = generateNexusMutationInputObject(orbis, type, type.name, isUpdate);
                                t.field(fieldName, {
                                    type: mutationType,
                                    ...config
                                });
                            }
                        } else {
                            const enumDef = Object.values(orbis.getMetadata().getTypes())
                                .find((typeDef) => typeDef instanceof NexusEnumTypeDef && typeDef.value.members === type);

                            if (enumDef) {
                                t.field(fieldName, {
                                    type: enumDef as NexusEnumTypeDef<string>,
                                    ...config
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
            t.field('create', {
                type: `${typeName}CreateInput`,
                nullable: true
            });

            t.field('connect', {
                type: `${typeName}WhereUniqueInput`,
                nullable: true
            });

            if (isUpdate) {
                t.field('disconnect', {
                    type: `${typeName}WhereUniqueInput`,
                    nullable: true
                });
            }
        }
    }));
};
