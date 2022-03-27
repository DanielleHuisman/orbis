import {intArg, nullable} from 'nexus';
import {CommonFieldConfig, OutputDefinitionBlock} from 'nexus/dist/core';

import {Orbis} from '../orbis';
import {WhereArgument} from '../arguments';
import {fixNullPrototypes} from '../util';

import {parseOrderByInfo, parseRelationsInfo} from './info';
import {resolveList} from './list';

export const generateNexusRelationListField = (
    orbis: Orbis,
    t: OutputDefinitionBlock<string>,
    typeName: string,
    fieldName: string,
    fieldTypeName: string,
    overrideConfig?: CommonFieldConfig
) => {
    t.nonNull.field(fieldName, {
        type: `${fieldTypeName}List`,
        args: {
            where: `${fieldTypeName}WhereInput`,
            orderBy: `${fieldTypeName}OrderByInput`,
            skip: nullable(intArg()),
            take: nullable(intArg())
        },
        async resolve(root, args, context, info) {
            fixNullPrototypes(args);

            const fieldEntity = orbis.getMetadata().getEntity(fieldTypeName);

            // Check if the field is simple, i.e. no arguments and no entity scope
            if (Object.keys(args).length === 0 && !fieldEntity.scope) {
                const values = await root[fieldName];

                return {
                    info: {
                        count: values.length
                    },
                    values
                };
            }

            // Find entity and relation metadata
            const entityMetadata = orbis.getDataSource().entityMetadatas.find((e) => e.name === typeName);
            const relationMetadata = entityMetadata.relations.find((relation) => relation.propertyName === fieldName);

            // Generate where argument for the relation
            // TODO: ID might not be a primary key
            // TODO: handle different relation types (see inputObjects)
            let whereList: WhereArgument[] = [{
                [relationMetadata.inverseRelation.propertyName]: relationMetadata.relationType === 'one-to-many' ? {
                    matches: {
                        id: {
                            equals: root.id
                        }
                    }
                } : {
                    id: {
                        equals: root.id
                    }
                }
            }];

            // Handle entity scope
            if (fieldEntity.scope) {
                const whereScope = fieldEntity.scope(context);

                if (Array.isArray(whereScope)) {
                    whereList = whereList.concat(whereScope);
                } else if (whereScope) {
                    if (Object.keys(whereScope).length > 0) {
                        whereList.push(whereScope);
                    }
                }
            }

            // Handle arguments
            if (args.where) {
                whereList.push(args.where);
            }

            // Resolve list
            return await resolveList(orbis, fieldEntity, {
                ...args,
                where: whereList.length === 1 ? whereList[0] : {AND: whereList},
                orderBy: args.orderBy ? parseOrderByInfo(args.orderBy, info) : null,
                relations: parseRelationsInfo(orbis, info, fieldEntity)
            });
        },
        ...overrideConfig
    });
};
