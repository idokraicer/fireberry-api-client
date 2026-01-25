#!/usr/bin/env node

/**
 * Aggressive test to force 429 rate limit errors
 * Sends all queries simultaneously to overwhelm rate limits
 */

import { FireberryClient } from './dist/index.js';

async function testRateLimitAggressive() {
  console.log('🧪 Aggressive 429 Rate Limit Test\n');

  // Check for API key
  if (!process.env.FIREBERRY_TOKEN) {
    console.error('❌ FIREBERRY_TOKEN environment variable not set');
    process.exit(1);
  }

  // Create client with DISABLED retry to see raw 429 errors
  const clientNoRetry = new FireberryClient({
    apiKey: process.env.FIREBERRY_TOKEN,
    timeout: 30000,
    retryOn429: false, // DISABLE retry to see raw errors
    maxRetries: 0,
  });

  // Create client WITH retry enabled for comparison
  const clientWithRetry = new FireberryClient({
    apiKey: process.env.FIREBERRY_TOKEN,
    timeout: 30000,
    retryOn429: true,
    maxRetries: 120,
    retryDelay: 1000,
  });

  console.log('🔴 TEST 1: Send 300 queries with NO RETRY (should expose 429 errors)\n');

  const totalQueries = 300;
  let successCount = 0;
  let errorCount = 0;
  let rateLimitErrors = 0;
  const errors = [];

  const startTime = Date.now();

  // Send ALL queries simultaneously to trigger rate limiting
  const promises = [];
  for (let i = 0; i < totalQueries; i++) {
    const queryNum = i + 1;

    const promise = clientNoRetry.query({
      objectType: '1',
      fields: 'accountid,accountname',
      limit: 1,
      autoPage: false,
    }).then((result) => {
      successCount++;
      return { success: true, queryNum };
    }).catch((error) => {
      errorCount++;

      const errorInfo = {
        queryNum,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        retryCount: error.context?.retryCount,
      };

      if (error.statusCode === 429 || error.code === 'RATE_LIMITED') {
        rateLimitErrors++;
        if (queryNum <= 10 || rateLimitErrors <= 5) {
          console.error(`🚫 Query ${queryNum} got 429: ${error.message}`);
        }
      }

      errors.push(errorInfo);
      return { success: false, queryNum, error: errorInfo };
    });

    promises.push(promise);
  }

  await Promise.all(promises);

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST 1 RESULTS (NO RETRY)');
  console.log('='.repeat(60));
  console.log(`Total queries: ${totalQueries}`);
  console.log(`Successful: ${successCount} (${((successCount / totalQueries) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${errorCount} (${((errorCount / totalQueries) * 100).toFixed(1)}%)`);
  console.log(`Rate limit errors (429): ${rateLimitErrors}`);
  console.log(`Total time: ${totalTime}s`);

  if (rateLimitErrors === 0) {
    console.log('\n⚠️  WARNING: No 429 errors detected!');
    console.log('   Either the rate limit is very high, or there are other issues.');
  }

  // TEST 2: With retry enabled
  console.log('\n' + '='.repeat(60));
  console.log('🟢 TEST 2: Send 300 queries WITH RETRY (should handle 429s)\n');

  let successCount2 = 0;
  let errorCount2 = 0;
  let rateLimitErrors2 = 0;

  const startTime2 = Date.now();

  const promises2 = [];
  for (let i = 0; i < totalQueries; i++) {
    const queryNum = i + 1;

    const promise = clientWithRetry.query({
      objectType: '1',
      fields: 'accountid,accountname',
      limit: 1,
      autoPage: false,
    }).then((result) => {
      successCount2++;
      if (queryNum % 100 === 0) {
        const elapsed = ((Date.now() - startTime2) / 1000).toFixed(1);
        console.log(`✅ Query ${queryNum}/${totalQueries} succeeded (${elapsed}s elapsed)`);
      }
      return { success: true, queryNum };
    }).catch((error) => {
      errorCount2++;

      if (error.statusCode === 429 || error.code === 'RATE_LIMITED') {
        rateLimitErrors2++;
        console.error(`🚫 Query ${queryNum} FAILED with 429 after retries: ${error.message}`);
        if (error.context?.retryCount !== undefined) {
          console.error(`   Exhausted ${error.context.retryCount} retries`);
        }
      } else {
        console.error(`❌ Query ${queryNum} failed: ${error.message}`);
      }

      return { success: false, queryNum };
    });

    promises2.push(promise);
  }

  await Promise.all(promises2);

  const endTime2 = Date.now();
  const totalTime2 = ((endTime2 - startTime2) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST 2 RESULTS (WITH RETRY)');
  console.log('='.repeat(60));
  console.log(`Total queries: ${totalQueries}`);
  console.log(`Successful: ${successCount2} (${((successCount2 / totalQueries) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${errorCount2} (${((errorCount2 / totalQueries) * 100).toFixed(1)}%)`);
  console.log(`Rate limit errors (429): ${rateLimitErrors2}`);
  console.log(`Total time: ${totalTime2}s`);

  console.log('\n' + '='.repeat(60));
  console.log('🎯 FINAL ANALYSIS');
  console.log('='.repeat(60));

  if (rateLimitErrors > 0 && rateLimitErrors2 === 0) {
    console.log('✅ RETRY LOGIC WORKING CORRECTLY');
    console.log(`   - Without retry: ${rateLimitErrors} rate limit errors`);
    console.log(`   - With retry: ${rateLimitErrors2} rate limit errors`);
    console.log('   All 429 errors were successfully retried!');
  } else if (rateLimitErrors2 > 0) {
    console.log('⚠️  POTENTIAL ISSUE: Retry logic may not be working');
    console.log(`   - With retry enabled: ${rateLimitErrors2} queries still failed with 429`);
    console.log('   - This suggests retries are being exhausted');
    console.log('   - Or retry logic is not being triggered');
    process.exit(1);
  } else if (rateLimitErrors === 0) {
    console.log('ℹ️  No rate limits hit in either test');
    console.log('   - The API rate limit may be higher than 300 concurrent queries');
    console.log('   - Or there may be no aggressive rate limiting');
  }
}

// Run the test
testRateLimitAggressive().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
