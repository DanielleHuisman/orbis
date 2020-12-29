import {extendType} from 'nexus';

import {AuthContext} from '../authentication';
import {getUserType} from '../config';

export const generateTypes = () => ({
    QueryAuthUser: extendType({
        type: 'Query',
        definition(t) {
            t.nullable.field('me', {
                type: getUserType().name,
                resolve(_root, _args, context: AuthContext) {
                    return context.user;
                }
            });
        }
    })
});
