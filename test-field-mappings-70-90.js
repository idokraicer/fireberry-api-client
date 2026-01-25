/**
 * Test script to verify ID → name field mappings for objects 70-90
 */

import { FireberryClient, OBJECT_ID_MAP, OBJECT_NAME_MAP } from './dist/index.js';
import dotenv from 'dotenv';

dotenv.config();

function getObjectIdFieldName(objectType) {
  const objectTypeNum = typeof objectType === 'string' ? parseInt(objectType, 10) : objectType;
  if (OBJECT_ID_MAP[objectTypeNum]) {
    return OBJECT_ID_MAP[objectTypeNum];
  }
  if (objectTypeNum >= 1000) {
    return `customobject${objectTypeNum}id`;
  }
  return 'id';
}

function getNameFieldByObjectType(objectType) {
  const objectTypeNum = typeof objectType === 'string' ? parseInt(objectType, 10) : objectType;
  if (OBJECT_NAME_MAP[objectTypeNum]) {
    return OBJECT_NAME_MAP[objectTypeNum];
  }
  if (objectTypeNum >= 1000) {
    return 'name';
  }
  return 'name';
}

const client = new FireberryClient({
  apiKey: process.env.FIREBERRY_TOKEN,
  baseURL: 'https://app.fireberry.com/api',
});

// Objects that worked in our previous test
const workingObjects = [73, 76, 77, 78, 80, 81, 82, 83, 84, 85, 86, 90];

async function testFieldMapping(objectType) {
  try {
    // Get expected fields from our constants
    const expectedIdField = getObjectIdFieldName(objectType);
    const expectedNameField = getNameFieldByObjectType(objectType);

    console.log(`\n🔍 Object ${objectType}:`);
    console.log(`   Expected ID field: ${expectedIdField}`);
    console.log(`   Expected Name field: ${expectedNameField}`);

    // Query the object
    const result = await client.query({
      objectType,
      fields: '*',
      limit: 1,
    });

    if (result.records.length === 0) {
      console.log(`   ⚠️  No records found - cannot verify`);
      return { objectType, status: 'no-records', expectedIdField, expectedNameField };
    }

    const record = result.records[0];
    const actualFields = Object.keys(record);

    // Check if expected ID field exists
    const hasIdField = actualFields.some(f => f.toLowerCase() === expectedIdField.toLowerCase());
    const actualIdField = actualFields.find(f => f.toLowerCase() === expectedIdField.toLowerCase());

    // Check if expected name field exists
    const hasNameField = actualFields.some(f => f.toLowerCase() === expectedNameField.toLowerCase());
    const actualNameField = actualFields.find(f => f.toLowerCase() === expectedNameField.toLowerCase());

    if (hasIdField && hasNameField) {
      console.log(`   ✅ PASS: Both fields found`);
      console.log(`      ID: ${actualIdField} (value: ${record[actualIdField]})`);
      console.log(`      Name: ${actualNameField} (value: ${record[actualNameField]})`);
      return { objectType, status: 'pass', expectedIdField, expectedNameField, actualIdField, actualNameField };
    } else {
      console.log(`   ❌ FAIL: Missing fields`);
      if (!hasIdField) {
        console.log(`      Missing ID field: ${expectedIdField}`);
      }
      if (!hasNameField) {
        console.log(`      Missing Name field: ${expectedNameField}`);
      }
      console.log(`      Available fields (first 20): ${actualFields.slice(0, 20).join(', ')}`);

      // Try to find similar fields
      const idLikeFields = actualFields.filter(f => f.toLowerCase().includes('id'));
      const nameLikeFields = actualFields.filter(f =>
        f.toLowerCase().includes('name') ||
        f.toLowerCase().includes('number') ||
        f.toLowerCase().includes('subject') ||
        f.toLowerCase().includes('title') ||
        f.toLowerCase().includes('label')
      );

      if (idLikeFields.length > 0) {
        console.log(`      ID-like fields: ${idLikeFields.join(', ')}`);
      }
      if (nameLikeFields.length > 0) {
        console.log(`      Name-like fields: ${nameLikeFields.join(', ')}`);
      }

      return {
        objectType,
        status: 'fail',
        expectedIdField,
        expectedNameField,
        actualFields,
        idLikeFields,
        nameLikeFields,
      };
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { objectType, status: 'error', error: error.message };
  }
}

async function testAll() {
  console.log('🚀 Testing ID → Name field mappings for objects 70-90\n');
  console.log('='.repeat(60));

  const results = [];

  for (const objId of workingObjects) {
    const result = await testFieldMapping(objId);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SUMMARY\n');

  const passed = results.filter(r => r.status === 'pass');
  const failed = results.filter(r => r.status === 'fail');
  const noRecords = results.filter(r => r.status === 'no-records');
  const errors = results.filter(r => r.status === 'error');

  console.log(`✅ Passed: ${passed.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⚠️  No records: ${noRecords.length}`);
  console.log(`💥 Errors: ${errors.length}`);

  if (failed.length > 0) {
    console.log('\n🔴 Failed Mappings - Suggested Corrections:\n');
    failed.forEach(r => {
      console.log(`Object ${r.objectType}:`);
      console.log(`  Current: { id: '${r.expectedIdField}', name: '${r.expectedNameField}' }`);
      if (r.idLikeFields && r.idLikeFields.length > 0) {
        console.log(`  Suggested ID: '${r.idLikeFields[0]}'`);
      }
      if (r.nameLikeFields && r.nameLikeFields.length > 0) {
        console.log(`  Suggested Name: '${r.nameLikeFields[0]}'`);
      }
      console.log('');
    });
  }

  if (passed.length > 0) {
    console.log('\n✅ Verified Correct Mappings:\n');
    passed.forEach(r => {
      console.log(`  ${r.objectType}: { id: '${r.actualIdField}', name: '${r.actualNameField}' }`);
    });
  }
}

testAll().catch(console.error);
