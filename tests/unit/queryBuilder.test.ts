import { describe, it, expect } from 'vitest';
import { QueryBuilder, escapeQueryValue, sanitizeQuery, isPureDate, addDays } from '../../src/utils/queryBuilder';

describe('isPureDate', () => {
  it('should return true for YYYY-MM-DD format', () => {
    expect(isPureDate('2024-01-15')).toBe(true);
    expect(isPureDate('2023-12-31')).toBe(true);
    expect(isPureDate('2025-06-01')).toBe(true);
  });

  it('should return false for datetime formats', () => {
    expect(isPureDate('2024-01-15T10:30:00')).toBe(false);
    expect(isPureDate('2024-01-15 10:30:00')).toBe(false);
    expect(isPureDate('2024-01-15T00:00:00Z')).toBe(false);
  });

  it('should return false for invalid formats', () => {
    expect(isPureDate('01-15-2024')).toBe(false);
    expect(isPureDate('2024/01/15')).toBe(false);
    expect(isPureDate('2024-1-15')).toBe(false);
    expect(isPureDate('20240115')).toBe(false);
    expect(isPureDate('123')).toBe(false);
    expect(isPureDate('')).toBe(false);
  });
});

describe('addDays', () => {
  it('should add days to a date', () => {
    expect(addDays('2024-01-15', 1)).toBe('2024-01-16');
    expect(addDays('2024-01-15', 5)).toBe('2024-01-20');
  });

  it('should handle month boundaries', () => {
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
    expect(addDays('2024-03-31', 1)).toBe('2024-04-01');
  });

  it('should handle year boundaries', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
  });

  it('should handle leap years', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
  });

  it('should handle negative days', () => {
    expect(addDays('2024-01-15', -1)).toBe('2024-01-14');
    expect(addDays('2024-01-01', -1)).toBe('2023-12-31');
  });

  it('should handle datetime input by extracting date part', () => {
    expect(addDays('2024-01-15T10:30:00', 1)).toBe('2024-01-16');
    expect(addDays('2024-01-15 10:30:00', 1)).toBe('2024-01-16');
  });
});

describe('escapeQueryValue', () => {
  it('should return empty string for empty input', () => {
    expect(escapeQueryValue('')).toBe('');
  });

  it('should escape backslashes', () => {
    expect(escapeQueryValue('a\\b')).toBe('a\\\\b');
  });

  it('should escape parentheses', () => {
    expect(escapeQueryValue('(test)')).toBe('\\(test\\)');
  });

  it('should escape "and" operator', () => {
    expect(escapeQueryValue('this and that')).toBe('this \\and that');
  });

  it('should escape "or" operator', () => {
    expect(escapeQueryValue('this or that')).toBe('this \\or that');
  });

  it('should not escape "and" within words', () => {
    expect(escapeQueryValue('android')).toBe('android');
    expect(escapeQueryValue('brand')).toBe('brand');
  });

  it('should not escape "or" within words', () => {
    expect(escapeQueryValue('order')).toBe('order');
    expect(escapeQueryValue('color')).toBe('color');
  });

  it('should handle multiple escapes', () => {
    expect(escapeQueryValue('(a and b) or c')).toBe('\\(a \\and b\\) \\or c');
  });
});

describe('sanitizeQuery', () => {
  it('should return empty string for empty input', () => {
    expect(sanitizeQuery('')).toBe('');
  });

  it('should remove empty parentheses', () => {
    expect(sanitizeQuery('(statuscode = 1) and ()')).toBe('(statuscode = 1)');
  });

  it('should remove trailing logical operators', () => {
    expect(sanitizeQuery('(statuscode = 1) and')).toBe('(statuscode = 1)');
  });

  it('should remove leading logical operators', () => {
    expect(sanitizeQuery('and (statuscode = 1)')).toBe('(statuscode = 1)');
  });

  it('should collapse multiple spaces', () => {
    // Note: sanitizeQuery may add = for field-value pairs without operators
    // This tests that multiple spaces are collapsed to single space
    expect(sanitizeQuery('(statuscode =  1)')).toBe('(statuscode = 1)');
  });

  it('should preserve is-null operator', () => {
    expect(sanitizeQuery('(fieldname is-null)')).toBe('(fieldname is-null)');
  });

  it('should preserve is-not-null operator', () => {
    expect(sanitizeQuery('(fieldname is-not-null)')).toBe('(fieldname is-not-null)');
  });

  it('should preserve start-with operator', () => {
    expect(sanitizeQuery('(name start-with test)')).toBe('(name start-with test)');
  });
});

describe('QueryBuilder', () => {
  describe('build()', () => {
    it('should build empty string with no conditions', () => {
      const builder = new QueryBuilder();
      expect(builder.build()).toBe('');
    });

    it('should build simple equals condition', () => {
      const query = new QueryBuilder()
        .where('statuscode').equals('1')
        .build();
      expect(query).toBe('(statuscode = 1)');
    });

    it('should build not equals condition', () => {
      const query = new QueryBuilder()
        .where('statuscode').notEquals('1')
        .build();
      expect(query).toBe('(statuscode != 1)');
    });

    it('should build less than condition', () => {
      const query = new QueryBuilder()
        .where('amount').lessThan(100)
        .build();
      expect(query).toBe('(amount < 100)');
    });

    it('should build greater than condition', () => {
      const query = new QueryBuilder()
        .where('amount').greaterThan(100)
        .build();
      expect(query).toBe('(amount > 100)');
    });

    it('should build less than or equal condition for numbers', () => {
      const query = new QueryBuilder()
        .where('amount').lessThanOrEqual(100)
        .build();
      expect(query).toBe('(amount <= 100)');
    });

    it('should auto-convert lessThanOrEqual with pure date to less than next day', () => {
      const query = new QueryBuilder()
        .where('createdon').lessThanOrEqual('2024-01-15')
        .build();
      // Pure date (YYYY-MM-DD) is converted to < nextDay for correct behavior
      expect(query).toBe('(createdon < 2024-01-16)');
    });

    it('should not convert lessThanOrEqual with datetime value', () => {
      const query = new QueryBuilder()
        .where('createdon').lessThanOrEqual('2024-01-15T23:59:59')
        .build();
      // Datetime values are passed through unchanged
      expect(query).toBe('(createdon <= 2024-01-15T23:59:59)');
    });

    it('should not convert lessThanOrEqual with datetime space format', () => {
      const query = new QueryBuilder()
        .where('createdon').lessThanOrEqual('2024-01-15 23:59:59')
        .build();
      expect(query).toBe('(createdon <= 2024-01-15 23:59:59)');
    });

    it('should handle month boundary in date conversion', () => {
      const query = new QueryBuilder()
        .where('createdon').lessThanOrEqual('2024-01-31')
        .build();
      expect(query).toBe('(createdon < 2024-02-01)');
    });

    it('should handle year boundary in date conversion', () => {
      const query = new QueryBuilder()
        .where('createdon').lessThanOrEqual('2024-12-31')
        .build();
      expect(query).toBe('(createdon < 2025-01-01)');
    });

    it('should build greater than or equal condition', () => {
      const query = new QueryBuilder()
        .where('amount').greaterThanOrEqual(100)
        .build();
      expect(query).toBe('(amount >= 100)');
    });

    it('should build contains condition with % prefix', () => {
      const query = new QueryBuilder()
        .where('name').contains('test')
        .build();
      expect(query).toBe('(name start-with %test)');
    });

    it('should build not contains condition', () => {
      const query = new QueryBuilder()
        .where('name').notContains('test')
        .build();
      expect(query).toBe('(name not-start-with %test)');
    });

    it('should build starts with condition', () => {
      const query = new QueryBuilder()
        .where('name').startsWith('test')
        .build();
      expect(query).toBe('(name start-with test)');
    });

    it('should build not starts with condition', () => {
      const query = new QueryBuilder()
        .where('name').notStartsWith('test')
        .build();
      expect(query).toBe('(name not-start-with test)');
    });

    it('should build is null condition', () => {
      const query = new QueryBuilder()
        .where('email').isNull()
        .build();
      expect(query).toBe('(email is-null)');
    });

    it('should build is not null condition', () => {
      const query = new QueryBuilder()
        .where('email').isNotNull()
        .build();
      expect(query).toBe('(email is-not-null)');
    });

    it('should join conditions with AND', () => {
      const query = new QueryBuilder()
        .where('statuscode').equals('1')
        .and()
        .where('name').contains('test')
        .build();
      expect(query).toBe('(statuscode = 1) and (name start-with %test)');
    });

    it('should join conditions with OR', () => {
      const query = new QueryBuilder()
        .where('statuscode').equals('1')
        .or()
        .where('statuscode').equals('2')
        .build();
      expect(query).toBe('(statuscode = 1) or (statuscode = 2)');
    });

    it('should handle multiple conditions with mixed operators', () => {
      const query = new QueryBuilder()
        .where('statuscode').equals('1')
        .and()
        .where('name').contains('test')
        .or()
        .where('email').isNotNull()
        .build();
      expect(query).toBe('(statuscode = 1) and (name start-with %test) or (email is-not-null)');
    });

    it('should escape special characters in values', () => {
      const query = new QueryBuilder()
        .where('name').equals('test (special) and value')
        .build();
      expect(query).toBe('(name = test \\(special\\) \\and value)');
    });
  });

  describe('select()', () => {
    it('should accumulate selected fields', () => {
      const builder = new QueryBuilder()
        .select('accountid', 'name')
        .select('email');

      // Access internal state to verify
      expect((builder as any).selectedFields).toEqual(['accountid', 'name', 'email']);
    });
  });

  describe('sortBy()', () => {
    it('should set sort field with default desc direction', () => {
      const builder = new QueryBuilder().sortBy('modifiedon');
      expect((builder as any).sortByField).toBe('modifiedon');
      expect((builder as any).sortDirection).toBe('desc');
    });

    it('should set sort field with specified direction', () => {
      const builder = new QueryBuilder().sortBy('name', 'asc');
      expect((builder as any).sortByField).toBe('name');
      expect((builder as any).sortDirection).toBe('asc');
    });
  });

  describe('limit()', () => {
    it('should set limit value', () => {
      const builder = new QueryBuilder().limit(100);
      expect((builder as any).limitValue).toBe(100);
    });
  });

  describe('page()', () => {
    it('should set page number', () => {
      const builder = new QueryBuilder().page(2);
      expect((builder as any).pageNumber).toBe(2);
    });
  });

  describe('execute()', () => {
    it('should throw error when no client is provided', async () => {
      const builder = new QueryBuilder()
        .objectType('1')
        .where('statuscode').equals('1');

      await expect(builder.execute()).rejects.toThrow(
        'QueryBuilder requires a client to execute queries'
      );
    });

    it('should throw error when objectType is not set', async () => {
      const mockClient = {
        query: async () => ({ records: [], total: 0, success: true }),
      };

      const builder = new QueryBuilder(mockClient)
        .where('statuscode').equals('1');

      await expect(builder.execute()).rejects.toThrow(
        'Object type is required'
      );
    });

    it('should call client.query with correct parameters', async () => {
      let calledWith: any = null;
      const mockClient = {
        query: async (options: any) => {
          calledWith = options;
          return { records: [], total: 0, success: true };
        },
      };

      await new QueryBuilder(mockClient)
        .objectType('1')
        .select('accountid', 'name')
        .where('statuscode').equals('1')
        .sortBy('modifiedon', 'desc')
        .limit(50)
        .execute();

      expect(calledWith).toEqual({
        objectType: '1',
        fields: ['accountid', 'name'],
        query: '(statuscode = 1)',
        showRealValue: true,
        sortBy: 'modifiedon',
        sortType: 'desc',
        limit: 50,
      });
    });

    it('should use ["*"] when no fields selected', async () => {
      let calledWith: any = null;
      const mockClient = {
        query: async (options: any) => {
          calledWith = options;
          return { records: [], total: 0, success: true };
        },
      };

      await new QueryBuilder(mockClient)
        .objectType('1')
        .execute();

      expect(calledWith.fields).toEqual(['*']);
    });
  });

  describe('whereId()', () => {
    it('should throw error when objectType is not set', () => {
      const builder = new QueryBuilder();
      expect(() => builder.whereId('abc123')).toThrow(
        'Object type must be set before using whereId()'
      );
    });

    it('should use accountid for object type 1', () => {
      const query = new QueryBuilder()
        .objectType(1)
        .whereId('abc123')
        .build();
      expect(query).toBe('(accountid = abc123)');
    });

    it('should use contactid for object type 2', () => {
      const query = new QueryBuilder()
        .objectType(2)
        .whereId('xyz789')
        .build();
      expect(query).toBe('(contactid = xyz789)');
    });

    it('should use leadid for object type 3', () => {
      const query = new QueryBuilder()
        .objectType('3')
        .whereId('lead-id')
        .build();
      expect(query).toBe('(leadid = lead-id)');
    });

    it('should use customobjectXid for custom objects', () => {
      const query = new QueryBuilder()
        .objectType(1001)
        .whereId('custom-id')
        .build();
      expect(query).toBe('(customobject1001id = custom-id)');
    });

    it('should work with other conditions using and()', () => {
      const query = new QueryBuilder()
        .objectType(1)
        .whereId('abc123')
        .and()
        .where('statuscode').equals('1')
        .build();
      expect(query).toBe('(accountid = abc123) and (statuscode = 1)');
    });

    it('should accept numeric values', () => {
      const query = new QueryBuilder()
        .objectType(1)
        .whereId(12345)
        .build();
      expect(query).toBe('(accountid = 12345)');
    });
  });

  describe('whereIds()', () => {
    it('should throw error when objectType is not set', () => {
      const builder = new QueryBuilder();
      expect(() => builder.whereIds(['id1', 'id2'])).toThrow(
        'Object type must be set before using whereIds()'
      );
    });

    it('should throw error when values array is empty', () => {
      const builder = new QueryBuilder().objectType(1);
      expect(() => builder.whereIds([])).toThrow(
        'whereIds() requires at least one ID value'
      );
    });

    it('should handle single ID', () => {
      const query = new QueryBuilder()
        .objectType(1)
        .whereIds(['abc123'])
        .build();
      expect(query).toBe('(accountid = abc123)');
    });

    it('should join multiple IDs with OR', () => {
      const query = new QueryBuilder()
        .objectType(1)
        .whereIds(['id1', 'id2', 'id3'])
        .build();
      expect(query).toBe('(accountid = id1) or (accountid = id2) or (accountid = id3)');
    });

    it('should use correct ID field for object type', () => {
      const query = new QueryBuilder()
        .objectType(2)
        .whereIds(['c1', 'c2'])
        .build();
      expect(query).toBe('(contactid = c1) or (contactid = c2)');
    });

    it('should work with custom objects', () => {
      const query = new QueryBuilder()
        .objectType(1001)
        .whereIds(['custom1', 'custom2'])
        .build();
      expect(query).toBe('(customobject1001id = custom1) or (customobject1001id = custom2)');
    });

    it('should accept numeric values', () => {
      const query = new QueryBuilder()
        .objectType(1)
        .whereIds([123, 456, 789])
        .build();
      expect(query).toBe('(accountid = 123) or (accountid = 456) or (accountid = 789)');
    });

    it('should work with other conditions using and()', () => {
      const query = new QueryBuilder()
        .objectType(1)
        .whereIds(['id1', 'id2'])
        .and()
        .where('statuscode').equals('1')
        .build();
      expect(query).toBe('(accountid = id1) or (accountid = id2) and (statuscode = 1)');
    });

    it('should accept mixed string and number values', () => {
      const query = new QueryBuilder()
        .objectType(1)
        .whereIds(['abc', 123, 'xyz'])
        .build();
      expect(query).toBe('(accountid = abc) or (accountid = 123) or (accountid = xyz)');
    });
  });
});
