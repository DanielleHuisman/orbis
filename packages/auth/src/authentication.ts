import {Orbis} from '@orbis-framework/core';
import jwt from 'jsonwebtoken';

import {AccessToken, BaseUser} from './entities';
import {OrbisAuth} from './module';

export interface AuthContext {
    user?: BaseUser;
}

export const createAccessToken = (orbis: Orbis, user: BaseUser): AccessToken => {
    const options = orbis.getModule<OrbisAuth>('auth').getOptions();

    const accessToken = jwt.sign({}, options.jwt.secret, {
        expiresIn: options.jwt.expiresIn,
        subject: user.id,
        issuer: options.jwt.issuer,
        audience: options.jwt.audience
    });

    return {
        accessToken,
        expiresIn: options.jwt.expiresIn
    };
};
