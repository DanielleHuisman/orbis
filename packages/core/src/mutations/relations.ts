import {DataArgument, UniqueWhereArgument} from '../arguments';
import {Orbis} from '../orbis';
import {resolveFieldType} from '../fields';
import {EntityMetadata} from '../metadata';
import {findOne} from '../queries/findOne';
import {OperationOptions} from '../util';

import {createEntity} from './createOne';

const VALID_CREATE_KEYS = ['create', 'connect'];
const VALID_UPDATE_KEYS = ['create', 'connect', 'disconnect'];

export const updateRelation = async <Entity>(
    orbis: Orbis,
    metadata: EntityMetadata,
    fieldName: string,
    fieldValue: {
        create?: DataArgument;
        connect?: UniqueWhereArgument;
        disconnect?: UniqueWhereArgument;
    },
    isUpdate: boolean = false,
    options: OperationOptions,
    entity?: Entity
) => {
    // Validate input data
    if (Object.keys(fieldValue).length !== 1 || !(isUpdate ? VALID_UPDATE_KEYS : VALID_CREATE_KEYS).includes(Object.keys(fieldValue)[0])) {
        throw new Error(`Updating a relation requires exactly one of create, connect or disconnect.`);
    }

    // Find relation type
    let relationType = resolveFieldType(orbis.getMetadata().getField(metadata.Entity.name, fieldName));
    if (Array.isArray(relationType)) {
        relationType = relationType[0];
    }
    if (typeof relationType !== 'function') {
        throw new Error('Relation can\'t be an enum.');
    }

    // Find other entity metadata
    const otherMetadata = orbis.getMetadata().getEntity(relationType.name);

    // Find entity repository
    const repository = orbis.getManager().getRepository(metadata.Entity);

    // Find entity and relation metadata
    const entityMetadata = orbis.getConnection().entityMetadatas.find((e) => e.name === metadata.Entity.name);
    const relationMetadata = entityMetadata.relations.find((relation) => relation.propertyName === fieldName);


    // Create query builder
    const qb = repository
        .createQueryBuilder(metadata.singularName)
        .relation(fieldName)
        .of(entity);

    if (fieldValue.create) {
        // Create other entity
        const identifier = await createEntity(orbis, otherMetadata, {
            data: fieldValue.create
        }, {
            context: options.context
        });

        // Connect entity
        if (entity) {
            if (relationMetadata.isManyToOne || relationMetadata.isOneToOne) {
                await qb.set(identifier);
            } else {
                await qb.add(identifier);
            }
        }

        return identifier;
    } else if (fieldValue.connect) {
        // Find other entity
        const otherEntity = await findOne<Entity>(orbis, otherMetadata, {
            where: fieldValue.connect
        }, {
            context: options.context,
            notFoundError: true
        });

        // Connect entity
        if (entity) {
            if (relationMetadata.isManyToOne || relationMetadata.isOneToOne) {
                await qb.set(otherEntity);
            } else {
                await qb.add(otherEntity);
            }
        }

        return repository.getId(otherEntity);
    } else if (isUpdate && fieldValue.disconnect) {
        if (!entity) {
            throw new Error('Entity can\'t be null when disconnecting.');
        }

        // Find other entity
        const otherEntity = await findOne<Entity>(orbis, otherMetadata, {
            where: fieldValue.disconnect
        }, {
            context: options.context,
            notFoundError: true
        });

        // Disconnect entity
        if (relationMetadata.isManyToOne || relationMetadata.isOneToOne) {
            await qb.set(null);
        } else {
            await qb.remove(otherEntity);
        }

        return repository.getId(otherEntity);
    }
};
