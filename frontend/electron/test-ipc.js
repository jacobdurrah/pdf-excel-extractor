#!/usr/bin/env node
/**
 * Test script for IPC Bridge
 * Run this to verify basic communication between Node.js and Python
 */

const IPCBridge = require('./ipc-bridge-standalone');

async function runTests() {
  console.log('Starting IPC Bridge tests...\n');

  try {
    // Test 1: Initialize bridge
    console.log('Test 1: Initializing IPC Bridge...');
    await IPCBridge.initialize();
    console.log('✓ IPC Bridge initialized successfully');
    console.log(`  - Python version: ${IPCBridge.pythonVersion}`);
    console.log(`  - Python path: ${IPCBridge.pythonPath}\n`);

    // Test 2: Send ping
    console.log('Test 2: Testing ping/pong...');
    const pingResult = await IPCBridge.sendRequest('ping', {});
    console.log('✓ Ping successful\n');

    // Test 3: Test extraction request
    console.log('Test 3: Testing extraction request...');
    const extractionResult = await IPCBridge.sendRequest('extraction.process', {
      file: '/path/to/test.pdf',
      mode: 'automatic'
    });
    console.log('✓ Extraction request successful');
    console.log(`  - Session ID: ${extractionResult.sessionId}`);
    console.log(`  - Fields found: ${extractionResult.fields.length}\n`);

    // Test 4: Test file validation
    console.log('Test 4: Testing file validation...');
    const validationResult = await IPCBridge.sendRequest('file.validate', {
      path: '/path/to/test.pdf'
    });
    console.log('✓ File validation successful');
    console.log(`  - Valid: ${validationResult.valid}`);
    console.log(`  - MIME type: ${validationResult.mimeType}\n`);

    // Test 5: Test error handling
    console.log('Test 5: Testing error handling...');
    try {
      await IPCBridge.sendRequest('invalid.type', {});
    } catch (error) {
      console.log('✓ Error handling works correctly');
      console.log(`  - Error: ${error.message}\n`);
    }

    // Test 6: Test concurrent requests
    console.log('Test 6: Testing concurrent requests...');
    const concurrentRequests = [
      IPCBridge.sendRequest('ping', {}),
      IPCBridge.sendRequest('file.validate', { path: '/test1.pdf' }),
      IPCBridge.sendRequest('file.validate', { path: '/test2.pdf' }),
      IPCBridge.sendRequest('ping', {})
    ];
    const results = await Promise.all(concurrentRequests);
    console.log(`✓ Concurrent requests successful (${results.length} requests)\n`);

    // Test 7: Test timeout
    console.log('Test 7: Testing request timeout...');
    try {
      // Use a very short timeout
      await IPCBridge.sendRequest('extraction.process', { 
        file: '/large/file.pdf' 
      }, 100); // 100ms timeout
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.log('✓ Timeout handling works correctly');
        console.log(`  - Error: ${error.message}\n`);
      } else {
        throw error;
      }
    }

    // Cleanup
    console.log('Shutting down IPC Bridge...');
    await IPCBridge.shutdown();
    console.log('✓ IPC Bridge shut down successfully');

    console.log('\n✅ All tests passed!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Set up event listeners for debugging
IPCBridge.on('connected', () => {
  console.log('[Event] Connected to Python backend');
});

IPCBridge.on('disconnected', () => {
  console.log('[Event] Disconnected from Python backend');
});

IPCBridge.on('error', (error) => {
  console.error('[Event] Error:', error);
});

IPCBridge.on('event', (message) => {
  console.log('[Event] Received event:', message.type);
});

// Run tests
if (require.main === module) {
  runTests();
}

module.exports = runTests;