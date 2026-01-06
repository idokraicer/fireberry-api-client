import { describe, it, expect } from 'vitest';
import {
  isDropdownField,
  isLookupField,
  isDropdownOrLookupField,
  isTextField,
  isNumericField,
  isDateField,
  getFieldTypeName,
} from '../../src/utils/fieldTypes';
import { FIELD_TYPE_IDS } from '../../src/constants/fieldTypes';

describe('fieldTypes', () => {
  describe('isDropdownField', () => {
    it('should return true for dropdown field type', () => {
      expect(isDropdownField(FIELD_TYPE_IDS.DROPDOWN)).toBe(true);
    });

    it('should return false for other field types', () => {
      expect(isDropdownField(FIELD_TYPE_IDS.LOOKUP)).toBe(false);
      expect(isDropdownField(FIELD_TYPE_IDS.TEXT)).toBe(false);
      expect(isDropdownField(FIELD_TYPE_IDS.NUMERIC)).toBe(false);
    });
  });

  describe('isLookupField', () => {
    it('should return true for lookup field type', () => {
      expect(isLookupField(FIELD_TYPE_IDS.LOOKUP)).toBe(true);
    });

    it('should return false for other field types', () => {
      expect(isLookupField(FIELD_TYPE_IDS.DROPDOWN)).toBe(false);
      expect(isLookupField(FIELD_TYPE_IDS.TEXT)).toBe(false);
    });
  });

  describe('isDropdownOrLookupField', () => {
    it('should return true for dropdown field type', () => {
      expect(isDropdownOrLookupField(FIELD_TYPE_IDS.DROPDOWN)).toBe(true);
    });

    it('should return true for lookup field type', () => {
      expect(isDropdownOrLookupField(FIELD_TYPE_IDS.LOOKUP)).toBe(true);
    });

    it('should return false for other field types', () => {
      expect(isDropdownOrLookupField(FIELD_TYPE_IDS.TEXT)).toBe(false);
      expect(isDropdownOrLookupField(FIELD_TYPE_IDS.NUMERIC)).toBe(false);
    });
  });

  describe('isTextField', () => {
    it('should return true for text field type', () => {
      expect(isTextField(FIELD_TYPE_IDS.TEXT)).toBe(true);
    });

    it('should return false for other field types', () => {
      expect(isTextField(FIELD_TYPE_IDS.DROPDOWN)).toBe(false);
      expect(isTextField(FIELD_TYPE_IDS.NUMERIC)).toBe(false);
    });
  });

  describe('isNumericField', () => {
    it('should return true for numeric field type', () => {
      expect(isNumericField(FIELD_TYPE_IDS.NUMERIC)).toBe(true);
    });

    it('should return false for other field types', () => {
      expect(isNumericField(FIELD_TYPE_IDS.TEXT)).toBe(false);
      expect(isNumericField(FIELD_TYPE_IDS.DROPDOWN)).toBe(false);
    });
  });

  describe('isDateField', () => {
    it('should return true for date field type', () => {
      expect(isDateField(FIELD_TYPE_IDS.DATE)).toBe(true);
    });

    it('should return true for datetime field type', () => {
      expect(isDateField(FIELD_TYPE_IDS.DATETIME)).toBe(true);
    });

    it('should return false for other field types', () => {
      expect(isDateField(FIELD_TYPE_IDS.TEXT)).toBe(false);
      expect(isDateField(FIELD_TYPE_IDS.NUMERIC)).toBe(false);
    });
  });

  describe('getFieldTypeName', () => {
    it('should return Dropdown for dropdown type', () => {
      expect(getFieldTypeName(FIELD_TYPE_IDS.DROPDOWN)).toBe('Dropdown');
    });

    it('should return Lookup for lookup type', () => {
      expect(getFieldTypeName(FIELD_TYPE_IDS.LOOKUP)).toBe('Lookup');
    });

    it('should return Text for text type', () => {
      expect(getFieldTypeName(FIELD_TYPE_IDS.TEXT)).toBe('Text');
    });

    it('should return Number for numeric type', () => {
      expect(getFieldTypeName(FIELD_TYPE_IDS.NUMERIC)).toBe('Number');
    });

    it('should return Email for email type', () => {
      expect(getFieldTypeName(FIELD_TYPE_IDS.EMAIL)).toBe('Email');
    });

    it('should return URL for url type', () => {
      expect(getFieldTypeName(FIELD_TYPE_IDS.URL)).toBe('URL');
    });

    it('should return Date for date type', () => {
      expect(getFieldTypeName(FIELD_TYPE_IDS.DATE)).toBe('Date');
    });

    it('should return DateTime for datetime type', () => {
      expect(getFieldTypeName(FIELD_TYPE_IDS.DATETIME)).toBe('DateTime');
    });

    it('should return Unknown for unmapped types', () => {
      expect(getFieldTypeName('999')).toBe('Unknown');
      expect(getFieldTypeName('unknown')).toBe('Unknown');
    });
  });
});
