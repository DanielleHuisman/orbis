import {Entity, BaseEntity, PrimaryColumn, Column, ManyToOne} from 'typeorm';
import {Relation} from '@orbis-framework/core';

import {orbis} from '../orbis';

import {Provider} from './Provider';

export enum TokenType {
    VERIFY_EMAIL = 'VERIFY_EMAIL',
    RESET_PASSWORD = 'RESET_PASSWORD'
}

orbis.registerEnumType({
    name: 'TokenType',
    members: TokenType
});

@orbis.Object()
@Entity()
export class Token extends BaseEntity {

    @orbis.Field()
    @PrimaryColumn()
    id: string;

    @orbis.Field(() => TokenType)
    @Column({type: 'enum', enum: TokenType})
    type: TokenType;

    @orbis.Field()
    @Column({type: 'varchar', length: 32, unique: true})
    token: string;

    @orbis.Field()
    @Column({type: 'timestamp'})
    expiresAt: Date;

    @orbis.Field(() => Provider)
    @ManyToOne(() => Provider, {onDelete: 'CASCADE', lazy: true})
    provider: Relation<Provider>;

    isExpired() {
        return new Date() >= this.expiresAt;
    }
}
