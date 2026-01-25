#!/usr/bin/env node

/**
 * Test script to verify 429 rate limit handling
 * Makes 300 rapid queries to trigger rate limiting and verify retry logic
 */

import { FireberryClient } from './dist/index.js';

async function testRateLimit() {
  console.log('🧪 Testing 429 Rate Limit Handling\n');

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

  const totalQueries = 300;
  let successCount = 0;
  let errorCount = 0;
  let rateLimitErrors = 0;
  const errors = [];

  console.log(`📊 Starting ${totalQueries} rapid queries...`);
  console.log(`⚙️  Retry settings: maxRetries=120, retryDelay=1000ms\n`);

  const startTime = Date.now();

  // Make queries in batches to avoid overwhelming the system
  const batchSize = 10;
  for (let i = 0; i < totalQueries; i += batchSize) {
    const batchPromises = [];

    for (let j = 0; j < batchSize && (i + j) < totalQueries; j++) {
      const queryNum = i + j + 1;

      const promise = client.query({
        objectType: '1', // Accounts
        fields: 'accountid,accountname',
        limit: 1,
        autoPage: false,
      }).then((result) => {
        successCount++;
        if (queryNum % 50 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`✅ Query ${queryNum}/${totalQueries} succeeded (${elapsed}s elapsed)`);
        }
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
          console.error(`🚫 Query ${queryNum} RATE LIMITED: ${error.message}`);
          if (error.context?.retryCount !== undefined) {
            console.error(`   Retries exhausted: ${error.context.retryCount}`);
          }
        } else {
          console.error(`❌ Query ${queryNum} failed: ${error.message} (${error.code})`);
        }

        errors.push(errorInfo);
        return { success: false, queryNum, error: errorInfo };
      });

      batchPromises.push(promise);
    }

    // Wait for batch to complete
    await Promise.all(batchPromises);
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(60));
  console.log(`Total queries: ${totalQueries}`);
  console.log(`Successful: ${successCount} (${((successCount / totalQueries) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${errorCount} (${((errorCount / totalQueries) * 100).toFixed(1)}%)`);
  console.log(`Rate limit errors (429): ${rateLimitErrors}`);
  console.log(`Total time: ${totalTime}s`);
  console.log(`Average: ${(totalTime / totalQueries).toFixed(3)}s per query`);

  if (errors.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ ERROR DETAILS');
    console.log('='.repeat(60));

    const errorsByCode = {};
    errors.forEach(err => {
      const code = err.code || 'UNKNOWN';
      if (!errorsByCode[code]) {
        errorsByCode[code] = [];
      }
      errorsByCode[code].push(err);
    });

    Object.entries(errorsByCode).forEach(([code, errs]) => {
      console.log(`\n${code}: ${errs.length} errors`);
      errs.slice(0, 3).forEach(err => {
        console.log(`  - Query ${err.queryNum}: ${err.message}`);
        if (err.retryCount !== undefined) {
          console.log(`    Retries: ${err.retryCount}`);
        }
      });
      if (errs.length > 3) {
        console.log(`  ... and ${errs.length - 3} more`);
      }
    });
  }

  console.log('\n' + '='.repeat(60));

  if (rateLimitErrors > 0) {
    console.log('⚠️  WARNING: Rate limit errors detected!');
    console.log('   The retry logic may not be working correctly.');
    console.log('   Expected: 429 errors should be automatically retried');
    console.log(`   Actual: ${rateLimitErrors} queries failed with rate limit errors`);
    process.exit(1);
  } else if (errorCount > 0) {
    console.log('⚠️  Some queries failed, but no rate limit errors detected.');
    console.log('   Check error details above.');
    process.exit(1);
  } else {
    console.log('✅ All queries succeeded!');
    console.log('   The 429 retry logic appears to be working correctly.');
  }
}

// Run the test
testRateLimit().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
