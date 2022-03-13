import {BaseEntity, Entity} from 'typeorm';
import {firstLower, firstUpper, fixNullPrototypes, hasPrototype, isEntity} from './util';

test('firstLower', () => {
    expect(firstLower('abc')).toBe('abc');
    expect(firstLower('ABC')).toBe('aBC');
    expect(firstLower('dEF')).toBe('dEF');
    expect(firstLower('DEf')).toBe('dEf');
    expect(firstLower('6a')).toBe('6a');
    expect(firstLower('-z')).toBe('-z');
    expect(firstLower('äa')).toBe('äa');
    expect(firstLower('Ëe')).toBe('ëe');
});

test('firstUpper', () => {
    expect(firstUpper('abc')).toBe('Abc');
    expect(firstUpper('ABC')).toBe('ABC');
    expect(firstUpper('dEF')).toBe('DEF');
    expect(firstUpper('DEf')).toBe('DEf');
    expect(firstUpper('6a')).toBe('6a');
    expect(firstUpper('-z')).toBe('-z');
    expect(firstUpper('äa')).toBe('Äa');
    expect(firstUpper('Ëe')).toBe('Ëe');
});

test('hasPrototype', () => {
    class A {}
    class B extends A {}

    const a = new A();
    const b = new B();

    expect(() => hasPrototype(undefined, null)).toThrow(TypeError);
    expect(() => hasPrototype(null, null)).toThrow(TypeError);
    expect(hasPrototype({}, null)).toBe(true);
    expect(hasPrototype({}, Object)).toBe(false);
    expect(hasPrototype([], null)).toBe(true);
    expect(hasPrototype([], Array)).toBe(false);
    expect(hasPrototype('', String)).toBe(false);

    expect(hasPrototype(a, null)).toBe(true);
    expect(hasPrototype(a, Object)).toBe(false);
    expect(hasPrototype(a, A)).toBe(false);
    expect(hasPrototype(A, null)).toBe(true);

    expect(hasPrototype(b, null)).toBe(true);
    expect(hasPrototype(b, Object)).toBe(false);
    expect(hasPrototype(b, A)).toBe(false);
    expect(hasPrototype(b, B)).toBe(false);
    expect(hasPrototype(B, A)).toBe(true);
    expect(hasPrototype(B, B)).toBe(false);
});

test('fixNullPrototypes', () => {
    const obj = {
        object: {},
        nullObject: Object.create(null),
        nestedNullObject: {
            nullObject: Object.create(null)
        }
    };

    expect(Object.getPrototypeOf(obj.object)).not.toBeNull();
    expect(Object.getPrototypeOf(obj.nullObject)).toBeNull();
    expect(Object.getPrototypeOf(obj.nestedNullObject)).not.toBeNull();
    expect(Object.getPrototypeOf(obj.nestedNullObject.nullObject)).toBeNull();

    fixNullPrototypes(obj);

    expect(Object.getPrototypeOf(obj.object)).not.toBeNull();
    expect(Object.getPrototypeOf(obj.nullObject)).not.toBeNull();
    expect(Object.getPrototypeOf(obj.nestedNullObject)).not.toBeNull();
    expect(Object.getPrototypeOf(obj.nestedNullObject.nullObject)).not.toBeNull();
});

test('isEntity', () => {
    class EntityA extends BaseEntity {}

    @Entity()
    class EntityB {}

    expect(isEntity(Object)).toBe(false);
    expect(isEntity(BaseEntity)).toBe(false);
    expect(isEntity(EntityA)).toBe(true);
    expect(isEntity(EntityB)).toBe(true);
});
