// import {ProviderType} from '../entities';

import {BaseProvider, ProviderResponse} from './BaseProvider';
// import {ProviderGoogle} from './Google';

export {
    BaseProvider,
    ProviderResponse
};

export const providers: {[k: string]: BaseProvider} = {
    // [ProviderType.GOOGLE]: new ProviderGoogle()
};
