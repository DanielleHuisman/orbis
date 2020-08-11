import {GraphQLDate, GraphQLTime, GraphQLDateTime} from 'graphql-iso-date';

import {registerEnumType} from './enums';
import {OrbisField} from './fields';
import {OrbisInputObject} from './inputObjects';
import {OrbisObject} from './objects';
import {registerScalarType} from './scalars';

// Add date and time scalars
registerScalarType(GraphQLDate);
registerScalarType(GraphQLTime);
registerScalarType(GraphQLDateTime);

// Export date and time scalars
export {
    GraphQLDate as ScalarDate,
    GraphQLTime as ScalarTime,
    GraphQLDateTime as ScalarDateTime
};

export enum OrderByArg {
    ASC = 'ASC',
    DESC = 'DESC'
}

registerEnumType({
    name: 'OrderByArg',
    members: OrderByArg
});

@OrbisInputObject()
export class IntFilter {

    @OrbisField({nullable: true})
    equals?: number;

    @OrbisField({nullable: true})
    not?: number;

    @OrbisField(() => [Number], {nullable: true})
    in?: number[];

    @OrbisField(() => [Number], {nullable: true})
    notIn?: number[];

    @OrbisField({nullable: true})
    lt?: number;

    @OrbisField({nullable: true})
    lte?: number;

    @OrbisField({nullable: true})
    gt?: number;

    @OrbisField({nullable: true})
    gte?: number;
}

@OrbisInputObject()
export class FloatFilter {

    @OrbisField({float: true, nullable: true})
    equals?: number;

    @OrbisField({float: true, nullable: true})
    not?: number;

    @OrbisField(() => [Number], {float: true, nullable: true})
    in?: number[];

    @OrbisField(() => [Number], {float: true, nullable: true})
    notIn?: number[];

    @OrbisField({float: true, nullable: true})
    lt?: number;

    @OrbisField({float: true, nullable: true})
    lte?: number;

    @OrbisField({float: true, nullable: true})
    gt?: number;

    @OrbisField({float: true, nullable: true})
    gte?: number;
}

@OrbisInputObject()
export class StringFilter {

    @OrbisField({nullable: true})
    equals?: string;

    @OrbisField({nullable: true})
    not?: string;

    @OrbisField(() => [String], {nullable: true})
    in?: string[];

    @OrbisField(() => [String], {nullable: true})
    notIn?: string[];

    @OrbisField({nullable: true})
    lt?: string;

    @OrbisField({nullable: true})
    lte?: string;

    @OrbisField({nullable: true})
    gt?: string;

    @OrbisField({nullable: true})
    gte?: string;

    @OrbisField({nullable: true})
    contains?: string;

    @OrbisField({nullable: true})
    startsWith?: string;

    @OrbisField({nullable: true})
    endsWith?: string;
}

@OrbisInputObject()
export class DateTimeFilter {

    @OrbisField({nullable: true})
    equals?: Date;

    @OrbisField({nullable: true})
    not?: Date;

    @OrbisField(() => [Date], {nullable: true})
    in?: Date[];

    @OrbisField(() => [Date], {nullable: true})
    notIn?: Date[];

    @OrbisField({nullable: true})
    lt?: Date;

    @OrbisField({nullable: true})
    lte?: Date;

    @OrbisField({nullable: true})
    gt?: Date;

    @OrbisField({nullable: true})
    gte?: Date;
}

@OrbisObject()
export class ListInfo {

    @OrbisField({nullable: false})
    count: number;
}
