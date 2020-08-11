import {arg, intArg, extendType} from '@nexus/schema';
import {NexusObjectTypeDef, objectType} from '@nexus/schema/dist/core';

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
            t.field('values', {
                type: Type,
                nullable: false,
                list: true
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
                t.field(metadata.singularName, {
                    type: Type,
                    nullable: false,
                    args: {
                        where: arg({
                            type: `${Type.name}WhereUniqueInput`,
                            nullable: false
                        })
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
                t.field(metadata.pluralName, {
                    type: ListType,
                    nullable: false,
                    args: {
                        where: `${Type.name}WhereInput`,
                        orderBy: `${Type.name}OrderByInput`,
                        skip: intArg({
                            nullable: true
                        }),
                        take: intArg({
                            nullable: true
                        })
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
