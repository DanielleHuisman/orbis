import {OneToMany} from 'typeorm';
import {Relation} from '@orbis-framework/core';

import {orbis} from '../orbis';

import {Provider} from './Provider';

export abstract class BaseUser {

    @orbis.Field(() => [Provider])
    @OneToMany(() => Provider, (provider) => provider.user, {lazy: true})
    providers: Relation<Provider[]>;
}
