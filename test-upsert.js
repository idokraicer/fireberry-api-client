#!/usr/bin/env node

/**
 * Test script to verify upsert functionality
 * Tests both create and update paths with proper ID field handling
 */

import { FireberryClient } from './dist/index.js';

async function testUpsert() {
  console.log('🧪 Testing Upsert Functionality\n');

  // Check for API key
  if (!process.env.FIREBERRY_TOKEN) {
    console.error('❌ FIREBERRY_TOKEN environment variable not set');
    process.exit(1);
  }

  const client = new FireberryClient({
    apiKey: process.env.FIREBERRY_TOKEN,
    timeout: 30000,
  });

  const testName = `Upsert Test ${Date.now()}`;
  let recordId = null;

  try {
    // Test 1: Upsert should CREATE a new record
    console.log('📝 Test 1: Upsert with no existing record (should CREATE)');
    console.log(`   Key field: accountname = "${testName}"`);

    const result1 = await client.records.upsert(
      '1', // Account object type
      ['accountname'], // Key fields
      {
        accountname: testName,
        description: 'Initial description',
      }
    );

    console.log(`   ✅ Operation: ${result1.operationType}`);
    console.log(`   ✅ Success: ${result1.success}`);

    if (result1.operationType !== 'create') {
      throw new Error(`Expected 'create', got '${result1.operationType}'`);
    }

    // Extract record ID
    recordId = result1.newRecord?.accountid || result1.newRecord?.AccountId || result1.newRecord?.id;
    console.log(`   ✅ Created record ID: ${recordId}`);

    if (!recordId || recordId === 'undefined') {
      throw new Error('Record ID is undefined or invalid!');
    }

    // Test 2: Upsert should UPDATE the existing record
    console.log('\n📝 Test 2: Upsert with existing record (should UPDATE)');
    console.log(`   Key field: accountname = "${testName}"`);

    const result2 = await client.records.upsert(
      '1',
      ['accountname'],
      {
        accountname: testName,
        description: 'Updated description',
      }
    );

    console.log(`   ✅ Operation: ${result2.operationType}`);
    console.log(`   ✅ Success: ${result2.success}`);

    if (result2.operationType !== 'update') {
      throw new Error(`Expected 'update', got '${result2.operationType}'`);
    }

    const updatedId = result2.newRecord?.accountid || result2.newRecord?.AccountId || result2.newRecord?.id;
    console.log(`   ✅ Updated record ID: ${updatedId}`);

    if (!updatedId || updatedId === 'undefined') {
      throw new Error('Updated record ID is undefined or invalid!');
    }

    if (updatedId !== recordId) {
      throw new Error(`Record ID changed! Expected ${recordId}, got ${updatedId}`);
    }

    // Test 3: Verify the update actually worked
    console.log('\n📝 Test 3: Query to verify the update');
    const queryResult = await client.query({
      objectType: '1',
      fields: 'accountid,accountname,description',
      query: `(accountname = ${testName})`,
      limit: 1,
    });

    console.log(`   ✅ Found ${queryResult.records.length} record(s)`);

    if (queryResult.records.length === 0) {
      throw new Error('Record not found in query!');
    }

    const record = queryResult.records[0];
    const queriedId = record.accountid || record.AccountId || record.id;
    console.log(`   ✅ Queried record ID: ${queriedId}`);
    console.log(`   ✅ Description: ${record.description}`);

    if (record.description !== 'Updated description') {
      throw new Error(`Description not updated! Got: ${record.description}`);
    }

    console.log('\n✅ All upsert tests passed!');
    console.log('\n🎉 Upsert functionality is working correctly!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.statusCode) {
      console.error(`   Status: ${error.statusCode}`);
    }
    if (error.context) {
      console.error('   Context:', JSON.stringify(error.context, null, 2));
    }
    console.error('\n   Full error:', error);
    process.exit(1);
  } finally {
    // Cleanup: Delete the test record
    if (recordId && recordId !== 'undefined') {
      try {
        console.log('\n🧹 Cleaning up test record...');
        await client.records.delete('1', recordId);
        console.log('   ✅ Test record deleted');
      } catch (cleanupError) {
        console.error('   ⚠️  Cleanup failed:', cleanupError.message);
      }
    }
  }
}

// Run the test
testUpsert().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
