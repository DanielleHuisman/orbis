import {BaseEntity, Brackets, SelectQueryBuilder, WhereExpressionBuilder} from 'typeorm';

import {Orbis} from '../orbis';
import {resolveFieldType} from '../fields';
import {IntFilter, FloatFilter, StringFilter, DateTimeFilter, EnumFilter} from '../types';

import {relationPathToVarName} from './relations';

// TODO: find a way to have correct where typing (typegen?)

export type WhereArgument = {
    [key: string]: boolean | IntFilter | FloatFilter | StringFilter | DateTimeFilter | EnumFilter | WhereArgument | WhereArgument[];
};

export type UniqueWhereArgument = {
    [key: string]: boolean | number | string;
};

const OPERATORS: {[k: string]: string} = {
    equals: '=',
    not: '!=',
    lt: '<',
    lte: '<=',
    gt: '>',
    gte: '>=',
    contains: 'ILIKE',
    startsWith: 'ILIKE',
    endsWith: 'ILIKE'
};
const OPERATOR_VALUE_MODIFIERS: {[k: string]: (value: string) => string} = {
    contains: (value) => `%${value}%`,
    startsWith: (value) => `${value}%`,
    endsWith: (value) => `%${value}`
};
const CUSTOM_OPERATORS: {[k: string]: (qb: WhereExpressionBuilder, varField: string, varValue: string, value: unknown) => void} = {
    equals: (q, varField, varValue, value) => {
        if (value === null) {
            q.andWhere(`${varField} IS NULL`);
        } else {
            q.andWhere(`${varField} = :${varValue}`, {
                [varValue]: value
            });
        }
    },
    not: (q, varField, varValue, value) => {
        if (value === null) {
            q.andWhere(`${varField} IS NOT NULL`);
        } else {
            q.andWhere(`${varField} != :${varValue}`, {
                [varValue]: value
            });
        }
    },
    in: (q, varField, varValue, value) => {
        q.andWhere(`${varField} IN (:...${varValue})`, {
            [varValue]: value
        });
    },
    notIn: (q, varField, varValue, value) => {
        q.andWhere(`${varField} NOT IN (:...${varValue})`, {
            [varValue]: value
        });
    }
};

export const parseUniqueWhereArgument = (varName: string, qb: WhereExpressionBuilder, where: UniqueWhereArgument) => {
    for (const [fieldName, fieldValue] of Object.entries(where)) {
        qb.andWhere(`${varName}.${fieldName} = :${fieldName}`, {
            [fieldName]: fieldValue
        });
    }
};

type VarIndices = {
    [fieldName: string]: number;
};

export const parseWhereArgument = (
    orbis: Orbis,
    typeName: string,
    varPath: string,
    mainQb: SelectQueryBuilder<BaseEntity>,
    qb: WhereExpressionBuilder,
    where: WhereArgument,
    varNameIndices: VarIndices = {},
    varName: string = varPath
) => {
    if (where.AND || where.OR) {
        if (Object.keys(where).length > 1) {
            throw new Error('Keywords AND and OR can not be used in combination with each other or fields.');
        }

        if (where.AND) {
            if (!Array.isArray(where.AND)) {
                throw new Error('Keyword AND needs have an array as value.');
            }

            for (const andWhere of where.AND) {
                qb.andWhere(new Brackets((q) => parseWhereArgument(orbis, typeName, varPath, mainQb, q, andWhere, varNameIndices, varName)));
            }
        } else if (where.OR) {
            if (!Array.isArray(where.OR)) {
                throw new Error('Keyword OR need have an array as value.');
            }

            for (const orWhere of where.OR) {
                qb.orWhere(new Brackets((q) => parseWhereArgument(orbis, typeName, varPath, mainQb, q, orWhere, varNameIndices, varName)));
            }
        }
    } else {
        for (const [fieldName, fieldValue] of Object.entries(where)) {
            if (!orbis.getMetadata().hasField(typeName, fieldName)) {
                throw new Error(`Unknown input field "${fieldName}"`);
            }

            // Find field and field type
            const field = orbis.getMetadata().getField(typeName, fieldName);
            let fieldType = resolveFieldType(field);
            if (Array.isArray(fieldType)) {
                fieldType = fieldType[0];
            }

            // Determine field variable path
            const fieldVarPath = `${varName}.${fieldName}`;

            if (fieldType === Boolean || fieldType === Number || fieldType === String || fieldType === Date || typeof fieldType === 'object') {
                // Create variable index if necesarry
                if (!varNameIndices[fieldName]) {
                    varNameIndices[fieldName] = 1;
                }

                let modifiedFieldValue = fieldValue;
                if (fieldType === Boolean) {
                    modifiedFieldValue = {
                        equals: fieldValue
                    };
                }

                for (const [operatorName, operatorValue] of Object.entries(modifiedFieldValue) as [string, string][]) {
                    // Determine field variable name
                    const fieldVarName = `${fieldName}${varNameIndices[fieldName]}`;

                    if (CUSTOM_OPERATORS[operatorName]) {
                        CUSTOM_OPERATORS[operatorName](qb, fieldVarPath, fieldVarName, operatorValue);
                    } else if (OPERATORS[operatorName]) {
                        qb.andWhere(`${fieldVarPath} ${OPERATORS[operatorName]} :${fieldVarName}`, {
                            [fieldVarName]: OPERATOR_VALUE_MODIFIERS[operatorName] ?
                                OPERATOR_VALUE_MODIFIERS[operatorName](operatorValue) : operatorValue
                        });
                    } else {
                        throw new Error(`Unsupported operator "${operatorName}"`);
                    }

                    // Increment variable index
                    varNameIndices[fieldName]++;
                }
            } else {
                const fieldValueWhere = fieldValue as WhereArgument;

                // Check if the relation is an actual entity or embedded entity
                const isEmbeddedEntity = !orbis.getMetadata().hasEntity(fieldType.name);

                if (isEmbeddedEntity) {
                    // Parse where argument of the embedded entity relation
                    parseWhereArgument(orbis, fieldType.name, fieldVarPath, mainQb, qb, fieldValueWhere, varNameIndices, fieldVarPath);
                } else {
                    if (!field.relation) {
                        throw new Error(`Field "${fieldName}" is not a relation.`);
                    }

                    // Determine relation variable name
                    const relationVarName = relationPathToVarName(fieldVarPath);

                    // Create variable index if necesarry
                    if (!varNameIndices[relationVarName]) {
                        varNameIndices[relationVarName] = 1;
                    }

                    // Determine field variable name
                    let fieldVarName = `${relationVarName}${varNameIndices[relationVarName]}`;

                    // Add where prefix if necessary
                    if (!fieldVarName.startsWith('where__')) {
                        fieldVarName = `where__${fieldVarName}`;
                    }

                    // Increment variable index
                    varNameIndices[relationVarName]++;

                    // Join the relation
                    mainQb.innerJoin(fieldVarPath, fieldVarName);

                    // TODO: handle other relation types (see inputObjects)

                    // Parse where argument of the relation
                    let relationWhere: WhereArgument | null;
                    if (field.relation.relationType === 'many-to-one') {
                        if (fieldValueWhere.isNull) {
                            qb.andWhere(`${varName}.${fieldName} IS NULL`);
                        } else if (fieldValueWhere.notIsNull) {
                            qb.andWhere(`${varName}.${fieldName} IS NOT NULL`);
                        } else {
                            relationWhere = fieldValueWhere.matches as WhereArgument;
                        }
                    }

                    if (relationWhere) {
                        parseWhereArgument(orbis, fieldType.name, fieldVarPath, mainQb, qb, relationWhere, varNameIndices, fieldVarName);
                    }
                }
            }
        }
    }

    return qb;
};
