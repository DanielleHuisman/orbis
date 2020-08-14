import {GraphQLDate, GraphQLTime, GraphQLDateTime} from 'graphql-iso-date';

import {registerEnumType} from './enums';
import {Orbis} from './orbis';

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

export interface Filter<Type> {
    equals?: Type;
    not?: Type;
    in?: Type[];
    notIn?: Type[];
    lt?: Type;
    lte?: Type;
    gt?: Type;
    gte?: Type;
}

export type IntFilter = Filter<number>;
export type FloatFilter = Filter<number>;

export interface StringFilter extends Filter<string> {
    contains?: string;
    startsWith?: string;
    endsWith?: string;
}

export type DateTimeFilter = Filter<Date>;

export interface EnumFilter {
    equals?: any;
    not?: any;
    in?: any[];
    noIn?: any[];
}

export interface ListInfo {
    count: number;
}

export const registerOrbisTypes = (orbis: Orbis) => {
    orbis.registerScalarType(GraphQLDate);
    orbis.registerScalarType(GraphQLTime);
    orbis.registerScalarType(GraphQLDateTime);

    registerEnumType({
        name: 'OrderByArg',
        members: OrderByArg
    });

    @orbis.InputObject()
    class IntFilter {

        @orbis.Field({nullable: true})
        equals?: number;

        @orbis.Field({nullable: true})
        not?: number;

        @orbis.Field(() => [Number], {nullable: true})
        in?: number[];

        @orbis.Field(() => [Number], {nullable: true})
        notIn?: number[];

        @orbis.Field({nullable: true})
        lt?: number;

        @orbis.Field({nullable: true})
        lte?: number;

        @orbis.Field({nullable: true})
        gt?: number;

        @orbis.Field({nullable: true})
        gte?: number;
    }

    @orbis.InputObject()
    class FloatFilter {

        @orbis.Field({float: true, nullable: true})
        equals?: number;

        @orbis.Field({float: true, nullable: true})
        not?: number;

        @orbis.Field(() => [Number], {float: true, nullable: true})
        in?: number[];

        @orbis.Field(() => [Number], {float: true, nullable: true})
        notIn?: number[];

        @orbis.Field({float: true, nullable: true})
        lt?: number;

        @orbis.Field({float: true, nullable: true})
        lte?: number;

        @orbis.Field({float: true, nullable: true})
        gt?: number;

        @orbis.Field({float: true, nullable: true})
        gte?: number;
    }

    @orbis.InputObject()
    class StringFilter {

        @orbis.Field({nullable: true})
        equals?: string;

        @orbis.Field({nullable: true})
        not?: string;

        @orbis.Field(() => [String], {nullable: true})
        in?: string[];

        @orbis.Field(() => [String], {nullable: true})
        notIn?: string[];

        @orbis.Field({nullable: true})
        lt?: string;

        @orbis.Field({nullable: true})
        lte?: string;

        @orbis.Field({nullable: true})
        gt?: string;

        @orbis.Field({nullable: true})
        gte?: string;

        @orbis.Field({nullable: true})
        contains?: string;

        @orbis.Field({nullable: true})
        startsWith?: string;

        @orbis.Field({nullable: true})
        endsWith?: string;
    }

    @orbis.InputObject()
    class DateTimeFilter {

        @orbis.Field({nullable: true})
        equals?: Date;

        @orbis.Field({nullable: true})
        not?: Date;

        @orbis.Field(() => [Date], {nullable: true})
        in?: Date[];

        @orbis.Field(() => [Date], {nullable: true})
        notIn?: Date[];

        @orbis.Field({nullable: true})
        lt?: Date;

        @orbis.Field({nullable: true})
        lte?: Date;

        @orbis.Field({nullable: true})
        gt?: Date;

        @orbis.Field({nullable: true})
        gte?: Date;
    }

    @orbis.Object()
    class ListInfo {

        @orbis.Field({nullable: false})
        count: number;
    }

    // Hack to ignore "X is declared but never used." errors
    dummy(
        IntFilter,
        FloatFilter,
        StringFilter,
        DateTimeFilter,
        ListInfo
    );
};

const dummy = (..._args: unknown[]) => undefined;
