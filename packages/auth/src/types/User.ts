import {extendType} from '@nexus/schema';

import {AuthContext} from '../authentication';

export const QueryAuthUser = extendType({
    type: 'Query',
    definition(t) {
        t.field('me', {
            type: 'User',
            nullable: true,
            resolve(_root, _args, context: AuthContext) {
                return context.user;
            }
        });
    }
});
