import {Constructor} from 'orbis-server';

import {BaseUser} from './entities';

let userType: Constructor<BaseUser> = BaseUser;

export const getUserType = () => userType;
export const setUserType = (type: Constructor<BaseUser>) => {
    userType = type;
};
