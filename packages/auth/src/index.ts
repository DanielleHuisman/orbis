export * from './config';
export * from './entities';
export * from './module';
export * from './providers';

import * as entitiesMap from './entities';
export const entities = Object.values(entitiesMap);
