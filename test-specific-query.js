#!/usr/bin/env node

/**
 * Test specific query: object 1, 10 records per page, fields: fullname,accountid
 */

import { FireberryClient } from './dist/index.js';

async function testSpecificQuery() {
  console.log('🧪 Testing Specific Query\n');

  // Check for API key
  if (!process.env.FIREBERRY_TOKEN) {
    console.error('❌ FIREBERRY_TOKEN environment variable not set');
    process.exit(1);
  }

  const client = new FireberryClient({
    apiKey: process.env.FIREBERRY_TOKEN,
    timeout: 30000,
    retryOn429: true,
    maxRetries: 120,
    retryDelay: 1000,
  });

  console.log('📊 Query parameters:');
  console.log('   Object Type: 1 (Accounts)');
  console.log('   Page Size: 10');
  console.log('   Fields: fullname,accountid');
  console.log('   Auto Page: false\n');

  const startTime = Date.now();

  try {
    const result = await client.query({
      objectType: '1',
      fields: 'fullname,accountid',
      pageSize: 10,
      autoPage: false,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✅ Query successful!');
    console.log(`   Time: ${elapsed}s`);
    console.log(`   Records returned: ${result.records.length}`);
    console.log(`   Success: ${result.success}`);

    console.log('\n📋 Records:');
    result.records.forEach((record, index) => {
      console.log(`   ${index + 1}. fullname: ${record.fullname || '(null)'}, accountid: ${record.accountid || '(null)'}`);
    });

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.error('\n❌ Query failed!');
    console.error(`   Time: ${elapsed}s`);
    console.error(`   Error Code: ${error.code}`);
    console.error(`   Status Code: ${error.statusCode}`);
    console.error(`   Message: ${error.message}`);

    if (error.context) {
      console.error(`   Context:`, JSON.stringify(error.context, null, 2));
    }

    console.error('\n   Full error:', error);
    process.exit(1);
  }
}

// Run the test
testSpecificQuery().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
