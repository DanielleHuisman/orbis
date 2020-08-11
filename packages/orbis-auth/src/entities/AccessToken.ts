import {orbis} from '../orbis';

@orbis.Object()
export class AccessToken {

    @orbis.Field()
    accessToken: string;

    @orbis.Field()
    expiresIn: number;
}
