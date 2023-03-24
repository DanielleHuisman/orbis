import {
    isInputObjectType,
    GraphQLResolveInfo,
    GraphQLNonNull,
    GraphQLList,
    GraphQLInputObjectType,
    GraphQLObjectType,
    GraphQLOutputType,
    ObjectValueNode,
    SelectionSetNode
} from 'graphql';

import {Orbis} from '../orbis';
import {resolveFieldType} from '../fields';
import {EntityMetadata} from '../metadata';
import {OrderByArg} from '../types';

export type OrderByArgumentAsObject = {
    [key: string]: OrderByArg | OrderByArgumentAsObject;
};

export const parseOrderByInfo = (orderBy: OrderByArgumentAsObject, info: GraphQLResolveInfo) => {
    // Find type of this field and value info
    const fieldType = info.schema.getQueryType().getFields()[info.fieldName];

    const orderByInfo = info.fieldNodes[0].arguments.find((argument) => argument.name.value === 'orderBy').value as ObjectValueNode;
    const orderByType = fieldType.args.find((argument) => argument.name === 'orderBy').type as GraphQLInputObjectType;

    return parseOrderByInfoNode(orderBy, orderByInfo, orderByType);
};


const parseOrderByInfoNode = (orderBy: OrderByArgumentAsObject, info: ObjectValueNode, type: GraphQLInputObjectType, prefix: string[] = []) => {
    let result = [];

    for (const field of info.fields) {
        const fieldName = field.name.value;

        if (!type.getFields()[fieldName]) {
            throw new Error(`Unknown input field "${fieldName}"`);
        }

        const fieldType = type.getFields()[fieldName].type;

        if (isInputObjectType(fieldType)) {
            result = result.concat(
                parseOrderByInfoNode(orderBy[fieldName] as OrderByArgumentAsObject, field.value as ObjectValueNode, fieldType, [...prefix, fieldName])
            );
        } else {
            result.push([...prefix, fieldName, orderBy[fieldName]]);
        }
    }

    return result;
};

export const parseRelationsInfo = (orbis: Orbis, info: GraphQLResolveInfo, metadata: EntityMetadata) => {
    return parseSelectionSetRelations(orbis, info, info.returnType, info.fieldNodes[0].selectionSet, metadata, `${metadata.singularName}.`);
};

const parseSelectionSetRelations = (
    orbis: Orbis,
    info: GraphQLResolveInfo,
    type: GraphQLOutputType,
    selectionSet: SelectionSetNode,
    metadata: EntityMetadata,
    prefix: string
) => {
    let relations = [];

    // Remove non-null and list modifiers from the type
    while (type instanceof GraphQLNonNull || type instanceof GraphQLList) {
        type = type.ofType;
    }

    // Loop over all selections
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case 'Field': {
                if (type instanceof GraphQLObjectType) {
                    if (selection.name.value.startsWith('__')) {
                        continue;
                    }

                    // Find type of the field
                    const fieldType = type.getFields()[selection.name.value].type;

                    // Check if the field is a relation list
                    if (type.name.endsWith('List') && selection.name.value === 'values') {
                        relations = parseSelectionSetRelations(orbis, info, fieldType, selection.selectionSet, metadata, prefix);
                        continue;
                    }

                    // Check if the field is a relation
                    if (metadata.relations.includes(selection.name.value) && selection.selectionSet) {
                        // Skip relations with arguments
                        if (selection.arguments.length > 0) {
                            continue;
                        }

                        let subtype = resolveFieldType(orbis.getMetadata().getField(metadata.Entity.name, selection.name.value));
                        if (Array.isArray(subtype)) {
                            subtype = subtype[0];
                        }

                        if (typeof subtype === 'function') {
                            const submetadata = orbis.getMetadata().getEntity(subtype.name);

                            // Skip relations with entity scopes
                            if (submetadata.scope) {
                                continue;
                            }

                            // Add the relations if it isn't already included
                            if (!relations.includes(selection.name.value)) {
                                relations.push(`${prefix}${selection.name.value}`);
                            }

                            // Find subrelations in subselection
                            relations = relations.concat(
                                parseSelectionSetRelations(orbis, info, fieldType, selection.selectionSet, submetadata, `${prefix}${selection.name.value}.`)
                                    .filter((r) => !relations.includes(r))
                            );
                        }
                    }
                }
                break;
            }
            case 'FragmentSpread': {
                const fragment = info.fragments[selection.name.value];

                // Check if the fragment is for this type
                if (fragment.typeCondition.name.value !== type.name) {
                    continue;
                }

                // Find relations in fragment
                relations = relations.concat(
                    parseSelectionSetRelations(orbis, info, type, fragment.selectionSet, metadata, prefix).filter((r) => !relations.includes(r))
                );
                break;
            }
            case 'InlineFragment': {
                // Check if the fragment is for this type
                if (selection.typeCondition.name.value !== type.name) {
                    continue;
                }

                // Find relations in inline fragment
                relations = relations.concat(
                    parseSelectionSetRelations(orbis, info, type, selection.selectionSet, metadata, prefix).filter((r) => !relations.includes(r))
                );
                break;
            }
        }
    }

    return relations;
};
