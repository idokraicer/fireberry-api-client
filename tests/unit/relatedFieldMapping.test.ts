import { describe, expect, it, beforeEach } from 'vitest';
import {
  ID_FIELD_TO_OBJECT_TYPE,
  getObjectTypeFromReferenceField,
  parseRelatedField,
  resolveRelatedField,
  expandRelatedFields,
  getRelatedFieldInfo,
  isCodeField,
  getCodeFieldFromLabel,
  getLabelFieldFromCode,
  isDropdownFieldByMetadata,
  RelatedFieldResolver,
} from '../../src/utils/relatedFieldMapping';
import { FIELD_TYPE_IDS } from '../../src/constants/fieldTypes';
import type { FireberryField } from '../../src/types/metadata';

// Mock field metadata for testing
const mockAccountFields: FireberryField[] = [
  { fieldName: 'statuscode', label: 'Status', systemFieldTypeId: FIELD_TYPE_IDS.DROPDOWN },
  { fieldName: 'categorycode', label: 'Category', systemFieldTypeId: FIELD_TYPE_IDS.DROPDOWN },
  { fieldName: 'telephone1', label: 'Phone', systemFieldTypeId: FIELD_TYPE_IDS.TELEPHONE },
  { fieldName: 'emailaddress1', label: 'Email', systemFieldTypeId: FIELD_TYPE_IDS.EMAIL },
  { fieldName: 'accountname', label: 'Account Name', systemFieldTypeId: FIELD_TYPE_IDS.TEXT },
  { fieldName: 'industrycode', label: 'Industry', systemFieldTypeId: FIELD_TYPE_IDS.DROPDOWN },
];

describe('relatedFieldMapping', () => {
  describe('ID_FIELD_TO_OBJECT_TYPE', () => {
    it('should map accountid to object type 1', () => {
      expect(ID_FIELD_TO_OBJECT_TYPE.accountid).toBe(1);
    });

    it('should map contactid to object type 2', () => {
      expect(ID_FIELD_TO_OBJECT_TYPE.contactid).toBe(2);
    });

    it('should map leadid to object type 3', () => {
      expect(ID_FIELD_TO_OBJECT_TYPE.leadid).toBe(3);
    });

    it('should map opportunityid to object type 4', () => {
      expect(ID_FIELD_TO_OBJECT_TYPE.opportunityid).toBe(4);
    });
  });

  describe('getObjectTypeFromReferenceField', () => {
    it('should return object type for known reference fields', () => {
      expect(getObjectTypeFromReferenceField('accountid')).toBe(1);
      expect(getObjectTypeFromReferenceField('contactid')).toBe(2);
      expect(getObjectTypeFromReferenceField('leadid')).toBe(3);
    });

    it('should return null for unknown reference fields', () => {
      expect(getObjectTypeFromReferenceField('unknownid')).toBeNull();
      expect(getObjectTypeFromReferenceField('telephone1')).toBeNull();
    });

    it('should handle custom object patterns', () => {
      expect(getObjectTypeFromReferenceField('customobject1000id')).toBe(1000);
      expect(getObjectTypeFromReferenceField('customobject1234id')).toBe(1234);
    });
  });

  describe('parseRelatedField', () => {
    it('should parse related field with accountid prefix', () => {
      const result = parseRelatedField('accountid_telephone1');
      expect(result).toEqual({
        originalField: 'accountid_telephone1',
        referenceField: 'accountid',
        relatedField: 'telephone1',
        relatedObjectType: 1,
      });
    });

    it('should parse related field with contactid prefix', () => {
      const result = parseRelatedField('contactid_fullname');
      expect(result).toEqual({
        originalField: 'contactid_fullname',
        referenceField: 'contactid',
        relatedField: 'fullname',
        relatedObjectType: 2,
      });
    });

    it('should parse related code field', () => {
      const result = parseRelatedField('accountid_statuscode');
      expect(result).toEqual({
        originalField: 'accountid_statuscode',
        referenceField: 'accountid',
        relatedField: 'statuscode',
        relatedObjectType: 1,
      });
    });

    it('should return null for non-related fields', () => {
      expect(parseRelatedField('telephone1')).toBeNull();
      expect(parseRelatedField('accountname')).toBeNull();
    });

    it('should return null for fields with underscore but no valid reference', () => {
      expect(parseRelatedField('some_field')).toBeNull();
      expect(parseRelatedField('pcf_customfield')).toBeNull();
    });

    it('should handle custom object reference fields', () => {
      const result = parseRelatedField('customobject1000id_name');
      expect(result).toEqual({
        originalField: 'customobject1000id_name',
        referenceField: 'customobject1000id',
        relatedField: 'name',
        relatedObjectType: 1000,
      });
    });
  });

  describe('isCodeField', () => {
    it('should return true for fields ending with code', () => {
      expect(isCodeField('statuscode')).toBe(true);
      expect(isCodeField('categorycode')).toBe(true);
    });

    it('should return false for non-code fields', () => {
      expect(isCodeField('status')).toBe(false);
      expect(isCodeField('telephone1')).toBe(false);
    });
  });

  describe('getCodeFieldFromLabel', () => {
    it('should append code to label field', () => {
      expect(getCodeFieldFromLabel('status')).toBe('statuscode');
      expect(getCodeFieldFromLabel('category')).toBe('categorycode');
    });
  });

  describe('getLabelFieldFromCode', () => {
    it('should remove code suffix from code field', () => {
      expect(getLabelFieldFromCode('statuscode')).toBe('status');
      expect(getLabelFieldFromCode('categorycode')).toBe('category');
    });

    it('should return field as-is if not ending with code', () => {
      expect(getLabelFieldFromCode('status')).toBe('status');
    });
  });

  describe('isDropdownFieldByMetadata', () => {
    it('should return true for dropdown fields', () => {
      const metadata = new Map<string, FireberryField>();
      metadata.set('statuscode', mockAccountFields[0]);

      expect(isDropdownFieldByMetadata('statuscode', metadata)).toBe(true);
    });

    it('should return false for non-dropdown fields', () => {
      const metadata = new Map<string, FireberryField>();
      metadata.set('telephone1', mockAccountFields[2]);

      expect(isDropdownFieldByMetadata('telephone1', metadata)).toBe(false);
    });

    it('should return false for unknown fields', () => {
      const metadata = new Map<string, FireberryField>();
      expect(isDropdownFieldByMetadata('unknown', metadata)).toBe(false);
    });
  });

  describe('resolveRelatedField (without metadata)', () => {
    it('should resolve code field with label', () => {
      const result = resolveRelatedField('accountid_statuscode');
      expect(result).not.toBeNull();
      expect(result!.originalField).toBe('accountid_statuscode');
      expect(result!.fields).toContain('accountid_statuscode');
      expect(result!.fields).toContain('accountid_status');
      expect(result!.codeField).toBe('accountid_statuscode');
      expect(result!.labelField).toBe('accountid_status');
      expect(result!.isCodeField).toBe(true);
      expect(result!.relatedObjectType).toBe(1);
    });

    it('should return single field for non-code fields without metadata', () => {
      const result = resolveRelatedField('accountid_telephone1');
      expect(result).not.toBeNull();
      expect(result!.originalField).toBe('accountid_telephone1');
      expect(result!.fields).toEqual(['accountid_telephone1']);
      expect(result!.codeField).toBeUndefined();
      expect(result!.labelField).toBe('accountid_telephone1');
      expect(result!.isCodeField).toBe(false);
    });

    it('should return null for non-related fields', () => {
      expect(resolveRelatedField('telephone1')).toBeNull();
      expect(resolveRelatedField('accountname')).toBeNull();
    });
  });

  describe('RelatedFieldResolver (with metadata)', () => {
    let resolver: RelatedFieldResolver;

    beforeEach(() => {
      resolver = new RelatedFieldResolver();
      resolver.setMetadata(1, mockAccountFields); // Account metadata
    });

    it('should resolve code field with label', () => {
      const result = resolver.resolve('accountid_statuscode');
      expect(result).not.toBeNull();
      expect(result!.fields).toContain('accountid_statuscode');
      expect(result!.fields).toContain('accountid_status');
      expect(result!.isCodeField).toBe(true);
    });

    it('should resolve label field with code for dropdown types', () => {
      const result = resolver.resolve('accountid_status');
      expect(result).not.toBeNull();
      expect(result!.originalField).toBe('accountid_status');
      expect(result!.fields).toContain('accountid_status');
      expect(result!.fields).toContain('accountid_statuscode');
      expect(result!.codeField).toBe('accountid_statuscode');
      expect(result!.labelField).toBe('accountid_status');
      expect(result!.isCodeField).toBe(false);
      expect(result!.fieldType).toBe(FIELD_TYPE_IDS.DROPDOWN);
    });

    it('should NOT add code field for non-dropdown types', () => {
      const result = resolver.resolve('accountid_telephone1');
      expect(result).not.toBeNull();
      expect(result!.originalField).toBe('accountid_telephone1');
      expect(result!.fields).toEqual(['accountid_telephone1']);
      expect(result!.codeField).toBeUndefined();
      expect(result!.fieldType).toBe(FIELD_TYPE_IDS.TELEPHONE);
    });

    it('should NOT add code field for email fields', () => {
      const result = resolver.resolve('accountid_emailaddress1');
      expect(result).not.toBeNull();
      expect(result!.fields).toEqual(['accountid_emailaddress1']);
      expect(result!.codeField).toBeUndefined();
      expect(result!.fieldType).toBe(FIELD_TYPE_IDS.EMAIL);
    });

    it('should handle industry dropdown field', () => {
      const result = resolver.resolve('accountid_industry');
      expect(result).not.toBeNull();
      expect(result!.fields).toContain('accountid_industry');
      expect(result!.fields).toContain('accountid_industrycode');
      expect(result!.fieldType).toBe(FIELD_TYPE_IDS.DROPDOWN);
    });

    it('should return null for non-related fields', () => {
      expect(resolver.resolve('telephone1')).toBeNull();
    });

    describe('metadata management', () => {
      it('should check if metadata is loaded', () => {
        expect(resolver.hasMetadata(1)).toBe(true);
        expect(resolver.hasMetadata(2)).toBe(false);
      });

      it('should get metadata map', () => {
        const metadata = resolver.getMetadata(1);
        expect(metadata).toBeDefined();
        expect(metadata!.get('statuscode')).toBeDefined();
      });

      it('should clear metadata', () => {
        resolver.clearMetadata();
        expect(resolver.hasMetadata(1)).toBe(false);
      });
    });

    describe('expandFields', () => {
      it('should expand fields with code/label pairs', () => {
        const result = resolver.expandFields(['accountid_status', 'accountid_telephone1']);
        expect(result).toContain('accountid_status');
        expect(result).toContain('accountid_statuscode');
        expect(result).toContain('accountid_telephone1');
        expect(result.length).toBe(3);
      });

      it('should not duplicate fields', () => {
        const result = resolver.expandFields(['accountid_status', 'accountid_statuscode']);
        expect(result.filter((f) => f === 'accountid_status').length).toBe(1);
        expect(result.filter((f) => f === 'accountid_statuscode').length).toBe(1);
      });
    });

    describe('showRealValue parameter', () => {
      it('should expand dropdown fields when showRealValue=true (default)', () => {
        const result = resolver.resolve('accountid_status');
        expect(result!.fields).toContain('accountid_status');
        expect(result!.fields).toContain('accountid_statuscode');
        expect(result!.fields.length).toBe(2);
      });

      it('should NOT expand dropdown fields when showRealValue=false', () => {
        const result = resolver.resolve('accountid_status', false);
        expect(result!.fields).toEqual(['accountid_status']);
        expect(result!.codeField).toBeUndefined();
      });

      it('should NOT expand code fields when showRealValue=false', () => {
        const result = resolver.resolve('accountid_statuscode', false);
        expect(result!.fields).toEqual(['accountid_statuscode']);
        expect(result!.isCodeField).toBe(true);
      });

      it('expandFields should respect showRealValue=false', () => {
        const result = resolver.expandFields(['accountid_status', 'accountid_telephone1'], false);
        expect(result).toEqual(['accountid_status', 'accountid_telephone1']);
        expect(result).not.toContain('accountid_statuscode');
      });

      it('expandFields should expand when showRealValue=true', () => {
        const result = resolver.expandFields(['accountid_status', 'accountid_telephone1'], true);
        expect(result).toContain('accountid_status');
        expect(result).toContain('accountid_statuscode');
        expect(result).toContain('accountid_telephone1');
      });
    });
  });

  describe('expandRelatedFields (without metadata)', () => {
    it('should expand code fields only', () => {
      const result = expandRelatedFields(['accountid_statuscode', 'telephone1']);
      expect(result).toContain('accountid_statuscode');
      expect(result).toContain('accountid_status');
      expect(result).toContain('telephone1');
    });

    it('should not expand non-code related fields without metadata', () => {
      const result = expandRelatedFields(['accountid_telephone1']);
      expect(result).toEqual(['accountid_telephone1']);
    });

    it('should handle non-related fields unchanged', () => {
      const result = expandRelatedFields(['telephone1', 'emailaddress1']);
      expect(result).toEqual(['telephone1', 'emailaddress1']);
    });
  });

  describe('getRelatedFieldInfo', () => {
    it('should combine parsing and resolution info', () => {
      const result = getRelatedFieldInfo('accountid_statuscode');
      expect(result).not.toBeNull();
      // Parsing info
      expect(result!.referenceField).toBe('accountid');
      expect(result!.relatedField).toBe('statuscode');
      expect(result!.relatedObjectType).toBe(1);
      // Resolution info
      expect(result!.fields).toContain('accountid_statuscode');
      expect(result!.fields).toContain('accountid_status');
      expect(result!.isCodeField).toBe(true);
    });

    it('should return null for non-related fields', () => {
      expect(getRelatedFieldInfo('telephone1')).toBeNull();
    });
  });
});
