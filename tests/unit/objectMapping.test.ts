import { describe, it, expect } from 'vitest';
import {
  getObjectIdFieldName,
  getNameFieldByObjectType,
  OBJECT_ID_MAP,
  OBJECT_NAME_MAP,
} from '../../src/utils/objectMapping';

describe('objectMapping', () => {
  describe('getObjectIdFieldName', () => {
    it('should return accountid for object type 1', () => {
      expect(getObjectIdFieldName(1)).toBe('accountid');
      expect(getObjectIdFieldName('1')).toBe('accountid');
    });

    it('should return contactid for object type 2', () => {
      expect(getObjectIdFieldName(2)).toBe('contactid');
      expect(getObjectIdFieldName('2')).toBe('contactid');
    });

    it('should return leadid for object type 3', () => {
      expect(getObjectIdFieldName(3)).toBe('leadid');
    });

    it('should return noteid for object type 7', () => {
      expect(getObjectIdFieldName(7)).toBe('noteid');
    });

    it('should return taskid for object type 10', () => {
      expect(getObjectIdFieldName(10)).toBe('taskid');
    });

    it('should return crmorderid for object type 13', () => {
      expect(getObjectIdFieldName(13)).toBe('crmorderid');
    });

    it('should return productid for object type 14', () => {
      expect(getObjectIdFieldName(14)).toBe('productid');
    });

    it('should return customobjectXid for custom objects (1000+)', () => {
      expect(getObjectIdFieldName(1000)).toBe('customobject1000id');
      expect(getObjectIdFieldName(1001)).toBe('customobject1001id');
      expect(getObjectIdFieldName('1500')).toBe('customobject1500id');
    });

    it('should return id for unmapped objects below 1000', () => {
      expect(getObjectIdFieldName(999)).toBe('id');
    });

    it('should handle string input', () => {
      expect(getObjectIdFieldName('1')).toBe('accountid');
      expect(getObjectIdFieldName('14')).toBe('productid');
    });
  });

  describe('getNameFieldByObjectType', () => {
    it('should return accountname for object type 1', () => {
      expect(getNameFieldByObjectType(1)).toBe('accountname');
      expect(getNameFieldByObjectType('1')).toBe('accountname');
    });

    it('should return fullname for object type 2 (Contact)', () => {
      expect(getNameFieldByObjectType(2)).toBe('fullname');
    });

    it('should return fullname for object type 3 (Lead)', () => {
      expect(getNameFieldByObjectType(3)).toBe('fullname');
    });

    it('should return subject for object type 7 (Note)', () => {
      expect(getNameFieldByObjectType(7)).toBe('subject');
    });

    it('should return subject for object type 10 (Task)', () => {
      expect(getNameFieldByObjectType(10)).toBe('subject');
    });

    it('should return productname for object type 14 (Product)', () => {
      expect(getNameFieldByObjectType(14)).toBe('productname');
    });

    it('should return title for object type 76 (Article)', () => {
      expect(getNameFieldByObjectType(76)).toBe('title');
    });

    it('should return name for custom objects (1000+)', () => {
      expect(getNameFieldByObjectType(1000)).toBe('name');
      expect(getNameFieldByObjectType(1001)).toBe('name');
      expect(getNameFieldByObjectType('2000')).toBe('name');
    });

    it('should return name for unmapped objects', () => {
      expect(getNameFieldByObjectType(999)).toBe('name');
    });
  });

  describe('OBJECT_ID_MAP', () => {
    it('should contain expected base object mappings', () => {
      expect(OBJECT_ID_MAP[1]).toBe('accountid');
      expect(OBJECT_ID_MAP[2]).toBe('contactid');
      expect(OBJECT_ID_MAP[13]).toBe('crmorderid');
    });
  });

  describe('OBJECT_NAME_MAP', () => {
    it('should contain expected base object mappings', () => {
      expect(OBJECT_NAME_MAP[1]).toBe('accountname');
      expect(OBJECT_NAME_MAP[2]).toBe('fullname');
      expect(OBJECT_NAME_MAP[14]).toBe('productname');
    });
  });
});
