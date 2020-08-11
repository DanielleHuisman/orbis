import {SelectQueryBuilder, BaseEntity} from 'typeorm';

// Replace all but the last dot with an underscore
export const relationPathToVarPath = (path: string) => path.replace(/\.(?=.*\.)/g, '_');

// Replace all dots with underscores
export const relationPathToVarName = (path: string) => path.replace(/\./g, '_');

export const parseRelations = (qb: SelectQueryBuilder<BaseEntity>, relations: string[]) => {
    // Join relations
    for (const relation of relations) {
        qb.leftJoinAndSelect(relationPathToVarPath(relation), relationPathToVarName(relation));
    }
};
