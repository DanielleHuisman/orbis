import {Entity, PrimaryColumn, Column, ManyToOne} from 'typeorm';
import {Relation} from 'orbis-server';

import {orbis} from '../orbis';

import {User} from './User';

export enum ProviderType {
    LOCAL = 'LOCAL',
    GOOGLE = 'GOOGLE'
}

orbis.registerEnumType({
    name: 'ProviderType',
    members: ProviderType
});

@orbis.Object()
@Entity()
export class Provider {

    @orbis.Field()
    @PrimaryColumn()
    id: string;

    @orbis.Field(() => ProviderType)
    @Column({type: 'enum', enum: ProviderType})
    type: ProviderType;

    @orbis.Field({graphql: false})
    @Column({type: 'varchar', length: 255})
    identifier: string;

    @orbis.Field({graphql: false})
    @Column({type: 'text'})
    credentials: string;

    @orbis.Field()
    @Column({type: 'varchar', length: 255})
    email: string;

    @orbis.Field()
    @Column({type: 'boolean', default: () => 'false'})
    isVerified: boolean;

    @orbis.Field(() => User)
    @ManyToOne(() => User, (user) => user.providers, {onDelete: 'CASCADE', lazy: true})
    user: Relation<User>;
}
