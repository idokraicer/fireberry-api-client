// Field type constants
export { FIELD_TYPE_IDS, FIELD_TYPE_MAPPINGS } from './fieldTypes';

// Object ID mappings
export { OBJECT_ID_MAP, getObjectIdFieldName } from './objectIds';

// Object name mappings
export { OBJECT_NAME_MAP, getNameFieldByObjectType } from './objectNames';

// Excluded fields for star queries and lookup relations
export {
  EXCLUDED_FIELDS_FOR_STAR_QUERY,
  EXCLUDED_LOOKUP_FIELDS,
  isExcludedFromStarQuery,
  getExcludedFieldsForStarQuery,
} from './excludedFields';
