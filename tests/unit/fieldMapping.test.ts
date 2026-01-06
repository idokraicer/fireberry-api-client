import { describe, it, expect } from 'vitest';
import { getLabelFieldForField } from '../../src/utils/fieldMapping';

describe('fieldMapping', () => {
  describe('getLabelFieldForField', () => {
    describe('special mappings', () => {
      it('should map objectid to objecttitle', () => {
        expect(getLabelFieldForField('objectid', '1')).toBe('objecttitle');
      });

      it('should map lastactionid to lastactiontitle', () => {
        expect(getLabelFieldForField('lastactionid', '1')).toBe('lastactiontitle');
      });

      it('should map wfruleid to rulename', () => {
        expect(getLabelFieldForField('wfruleid', '55')).toBe('rulename');
      });

      it('should map noteid to subject', () => {
        expect(getLabelFieldForField('noteid', '7')).toBe('subject');
      });
    });

    describe('fields without label field', () => {
      it('should return empty string for systemfieldid', () => {
        expect(getLabelFieldForField('systemfieldid', '73')).toBe('');
      });

      it('should return empty string for invoiceid', () => {
        expect(getLabelFieldForField('invoiceid', '78')).toBe('');
      });

      it('should return empty string for deletedby', () => {
        expect(getLabelFieldForField('deletedby', '7')).toBe('');
      });
    });

    describe('custom object primary keys', () => {
      it('should map customobjectXid to name', () => {
        expect(getLabelFieldForField('customobject1000id', '1000')).toBe('name');
        expect(getLabelFieldForField('customobject1500id', '1500')).toBe('name');
      });
    });

    describe('custom fields (pcf prefix)', () => {
      it('should append name to pcf fields', () => {
        expect(getLabelFieldForField('pcfcustom', '1')).toBe('pcfcustomname');
        expect(getLabelFieldForField('pcf_field', '1')).toBe('pcf_fieldname');
        expect(getLabelFieldForField('pcfsystemfield100', '1')).toBe('pcfsystemfield100name');
      });
    });

    describe('code suffix fields', () => {
      it('should remove code suffix for standard fields', () => {
        expect(getLabelFieldForField('statuscode', '1')).toBe('status');
        expect(getLabelFieldForField('industrycode', '1')).toBe('industry');
      });

      it('should keep code suffix for excluded fields', () => {
        expect(getLabelFieldForField('duplicaterecordcode', '1')).toBe('duplicaterecordcodename');
      });

      it('should keep code suffix for object-specific exclusions', () => {
        // Object 13 (CRM Orders) excludes statuscode
        expect(getLabelFieldForField('statuscode', '13')).toBe('statuscodename');
        expect(getLabelFieldForField('currencycode', '13')).toBe('currencycodename');
      });
    });

    describe('id suffix fields', () => {
      it('should replace id with name for standard fields', () => {
        expect(getLabelFieldForField('accountid', '1')).toBe('accountname');
        expect(getLabelFieldForField('contactid', '2')).toBe('contactname');
        expect(getLabelFieldForField('leadid', '3')).toBe('leadname');
      });

      it('should keep id for excluded fields', () => {
        expect(getLabelFieldForField('businessunitid', '1')).toBe('businessunitidname');
        expect(getLabelFieldForField('languageid', '1')).toBe('languageidname');
      });

      it('should keep id for object-specific exclusions', () => {
        // Object 13 excludes ownerid
        expect(getLabelFieldForField('ownerid', '13')).toBe('owneridname');
      });

      it('should keep id for custom object ownerid', () => {
        // Custom objects (1000+) exclude ownerid by default
        expect(getLabelFieldForField('ownerid', '1000')).toBe('owneridname');
        expect(getLabelFieldForField('ownerid', '1500')).toBe('owneridname');
      });
    });

    describe('default behavior', () => {
      it('should append name to fields without special rules', () => {
        expect(getLabelFieldForField('someotherfield', '1')).toBe('someotherfieldname');
        expect(getLabelFieldForField('customfield', '1')).toBe('customfieldname');
      });
    });

    describe('object type handling', () => {
      it('should handle string object types', () => {
        expect(getLabelFieldForField('accountid', '1')).toBe('accountname');
      });

      it('should handle number object types', () => {
        expect(getLabelFieldForField('accountid', 1)).toBe('accountname');
      });
    });
  });
});
