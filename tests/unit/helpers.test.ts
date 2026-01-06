import { describe, it, expect } from 'vitest';
import {
  wait,
  chunkArray,
  safeStringValue,
  normalizeFields,
  joinFields,
  isSelectAll,
  deepClone,
  isPlainObject,
} from '../../src/utils/helpers';

describe('helpers', () => {
  describe('wait', () => {
    it('should wait for specified milliseconds', async () => {
      const start = Date.now();
      await wait(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('chunkArray', () => {
    it('should split array into chunks of specified size', () => {
      expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle empty array', () => {
      expect(chunkArray([], 2)).toEqual([]);
    });

    it('should handle array smaller than chunk size', () => {
      expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
    });

    it('should handle exact chunk size', () => {
      expect(chunkArray([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('safeStringValue', () => {
    it('should convert null to empty string', () => {
      expect(safeStringValue(null)).toBe('');
    });

    it('should convert undefined to empty string', () => {
      expect(safeStringValue(undefined)).toBe('');
    });

    it('should return string as-is', () => {
      expect(safeStringValue('hello')).toBe('hello');
    });

    it('should convert number to string', () => {
      expect(safeStringValue(123)).toBe('123');
    });

    it('should convert boolean to string', () => {
      expect(safeStringValue(true)).toBe('true');
      expect(safeStringValue(false)).toBe('false');
    });

    it('should JSON stringify objects', () => {
      expect(safeStringValue({ a: 1 })).toBe('{"a":1}');
    });
  });

  describe('normalizeFields', () => {
    it('should split comma-separated string into array', () => {
      expect(normalizeFields('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('should trim whitespace from fields', () => {
      expect(normalizeFields('a, b , c')).toEqual(['a', 'b', 'c']);
    });

    it('should return array as-is', () => {
      expect(normalizeFields(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('should handle single field', () => {
      expect(normalizeFields('*')).toEqual(['*']);
    });

    it('should handle empty string', () => {
      expect(normalizeFields('')).toEqual([]);
    });

    it('should filter out empty fields', () => {
      expect(normalizeFields('a,,b')).toEqual(['a', 'b']);
    });
  });

  describe('joinFields', () => {
    it('should join fields with comma', () => {
      expect(joinFields(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('should handle single field', () => {
      expect(joinFields(['a'])).toBe('a');
    });

    it('should handle empty array', () => {
      expect(joinFields([])).toBe('');
    });
  });

  describe('isSelectAll', () => {
    it('should return true for "*"', () => {
      expect(isSelectAll('*')).toBe(true);
    });

    it('should return true for ["*"]', () => {
      expect(isSelectAll(['*'])).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isSelectAll('')).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(isSelectAll([])).toBe(true);
    });

    it('should return false for specific fields string', () => {
      expect(isSelectAll('accountid,name')).toBe(false);
    });

    it('should return false for specific fields array', () => {
      expect(isSelectAll(['accountid', 'name'])).toBe(false);
    });
  });

  describe('deepClone', () => {
    it('should create a deep copy of an object', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });

    it('should handle arrays', () => {
      const original = [1, [2, 3], { a: 4 }];
      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });
  });

  describe('isPlainObject', () => {
    it('should return true for plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
    });

    it('should return false for arrays', () => {
      expect(isPlainObject([])).toBe(false);
    });

    it('should return false for null', () => {
      expect(isPlainObject(null)).toBe(false);
    });

    it('should return false for primitives', () => {
      expect(isPlainObject('string')).toBe(false);
      expect(isPlainObject(123)).toBe(false);
      expect(isPlainObject(true)).toBe(false);
    });
  });
});
