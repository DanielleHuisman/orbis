import {extendType, arg, intArg} from '@nexus/schema';
import {NexusObjectTypeDef} from '@nexus/schema/dist/core';

import {Orbis} from '../orbis';
import {EntityMetadata} from '../metadata';
import {parseRelationsInfo} from '../queries';
import {fixNullPrototypes, firstUpper, shouldGenerateField} from '../util';

import {createOne} from './createOne';
import {updateOne} from './updateOne';
import {deleteOne} from './deleteOne';
import {deleteMany} from './deleteMany';

export * from './createOne';
export * from './updateOne';
export * from './deleteOne';
export * from './deleteMany';

export const generateNexusMutations = (orbis: Orbis, Type: NexusObjectTypeDef<string>, metadata: EntityMetadata) => {
    // Generate create one field
    if (shouldGenerateField(orbis, Type.name, 'mutation', 'createOne')) {
        orbis.getMetadata().addTypeByName(`Mutation${Type.name}CreateOne`, extendType({
            type: 'Mutation',
            definition(t) {
                t.field(`create${firstUpper(metadata.singularName)}`, {
                    type: Type,
                    nullable: false,
                    args: {
                        data: arg({
                            type: `${Type.name}CreateInput`,
                            nullable: false
                        })
                    },
                    async resolve(_root, args, context, info) {
                        fixNullPrototypes(args);

                        return await createOne(orbis, metadata, {
                            ...args,
                            relations: parseRelationsInfo(orbis, info, metadata)
                        }, {
                            context
                        });
                    }
                });
            }
        }));
    }

    // Generate update one field
    if (shouldGenerateField(orbis, Type.name, 'mutation', 'updateOne')) {
        orbis.getMetadata().addTypeByName(`Mutation${Type.name}UpdateOne`, extendType({
            type: 'Mutation',
            definition(t) {
                t.field(`update${firstUpper(metadata.singularName)}`, {
                    type: Type,
                    nullable: false,
                    args: {
                        where: arg({
                            type: `${Type.name}WhereUniqueInput`,
                            nullable: false
                        }),
                        data: arg({
                            type: `${Type.name}UpdateInput`,
                            nullable: false
                        })
                    },
                    async resolve(_root, args, context, info) {
                        fixNullPrototypes(args);

                        return await updateOne(orbis, metadata, {
                            ...args,
                            relations: parseRelationsInfo(orbis, info, metadata)
                        }, {
                            context
                        });
                    }
                });
            }
        }));
    }

    // Generate delete one field
    if (shouldGenerateField(orbis, Type.name, 'mutation', 'deleteOne')) {
        orbis.getMetadata().addTypeByName(`Mutation${Type.name}DeleteOne`, extendType({
            type: 'Mutation',
            definition(t) {
                t.field(`delete${firstUpper(metadata.singularName)}`, {
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

                        return await deleteOne(orbis, metadata, {
                            ...args,
                            relations: parseRelationsInfo(orbis, info, metadata)
                        }, {
                            context
                        });
                    }
                });
            }
        }));
    }

    // Generate delete many field
    if (shouldGenerateField(orbis, Type.name, 'mutation', 'deleteMany')) {
        orbis.getMetadata().addTypeByName(`Mutation${Type.name}DeleteMany`, extendType({
            type: 'Mutation',
            definition(t) {
                t.field(`delete${firstUpper(metadata.pluralName)}`, {
                    type: `${Type.name}List`,
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

                        return await deleteMany(orbis, metadata, {
                            ...args,
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
