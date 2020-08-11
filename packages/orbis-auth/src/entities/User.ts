import {Entity, OneToMany} from 'typeorm';
import {Relation} from 'orbis-server';

import {orbis} from '../orbis';

import {Provider} from './Provider';

@Entity()
export abstract class User {

    @orbis.Field(() => [Provider])
    @OneToMany(() => Provider, (provider) => provider.user, {lazy: true})
    providers: Relation<Provider[]>;
}

export const BaseUser = User;
