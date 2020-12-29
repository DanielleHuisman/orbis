import {arg, intArg, extendType, nonNull, nullable} from 'nexus';
import {NexusObjectTypeDef, objectType} from 'nexus/dist/core';

import {Orbis} from '../orbis';
import {EntityMetadata} from '../metadata';
import {fixNullPrototypes, shouldGenerateField} from '../util';

import {findOne} from './findOne';
import {findMany} from './findMany';
import {parseOrderByInfo, parseRelationsInfo} from './info';

export * from './field';
export * from './findOne';
export * from './findFirst';
export * from './findMany';
export * from './info';
export * from './list';

export const generateNexusQueries = (orbis: Orbis, Type: NexusObjectTypeDef<string>, metadata: EntityMetadata) => {
    // Generate list type
    const ListType = objectType({
        name: `${Type.name}List`,
        definition(t) {
            t.field('info', {
                type: 'ListInfo'
            });
            t.nonNull.list.nonNull.field('values', {
                type: Type
            });
        }
    });

    // Store type
    orbis.getMetadata().addType(ListType);

    // Generate find one field
    if (shouldGenerateField(orbis, Type.name, 'query', 'findOne')) {
        orbis.getMetadata().addTypeByName(`Query${Type.name}FindOne`, extendType({
            type: 'Query',
            definition(t) {
                t.nonNull.field(metadata.singularName, {
                    type: Type,
                    args: {
                        where: nonNull(arg({
                            type: `${Type.name}WhereUniqueInput`
                        }))
                    },
                    async resolve(_root, args, context, info) {
                        fixNullPrototypes(args);

                        const entity = await findOne(orbis, metadata, {
                            ...args,
                            relations: parseRelationsInfo(orbis, info, metadata)
                        }, {
                            context,
                            notFoundError: true
                        });

                        return entity;
                    }
                });
            }
        }));
    }

    // Generate find many field
    if (shouldGenerateField(orbis, Type.name, 'query', 'findMany')) {
        orbis.getMetadata().addTypeByName(`Query${Type.name}FindMany`, extendType({
            type: 'Query',
            definition(t) {
                t.nonNull.field(metadata.pluralName, {
                    type: ListType,
                    args: {
                        where: `${Type.name}WhereInput`,
                        orderBy: `${Type.name}OrderByInput`,
                        skip: nullable(intArg()),
                        take: nullable(intArg())
                    },
                    async resolve(_root, args, context, info) {
                        fixNullPrototypes(args);

                        return await findMany(orbis, metadata, {
                            ...args,
                            orderBy: args.orderBy ? parseOrderByInfo(args.orderBy, info) : null,
                            relations: parseRelationsInfo(orbis, info, metadata)
                        }, {
                            context
                        });
                    }
                });
            }
        }));
    }
};
