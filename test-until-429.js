#!/usr/bin/env node

/**
 * Query continuously until hitting 429 error
 * Object 1, 10 records per page, fields: accountname,accountid
 */

import { FireberryClient } from './dist/index.js';

async function queryUntil429() {
  console.log('🧪 Querying Until 429 Error\n');
  console.log('Press Ctrl+C to stop\n');

  // Check for API key
  if (!process.env.FIREBERRY_TOKEN) {
    console.error('❌ FIREBERRY_TOKEN environment variable not set');
    process.exit(1);
  }

  const client = new FireberryClient({
    apiKey: process.env.FIREBERRY_TOKEN,
    timeout: 30000,
    retryOn429: false, // DISABLE retry to see 429 errors immediately
    maxRetries: 0,
  });

  let queryCount = 0;
  let totalRecords = 0;
  let errorCount = 0;
  let rateLimitCount = 0;
  const startTime = Date.now();

  console.log('🔄 Starting continuous queries...');
  console.log('   Object Type: 1 (Accounts)');
  console.log('   Fields: accountname,accountid');
  console.log('   Page Size: 10');
  console.log('   Retry on 429: DISABLED (to detect 429 immediately)\n');

  try {
    while (true) {
      queryCount++;

      try {
        const result = await client.query({
          objectType: '1',
          fields: 'accountname,accountid',
          pageSize: 10,
          autoPage: false,
        });

        totalRecords += result.records.length;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (queryCount / (Date.now() - startTime) * 1000).toFixed(2);

        if (queryCount % 100 === 0) {
          console.log(`✅ Query ${queryCount}: ${result.records.length} records | Total: ${totalRecords} | ${elapsed}s | ${rate} q/s`);
        }

      } catch (error) {
        errorCount++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        console.error(`\n${'='.repeat(70)}`);
        console.error(`❌ ERROR on query ${queryCount} (${elapsed}s elapsed)`);
        console.error(`${'='.repeat(70)}`);
        console.error(`Error Code: ${error.code}`);
        console.error(`Status Code: ${error.statusCode}`);
        console.error(`Message: ${error.message}`);

        if (error.context) {
          console.error(`Context:`, JSON.stringify(error.context, null, 2));
        }

        if (error.statusCode === 429 || error.code === 'RATE_LIMITED') {
          rateLimitCount++;
          console.error(`\n🎯 RATE LIMIT ERROR DETECTED!`);
          console.error(`   Query number: ${queryCount}`);
          console.error(`   Time to hit rate limit: ${elapsed}s`);
          console.error(`   Queries per second: ${rate}`);
          console.error(`   Total successful queries: ${queryCount - errorCount}`);
          console.error(`   Total records retrieved: ${totalRecords}`);

          console.error(`\n✅ Successfully found 429 error after ${queryCount} queries!`);
        } else {
          console.error(`\n⚠️  Non-429 error encountered`);
        }

        console.error(`\n📊 Stats at error:`);
        console.error(`   Total queries: ${queryCount}`);
        console.error(`   Successful: ${queryCount - errorCount}`);
        console.error(`   Failed: ${errorCount}`);
        console.error(`   Rate limit errors: ${rateLimitCount}`);
        console.error(`   Records retrieved: ${totalRecords}`);
        console.error(`${'='.repeat(70)}\n`);

        // Stop on any error
        throw error;
      }
    }
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n${'='.repeat(70)}`);
    console.log('🛑 Test stopped');
    console.log(`${'='.repeat(70)}`);
    console.log(`Total runtime: ${totalTime}s`);
    console.log(`Total queries: ${queryCount}`);
    console.log(`Successful: ${queryCount - errorCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log(`Rate limit errors (429): ${rateLimitCount}`);
    console.log(`Records retrieved: ${totalRecords}`);
    console.log(`Average rate: ${(queryCount / totalTime).toFixed(2)} queries/sec`);
    console.log(`${'='.repeat(70)}`);

    if (rateLimitCount > 0) {
      console.log('\n✅ Successfully detected 429 rate limit error!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Stopped without hitting 429 error');
      process.exit(1);
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Interrupted by user (Ctrl+C)');
  console.log('   No 429 error was encountered before interruption');
  process.exit(0);
});

// Run the test
queryUntil429().catch((error) => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
