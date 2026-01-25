/**
 * Test script to check objects 70-90 with star queries
 * to identify problematic fields
 */

import { FireberryClient } from './dist/index.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new FireberryClient({
  apiKey: process.env.FIREBERRY_TOKEN,
  baseURL: 'https://app.fireberry.com/api',
});

async function testObjectStarQuery(objectType) {
  try {
    console.log(`\n🔍 Testing object ${objectType}...`);

    // Try to fetch with * (all fields)
    const result = await client.query({
      objectType,
      fields: '*',
      limit: 1, // Just get 1 record to test
    });

    console.log(`✅ Object ${objectType}: SUCCESS (${result.records.length} records, ${result.fields?.length || 0} fields)`);
    if (result.fields && result.fields.length > 0) {
      console.log(`   Fields: ${result.fields.slice(0, 10).join(', ')}${result.fields.length > 10 ? '...' : ''}`);
    }

    return { objectType, success: true, fields: result.fields };
  } catch (error) {
    console.log(`❌ Object ${objectType}: FAILED`);
    console.log(`   Error: ${error.message}`);

    // Try to get metadata to see what fields exist
    try {
      const metadata = await client.metadata.getFields(objectType);
      const fieldNames = metadata.map(f => f.name);
      console.log(`   Available fields (${fieldNames.length}): ${fieldNames.slice(0, 10).join(', ')}${fieldNames.length > 10 ? '...' : ''}`);

      // Now try to identify problematic fields by testing common ones
      const commonProblematicFields = ['deletedon', 'deletedby', 's', 'w', 'o', 't', 'description'];
      const problematicFields = [];

      for (const field of commonProblematicFields) {
        if (fieldNames.includes(field)) {
          problematicFields.push(field);
        }
      }

      if (problematicFields.length > 0) {
        console.log(`   Potentially problematic fields: ${problematicFields.join(', ')}`);

        // Test without those fields
        const fieldsToTest = fieldNames.filter(f => !problematicFields.includes(f)).slice(0, 20).join(',');
        try {
          await client.query({
            objectType,
            fields: fieldsToTest,
            limit: 1,
          });
          console.log(`   ✓ Query works without: ${problematicFields.join(', ')}`);
          return { objectType, success: false, problematicFields, allFields: fieldNames };
        } catch (e) {
          console.log(`   ✗ Still fails without common problematic fields`);
        }
      }

      return { objectType, success: false, error: error.message, allFields: fieldNames };
    } catch (metaError) {
      console.log(`   Could not fetch metadata: ${metaError.message}`);
      return { objectType, success: false, error: error.message };
    }
  }
}

async function testRange() {
  console.log('🚀 Testing objects 70-90 with star queries\n');
  console.log('='.repeat(60));

  const results = [];

  for (let i = 70; i <= 90; i++) {
    const result = await testObjectStarQuery(i);
    results.push(result);

    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SUMMARY\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n🔴 Failed objects:');
    failed.forEach(r => {
      console.log(`\n  Object ${r.objectType}:`);
      if (r.problematicFields) {
        console.log(`    Exclude: [${r.problematicFields.map(f => `'${f}'`).join(', ')}]`);
      } else {
        console.log(`    Error: ${r.error || 'Unknown'}`);
      }
    });

    console.log('\n📝 Suggested additions to EXCLUDED_FIELDS_FOR_STAR_QUERY:');
    failed.forEach(r => {
      if (r.problematicFields) {
        console.log(`  '${r.objectType}': [${r.problematicFields.map(f => `'${f}'`).join(', ')}],`);
      }
    });
  }

  if (successful.length > 0) {
    console.log('\n✅ Objects working fine with star queries:');
    console.log(`  ${successful.map(r => r.objectType).join(', ')}`);
  }
}

testRange().catch(console.error);
