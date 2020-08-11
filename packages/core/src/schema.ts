import * as yup from 'yup';

import {Orbis} from './orbis';
import {resolveFieldType} from './fields';
import {isGeneratedField, YupCommonSchema} from './util';

export const generateYupSchemas = (orbis: Orbis) => {
    // Generate Yup schemas for interfaces
    for (const [name, metadata] of Object.entries(orbis.getMetadata().getInterfaces())) {
        // Generate Yup schema
        let schema = yup.object();
        schema = generateYupSchema(orbis, name, schema);

        // Extend Yup schema if needed
        if (metadata.schema) {
            schema = metadata.schema(schema, yup);
        }

        // Store schema
        orbis.getMetadata().addSchema(name, schema);
    }

    // Generate Yup schemas for objects
    for (const [name, metadata] of Object.entries(orbis.getMetadata().getObjects())) {
        let schema = yup.object();

        // Concat Yup schemas of interfaces
        for (const i of metadata.implements) {
            schema = schema.concat(orbis.getMetadata().getSchema(i.name));
        }

        // Generate Yup schema
        schema = generateYupSchema(orbis, name, schema);

        // Extend Yup schema if needed
        if (metadata.schema) {
            schema = metadata.schema(schema, yup);
        }

        // Store schema
        orbis.getMetadata().addSchema(name, schema);
    }

    // Add nested schemas for embedded entities
    for (const name of Object.keys(orbis.getMetadata().getObjects())) {
        const shape: yup.ObjectSchemaDefinition<object> = {};

        if (orbis.getMetadata().hasFields(name)) {
            for (const [fieldName, field] of Object.entries(orbis.getMetadata().getFields(name))) {
                if (field.resolve) {
                    continue;
                }

                let type = resolveFieldType(field);
                let isArray = false;

                if (Array.isArray(type)) {
                    type = type[0];
                    isArray = true;
                }

                if (typeof type === 'function' && !field.relation) {
                    let fieldShape = orbis.getMetadata().getSchema(type.name);

                    if (fieldShape) {
                        if (!field.nullable) {
                            fieldShape = fieldShape.required();
                        } else {
                            fieldShape = fieldShape.nullable();
                        }

                        shape[fieldName] = isArray ? yup.array().of(fieldShape.required()) : fieldShape;
                    }
                }
            }
        }

        // Update stored schema
        orbis.getMetadata().getSchema(name).shape(shape);
    }
};

export const generateYupSchema = (orbis: Orbis, typeName: string, schema: yup.ObjectSchema) => {
    const shape: yup.ObjectSchemaDefinition<object> = {};

    if (orbis.getMetadata().hasFields(typeName)) {
        for (const [fieldName, field] of Object.entries(orbis.getMetadata().getFields(typeName))) {
            if (field.resolve) {
                continue;
            }

            let type = resolveFieldType(field);
            let fieldShape: YupCommonSchema<any> = null;
            let isArray = false;

            if (Array.isArray(type)) {
                type = type[0];
                isArray = true;
            }

            if (type === Boolean) {
                fieldShape = yup.boolean();
            } else if (type === Number) {
                fieldShape = yup.number();
            } else if (type === String) {
                fieldShape = yup.string();

                if (field.column && field.column.options.length) {
                    fieldShape = (fieldShape as yup.StringSchema).max(parseInt(field.column.options.length.toString(), 10));
                }
            } else if (type === Date) {
                fieldShape = yup.date();
            } else if (typeof type === 'function') {
                if (field.relation) {
                    // TODO: relation validation?
                }
            } else {
                // Enum
                fieldShape = yup.string().oneOf(Object.values(type));
            }

            if (fieldShape) {
                if (!field.nullable) {
                    // Columns with defaults or generated values are not required
                    if (isGeneratedField(field)) {
                        fieldShape = fieldShape.nullable();
                    } else {
                        fieldShape = fieldShape.required();
                    }
                } else {
                    fieldShape = fieldShape.nullable();
                }

                shape[fieldName] = isArray ? yup.array().of(fieldShape.required()) : fieldShape;
            }
        }
    }

    return schema.shape(shape);
};
