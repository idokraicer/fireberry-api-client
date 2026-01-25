#!/usr/bin/env node

/**
 * Continuous query test - keeps querying until error or manual stop
 * Queries object 1 with 500 records per page in an infinite loop
 */

import { FireberryClient } from './dist/index.js';

async function continuousQueryTest() {
  console.log('🧪 Continuous Query Test\n');
  console.log('Press Ctrl+C to stop\n');

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

  let queryCount = 0;
  let totalRecords = 0;
  let errorCount = 0;
  let rateLimitCount = 0;
  const startTime = Date.now();

  console.log('🔄 Starting continuous queries...');
  console.log('   Object Type: 1 (Accounts)');
  console.log('   Page Size: 500');
  console.log('   Auto Page: false (single page per query)');
  console.log('   Retry on 429: enabled\n');

  try {
    while (true) {
      queryCount++;

      try {
        const result = await client.query({
          objectType: '1',
          fields: 'accountid,accountname',
          pageSize: 500,
          autoPage: false, // Just get one page
        });

        totalRecords += result.records.length;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (queryCount / (Date.now() - startTime) * 1000).toFixed(2);

        console.log(`✅ Query ${queryCount}: ${result.records.length} records | Total: ${totalRecords} | Elapsed: ${elapsed}s | Rate: ${rate} queries/sec`);

      } catch (error) {
        errorCount++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        console.error(`\n${'='.repeat(60)}`);
        console.error(`❌ ERROR on query ${queryCount} (${elapsed}s elapsed)`);
        console.error(`${'='.repeat(60)}`);
        console.error(`Error Code: ${error.code}`);
        console.error(`Status Code: ${error.statusCode}`);
        console.error(`Message: ${error.message}`);

        if (error.context) {
          console.error(`Context:`, JSON.stringify(error.context, null, 2));
        }

        if (error.statusCode === 429 || error.code === 'RATE_LIMITED') {
          rateLimitCount++;
          console.error(`\n🚫 RATE LIMIT ERROR DETECTED!`);
          console.error(`   This is query #${queryCount}`);
          console.error(`   Rate limit errors so far: ${rateLimitCount}`);

          if (error.context?.retryCount !== undefined) {
            console.error(`   Retries exhausted: ${error.context.retryCount}`);
          }

          console.error(`\n⚠️  The retry logic may not be working correctly!`);
        }

        console.error(`\n📊 Stats at error:`);
        console.error(`   Total queries attempted: ${queryCount}`);
        console.error(`   Successful queries: ${queryCount - errorCount}`);
        console.error(`   Total errors: ${errorCount}`);
        console.error(`   Rate limit errors: ${rateLimitCount}`);
        console.error(`   Total records retrieved: ${totalRecords}`);
        console.error(`${'='.repeat(60)}\n`);

        // Stop on error
        throw error;
      }

      // Small delay to see output (remove this if you want maximum speed)
      // await new Promise(resolve => setTimeout(resolve, 10));
    }
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n${'='.repeat(60)}`);
    console.log('🛑 Test stopped due to error');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total runtime: ${totalTime}s`);
    console.log(`Total queries: ${queryCount}`);
    console.log(`Successful: ${queryCount - errorCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log(`Rate limit errors: ${rateLimitCount}`);
    console.log(`Records retrieved: ${totalRecords}`);
    console.log(`Average rate: ${(queryCount / totalTime).toFixed(2)} queries/sec`);
    console.log(`${'='.repeat(60)}`);

    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Interrupted by user (Ctrl+C)');
  process.exit(0);
});

// Run the test
continuousQueryTest().catch((error) => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});
