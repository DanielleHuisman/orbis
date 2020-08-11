import {SelectQueryBuilder, BaseEntity} from 'typeorm';

import {Orbis} from '../orbis';
import {resolveFieldType} from '../fields';
import {OrderByArg} from '../types';

import {relationPathToVarName} from './relations';

// TODO: find a way to have correct orderBy typing (typegen?)

export type OrderByArgument = (string | (string | OrderByArg)[])[];

export const parseOrderByArgument = (
    orbis: Orbis,
    typeName: string,
    varName: string,
    qb: SelectQueryBuilder<BaseEntity>,
    orderBy: OrderByArgument,
    prefix = `${varName}.`
) => {
    for (const rule of orderBy) {
        let order: OrderByArg;
        let path: string[];
        if (typeof rule === 'string') {
            order = OrderByArg.ASC;
            path = [rule];
        } else {
            const last = rule[rule.length - 1];
            if (last.toLowerCase() === OrderByArg.ASC.toLowerCase()) {
                order = OrderByArg.ASC;
                path = rule.slice(0, rule.length - 1);
            } else if (last.toLowerCase() === OrderByArg.DESC.toLowerCase()) {
                order = OrderByArg.DESC;
                path = rule.slice(0, rule.length - 1);
            } else {
                throw new Error('Invalid order by argument');
            }
        }

        if (path.length === 0) {
            throw new Error('Invalid order by path');
        } else if (path.length === 1) {
            qb.addOrderBy(`${prefix}${path[0]}`, order);
        } else {
            let varPath = prefix;
            let currentTypeName = typeName;
            for (const fieldName of path) {
                // Find field and field type
                const field = orbis.getMetadata().getField(currentTypeName, fieldName);
                let fieldType = resolveFieldType(field);
                if (Array.isArray(fieldType)) {
                    fieldType = fieldType[0];
                }

                if (fieldType === Boolean || fieldType === Number || fieldType === String || fieldType === Date || typeof fieldType === 'object') {
                    varPath += fieldName;
                } else {
                    // Check if the relation is an actual entity or embedded entity
                    const isEmbeddedEntity = !orbis.getMetadata().hasEntity(fieldType.name);

                    if (isEmbeddedEntity) {
                        varPath += `${fieldName}.`;
                    } else {
                        // TODO: include relation if not available

                        varPath = `${relationPathToVarName(varPath + fieldName)}.`;
                    }

                    currentTypeName = fieldType.name;
                }
            }

            qb.addOrderBy(varPath, order);
        }
    }
};
