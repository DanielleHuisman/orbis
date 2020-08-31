import {extendType} from '@nexus/schema';

import {AuthContext} from '../authentication';
import {getUserType} from '../config';

export const generateTypes = () => ({
    QueryAuthUser: extendType({
        type: 'Query',
        definition(t) {
            t.field('me', {
                type: getUserType().name,
                nullable: true,
                resolve(_root, _args, context: AuthContext) {
                    return context.user;
                }
            });
        }
    })
});
