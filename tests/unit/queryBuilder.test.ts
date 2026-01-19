import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryBuilder, escapeQueryValue, sanitizeQuery, isPureDate, addDays, getToday, getStartOfWeek, getStartOfMonth } from '../../src/utils/queryBuilder';

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

describe('getToday', () => {
  it('should return today in YYYY-MM-DD format', () => {
    const today = getToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getStartOfWeek', () => {
  it('should return a Monday in YYYY-MM-DD format', () => {
    const startOfWeek = getStartOfWeek();
    expect(startOfWeek).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Verify it's a Monday
    const date = new Date(startOfWeek);
    expect(date.getDay()).toBe(1); // 1 = Monday
  });
});

describe('getStartOfMonth', () => {
  it('should return first day of month in YYYY-MM-DD format', () => {
    const startOfMonth = getStartOfMonth();
    expect(startOfMonth).toMatch(/^\d{4}-\d{2}-01$/);
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

  describe('whereIn()', () => {
    it('should throw error when values array is empty', () => {
      const builder = new QueryBuilder();
      expect(() => builder.whereIn('statuscode', [])).toThrow(
        'whereIn() requires at least one value'
      );
    });

    it('should handle single value', () => {
      const query = new QueryBuilder()
        .whereIn('statuscode', [1])
        .build();
      expect(query).toBe('(statuscode = 1)');
    });

    it('should join multiple values with OR', () => {
      const query = new QueryBuilder()
        .whereIn('statuscode', [1, 2, 3])
        .build();
      expect(query).toBe('(statuscode = 1) or (statuscode = 2) or (statuscode = 3)');
    });

    it('should work with string values', () => {
      const query = new QueryBuilder()
        .whereIn('name', ['Alice', 'Bob', 'Charlie'])
        .build();
      expect(query).toBe('(name = Alice) or (name = Bob) or (name = Charlie)');
    });

    it('should work with other conditions using and()', () => {
      const query = new QueryBuilder()
        .whereIn('statuscode', [1, 2])
        .and()
        .where('name').contains('test')
        .build();
      expect(query).toBe('(statuscode = 1) or (statuscode = 2) and (name start-with %test)');
    });
  });

  describe('where().in()', () => {
    it('should throw error when values array is empty', () => {
      const builder = new QueryBuilder();
      expect(() => builder.where('statuscode').in([])).toThrow(
        'in() requires at least one value'
      );
    });

    it('should handle single value', () => {
      const query = new QueryBuilder()
        .where('statuscode').in([1])
        .build();
      expect(query).toBe('(statuscode = 1)');
    });

    it('should join multiple values with OR', () => {
      const query = new QueryBuilder()
        .where('statuscode').in([1, 2, 3])
        .build();
      expect(query).toBe('(statuscode = 1) or (statuscode = 2) or (statuscode = 3)');
    });

    it('should work with mixed string and number values', () => {
      const query = new QueryBuilder()
        .where('field').in(['a', 1, 'b', 2])
        .build();
      expect(query).toBe('(field = a) or (field = 1) or (field = b) or (field = 2)');
    });
  });

  describe('count()', () => {
    it('should throw error when no client is provided', async () => {
      const builder = new QueryBuilder()
        .objectType('1')
        .where('statuscode').equals('1');

      await expect(builder.count()).rejects.toThrow(
        'QueryBuilder requires a client to execute queries'
      );
    });

    it('should throw error when objectType is not set', async () => {
      const mockClient = {
        query: async () => ({ records: [], total: 0, success: true }),
      };

      const builder = new QueryBuilder(mockClient)
        .where('statuscode').equals('1');

      await expect(builder.count()).rejects.toThrow(
        'Object type is required'
      );
    });

    it('should return count of matching records', async () => {
      const mockClient = {
        query: async () => ({ records: [{}, {}, {}], total: 3, success: true }),
      };

      const result = await new QueryBuilder(mockClient)
        .objectType('1')
        .where('statuscode').equals('1')
        .count();

      expect(result).toBe(3);
    });

    it('should return 0 when no records match', async () => {
      const mockClient = {
        query: async () => ({ records: [], total: 0, success: true }),
      };

      const result = await new QueryBuilder(mockClient)
        .objectType('1')
        .where('statuscode').equals('999')
        .count();

      expect(result).toBe(0);
    });

    it('should use only ID field for efficiency', async () => {
      let calledWith: any = null;
      const mockClient = {
        query: async (options: any) => {
          calledWith = options;
          return { records: [], total: 0, success: true };
        },
      };

      await new QueryBuilder(mockClient)
        .objectType('1')
        .select('name', 'email', 'phone') // These should be ignored for count
        .count();

      // Should only request the ID field for efficiency
      expect(calledWith.fields).toEqual(['accountid']);
    });

    it('should not show real values for efficiency', async () => {
      let calledWith: any = null;
      const mockClient = {
        query: async (options: any) => {
          calledWith = options;
          return { records: [], total: 0, success: true };
        },
      };

      await new QueryBuilder(mockClient)
        .objectType('1')
        .showRealValue(true) // Should be overridden for count
        .count();

      expect(calledWith.showRealValue).toBe(false);
    });
  });

  describe('first()', () => {
    it('should throw error when no client is provided', async () => {
      const builder = new QueryBuilder()
        .objectType('1')
        .where('statuscode').equals('1');

      await expect(builder.first()).rejects.toThrow(
        'QueryBuilder requires a client to execute queries'
      );
    });

    it('should return first record when records exist', async () => {
      const mockRecords = [
        { accountid: '1', name: 'First' },
        { accountid: '2', name: 'Second' },
      ];
      const mockClient = {
        query: async () => ({ records: mockRecords, total: 2, success: true }),
      };

      const result = await new QueryBuilder(mockClient)
        .objectType('1')
        .first();

      expect(result).toEqual({ accountid: '1', name: 'First' });
    });

    it('should return null when no records exist', async () => {
      const mockClient = {
        query: async () => ({ records: [], total: 0, success: true }),
      };

      const result = await new QueryBuilder(mockClient)
        .objectType('1')
        .first();

      expect(result).toBeNull();
    });

    it('should use limit 1 for efficiency', async () => {
      let calledWith: any = null;
      const mockClient = {
        query: async (options: any) => {
          calledWith = options;
          return { records: [], total: 0, success: true };
        },
      };

      await new QueryBuilder(mockClient)
        .objectType('1')
        .limit(100) // Original limit should be temporarily overridden
        .first();

      expect(calledWith.limit).toBe(1);
    });

    it('should restore original limit after execution', async () => {
      const mockClient = {
        query: async () => ({ records: [], total: 0, success: true }),
      };

      const builder = new QueryBuilder(mockClient)
        .objectType('1')
        .limit(100);

      await builder.first();

      // Access internal state to verify limit was restored
      expect((builder as any).limitValue).toBe(100);
    });
  });

  describe('whereDate()', () => {
    describe('today()', () => {
      it('should create query for today', () => {
        const today = getToday();
        const tomorrow = addDays(today, 1);
        const query = new QueryBuilder()
          .whereDate('createdon').today()
          .build();
        expect(query).toBe(`(createdon >= ${today}) and (createdon < ${tomorrow})`);
      });
    });

    describe('thisWeek()', () => {
      it('should create query for this week', () => {
        const startOfWeek = getStartOfWeek();
        const tomorrow = addDays(getToday(), 1);
        const query = new QueryBuilder()
          .whereDate('createdon').thisWeek()
          .build();
        expect(query).toBe(`(createdon >= ${startOfWeek}) and (createdon < ${tomorrow})`);
      });
    });

    describe('thisMonth()', () => {
      it('should create query for this month', () => {
        const startOfMonth = getStartOfMonth();
        const tomorrow = addDays(getToday(), 1);
        const query = new QueryBuilder()
          .whereDate('createdon').thisMonth()
          .build();
        expect(query).toBe(`(createdon >= ${startOfMonth}) and (createdon < ${tomorrow})`);
      });
    });

    describe('between()', () => {
      it('should create query for date range', () => {
        const query = new QueryBuilder()
          .whereDate('createdon').between('2024-01-01', '2024-12-31')
          .build();
        // End date is converted to < next day for inclusive range
        expect(query).toBe('(createdon >= 2024-01-01) and (createdon < 2025-01-01)');
      });

      it('should handle datetime end values without conversion', () => {
        const query = new QueryBuilder()
          .whereDate('createdon').between('2024-01-01', '2024-12-31T23:59:59')
          .build();
        expect(query).toBe('(createdon >= 2024-01-01) and (createdon < 2024-12-31T23:59:59)');
      });
    });

    describe('daysAgo()', () => {
      it('should create query for last N days', () => {
        const today = getToday();
        const sevenDaysAgo = addDays(today, -7);
        const tomorrow = addDays(today, 1);
        const query = new QueryBuilder()
          .whereDate('createdon').daysAgo(7)
          .build();
        expect(query).toBe(`(createdon >= ${sevenDaysAgo}) and (createdon < ${tomorrow})`);
      });
    });

    describe('before()', () => {
      it('should create query for before date', () => {
        const query = new QueryBuilder()
          .whereDate('createdon').before('2024-06-01')
          .build();
        expect(query).toBe('(createdon < 2024-06-01)');
      });
    });

    describe('after()', () => {
      it('should create query for after date (next day for pure dates)', () => {
        const query = new QueryBuilder()
          .whereDate('createdon').after('2024-06-01')
          .build();
        // After 2024-06-01 means >= 2024-06-02
        expect(query).toBe('(createdon >= 2024-06-02)');
      });
    });

    describe('onOrBefore()', () => {
      it('should create query for on or before date', () => {
        const query = new QueryBuilder()
          .whereDate('createdon').onOrBefore('2024-06-01')
          .build();
        // On or before 2024-06-01 means < 2024-06-02
        expect(query).toBe('(createdon < 2024-06-02)');
      });
    });

    describe('onOrAfter()', () => {
      it('should create query for on or after date', () => {
        const query = new QueryBuilder()
          .whereDate('createdon').onOrAfter('2024-06-01')
          .build();
        expect(query).toBe('(createdon >= 2024-06-01)');
      });
    });

    it('should work with other conditions', () => {
      const today = getToday();
      const tomorrow = addDays(today, 1);
      const query = new QueryBuilder()
        .where('statuscode').equals('1')
        .and()
        .whereDate('createdon').today()
        .build();
      expect(query).toBe(`(statuscode = 1) and (createdon >= ${today}) and (createdon < ${tomorrow})`);
    });
  });

  describe('executeWithDebug()', () => {
    it('should throw error when no client is provided', async () => {
      const builder = new QueryBuilder()
        .objectType('1')
        .where('statuscode').equals('1');

      await expect(builder.executeWithDebug()).rejects.toThrow(
        'QueryBuilder requires a client to execute queries'
      );
    });

    it('should throw error when objectType is not set', async () => {
      const mockClient = {
        query: async () => ({ records: [], total: 0, success: true }),
      };

      const builder = new QueryBuilder(mockClient)
        .where('statuscode').equals('1');

      await expect(builder.executeWithDebug()).rejects.toThrow(
        'Object type is required'
      );
    });

    it('should return results with metadata', async () => {
      const mockRecords = [{ id: '1' }, { id: '2' }];
      const mockClient = {
        query: async () => ({ records: mockRecords, total: 2, success: true }),
      };

      const result = await new QueryBuilder(mockClient)
        .objectType('1')
        .select('accountid', 'accountname')
        .where('statuscode').equals('1')
        .executeWithDebug();

      expect(result.records).toEqual(mockRecords);
      expect(result.total).toBe(2);
      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.objectType).toBe('1');
      expect(result.metadata.fields).toEqual(['accountid', 'accountname']);
      expect(result.metadata.queryString).toBe('(statuscode = 1)');
      expect(result.metadata.pageNumber).toBe(1);
      expect(result.metadata.pageSize).toBe(500);
      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include sort info in metadata when set', async () => {
      const mockClient = {
        query: async () => ({ records: [], total: 0, success: true }),
      };

      const result = await new QueryBuilder(mockClient)
        .objectType('1')
        .sortBy('createdon', 'asc')
        .executeWithDebug();

      expect(result.metadata.sortBy).toBe('createdon');
      expect(result.metadata.sortType).toBe('asc');
    });

    it('should include limit in metadata when set', async () => {
      const mockClient = {
        query: async () => ({ records: [], total: 0, success: true }),
      };

      const result = await new QueryBuilder(mockClient)
        .objectType('1')
        .limit(50)
        .executeWithDebug();

      expect(result.metadata.limit).toBe(50);
      expect(result.metadata.pageSize).toBe(50);
    });

    it('should measure execution time', async () => {
      const mockClient = {
        query: async () => {
          // Simulate some delay
          await new Promise(resolve => setTimeout(resolve, 10));
          return { records: [], total: 0, success: true };
        },
      };

      const result = await new QueryBuilder(mockClient)
        .objectType('1')
        .executeWithDebug();

      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(10);
    });

    it('should use default fields as ["*"] when none selected', async () => {
      const mockClient = {
        query: async () => ({ records: [], total: 0, success: true }),
      };

      const result = await new QueryBuilder(mockClient)
        .objectType('1')
        .executeWithDebug();

      expect(result.metadata.fields).toEqual(['*']);
    });
  });

  describe('explain()', () => {
    it('should return explanation without executing query', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .select('accountid', 'accountname')
        .where('statuscode').equals('1')
        .limit(100)
        .explain();

      expect(result.objectType).toBe('1');
      expect(result.query).toBe('(statuscode = 1)');
      expect(result.fields).toEqual(['accountid', 'accountname']);
      expect(result.limit).toBe(100);
    });

    it('should indicate when objectType is not set', () => {
      const result = new QueryBuilder()
        .select('accountid')
        .where('statuscode').equals('1')
        .explain();

      expect(result.objectType).toBe('(not set)');
      expect(result.warnings).toContain('Object type is not set. Call .objectType() before executing.');
    });

    it('should detect wildcard fields', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .select('*')
        .explain();

      expect(result.usesWildcard).toBe(true);
      expect(result.warnings).toContain('Using wildcard (*) fields may include unnecessary data and slow down queries.');
    });

    it('should not warn about wildcard when specific fields are used', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .select('accountid', 'accountname')
        .explain();

      expect(result.usesWildcard).toBe(false);
      const wildcardWarnings = result.warnings.filter(w => w.includes('wildcard'));
      expect(wildcardWarnings).toHaveLength(0);
    });

    it('should detect willAutoPage based on limit', () => {
      // No limit means auto-page
      const resultNoLimit = new QueryBuilder()
        .objectType('1')
        .explain();

      expect(resultNoLimit.willAutoPage).toBe(true);

      // With limit, no auto-page
      const resultWithLimit = new QueryBuilder()
        .objectType('1')
        .limit(100)
        .explain();

      expect(resultWithLimit.willAutoPage).toBe(false);
    });

    it('should include sorting info', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .sortBy('createdon', 'asc')
        .explain();

      expect(result.sorting.field).toBe('createdon');
      expect(result.sorting.direction).toBe('asc');
    });

    it('should use default sorting when not specified', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .explain();

      expect(result.sorting.field).toBe('modifiedon');
      expect(result.sorting.direction).toBe('desc');
    });

    it('should count conditions', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .where('statuscode').equals('1')
        .and()
        .where('name').contains('Acme')
        .or()
        .where('revenue').greaterThan(1000)
        .explain();

      expect(result.conditionCount).toBe(3);
    });

    it('should return (no conditions) query when no conditions set', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .explain();

      expect(result.conditionCount).toBe(0);
      expect(result.query).toBe('(no conditions)');
    });

    it('should estimate API calls based on limit', () => {
      // With limit of 100 and default pageSize 500, expect 1 call
      const result1 = new QueryBuilder()
        .objectType('1')
        .limit(100)
        .explain();

      expect(result1.estimatedApiCalls).toBe(1);

      // With limit of 1000 and default pageSize 500, expect 2 calls
      const result2 = new QueryBuilder()
        .objectType('1')
        .limit(1000)
        .explain();

      expect(result2.estimatedApiCalls).toBe(2);
    });

    it('should return -1 for API calls when no limit and no conditions', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .explain();

      // Without limit and conditions, can't estimate calls
      expect(result.estimatedApiCalls).toBe(-1);
    });

    it('should track showRealValue setting', () => {
      // Default is true
      const resultDefault = new QueryBuilder()
        .objectType('1')
        .explain();

      expect(resultDefault.showRealValue).toBe(true);

      // Explicitly set to false
      const resultFalse = new QueryBuilder()
        .objectType('1')
        .showRealValue(false)
        .explain();

      expect(resultFalse.showRealValue).toBe(false);
    });

    it('should provide suggestions for optimization', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .select('*')
        .explain();

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions).toContain('Consider selecting only the specific fields you need with .select()');
    });

    it('should warn about missing conditions for large datasets', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .explain();

      expect(result.warnings).toContain('No query conditions or limit set. This may return a large number of records.');
    });

    it('should not warn about missing conditions when limit is set', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .limit(100)
        .explain();

      expect(result.warnings).not.toContain('No query conditions or limit set. This may return a large number of records.');
    });

    it('should include page size info', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .explain();

      expect(result.pageSize).toBe(500);
    });

    it('should handle null limit correctly', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .explain();

      expect(result.limit).toBeNull();
    });

    it('should work with complex queries', () => {
      const result = new QueryBuilder()
        .objectType('1')
        .select('accountid', 'accountname', 'statuscode')
        .where('statuscode').equals('1')
        .and()
        .where('accountname').startsWith('Acme')
        .and()
        .where('revenue').greaterThan(10000)
        .or()
        .where('primarycontactid').isNotNull()
        .sortBy('createdon', 'desc')
        .limit(50)
        .showRealValue(false)
        .explain();

      expect(result.objectType).toBe('1');
      expect(result.fields).toEqual(['accountid', 'accountname', 'statuscode']);
      expect(result.conditionCount).toBe(4);
      expect(result.limit).toBe(50);
      expect(result.pageSize).toBe(500);
      expect(result.showRealValue).toBe(false);
      expect(result.willAutoPage).toBe(false);
      expect(result.sorting.field).toBe('createdon');
      expect(result.sorting.direction).toBe('desc');
      expect(result.usesWildcard).toBe(false);
    });
  });
});
