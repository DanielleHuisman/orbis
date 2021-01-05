import {getUserType, setUserType} from './config';
import {BaseUser} from './entities/BaseUser';

describe('User type', () => {
    test('getUserType should return BaseUser by default', () => {
        expect(getUserType()).toEqual(BaseUser);
    });

    test('getUserType should return the value passed to setUserType', () => {
        class UserType extends BaseUser {}

        setUserType(UserType);

        expect(getUserType()).toEqual(UserType);
    });
});
