import {firstLower} from './util';

test('firstLower', () => {
    expect(firstLower('abc')).toBe('abc');
    expect(firstLower('ABC')).toBe('aBC');
    expect(firstLower('dEF')).toBe('dEF');
    expect(firstLower('DEf')).toBe('dEf');
});
