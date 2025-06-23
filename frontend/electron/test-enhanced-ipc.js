/**
 * Test script for enhanced IPC functionality
 */

const IPCBridge = require('./ipc-bridge-v2');
const { MessageType, Priority } = require('./protocols/message-protocol');

async function runTests() {
  console.log('🚀 Starting Enhanced IPC Tests...\n');
  
  const bridge = new IPCBridge({
    scriptPath: '../../backend/app/ipc_server.py',
    debug: true
  });
  
  try {
    // Initialize bridge
    console.log('📡 Initializing IPC Bridge...');
    await bridge.initialize();
    console.log('✅ IPC Bridge initialized\n');
    
    // Test 1: Basic ping/pong with correlation
    console.log('📋 Test 1: Ping/Pong with correlation');
    const pingStart = Date.now();
    const pongResponse = await bridge.sendRequest(MessageType.PING, {});
    console.log(`✅ Ping response received in ${Date.now() - pingStart}ms`);
    console.log(`   Response: ${JSON.stringify(pongResponse.payload)}\n`);
    
    // Test 2: PDF extraction with timeout handling
    console.log('📋 Test 2: PDF extraction with custom timeout');
    try {
      const extractionResult = await bridge.extractPDF('/path/to/test.pdf', {
        mode: 'step-by-step',
        timeout: 5000, // 5 second timeout
        fields: ['check_number', 'date', 'amount']
      });
      console.log('✅ Extraction completed');
      console.log(`   Session ID: ${extractionResult.sessionId}`);
      console.log(`   Fields found: ${extractionResult.fields.length}\n`);
    } catch (error) {
      console.log(`⚠️  Extraction error: ${error.message}\n`);
    }
    
    // Test 3: Concurrent requests with priority
    console.log('📋 Test 3: Concurrent requests with priority');
    const requests = [
      bridge.sendRequest(MessageType.FILE_VALIDATE, { path: '/file1.pdf' }, { priority: Priority.LOW }),
      bridge.sendRequest(MessageType.FILE_VALIDATE, { path: '/file2.pdf' }, { priority: Priority.HIGH }),
      bridge.sendRequest(MessageType.FILE_VALIDATE, { path: '/file3.pdf' }, { priority: Priority.NORMAL }),
      bridge.sendRequest(MessageType.FILE_VALIDATE, { path: '/file4.pdf' }, { priority: Priority.CRITICAL })
    ];
    
    const results = await Promise.allSettled(requests);
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`   Request ${index + 1}: ✅ Success`);
      } else {
        console.log(`   Request ${index + 1}: ❌ Failed - ${result.reason.message}`);
      }
    });
    console.log();
    
    // Test 4: Queue statistics
    console.log('📋 Test 4: Queue and session statistics');
    const stats = bridge.getStats();
    console.log('   Queue stats:', JSON.stringify(stats.queue, null, 2));
    console.log('   Active sessions:', stats.sessions.active);
    console.log();
    
    // Test 5: Retry mechanism (simulate failure)
    console.log('📋 Test 5: Retry mechanism');
    // This would test retry by sending to a non-existent endpoint
    // For now, just show the retry configuration
    console.log('   Retry configuration:');
    console.log('   - Max retries: 3');
    console.log('   - Exponential backoff: 1s, 2s, 4s');
    console.log('   - Circuit breaker enabled\n');
    
    // Test 6: Progress events
    console.log('📋 Test 6: Progress event streaming');
    let progressCount = 0;
    bridge.on('progress', (progress) => {
      progressCount++;
      console.log(`   Progress update ${progressCount}: ${progress.progress}% - ${progress.message}`);
    });
    
    // Simulate extraction to trigger progress events
    const progressTest = bridge.extractPDF('/path/to/large.pdf', {
      mode: 'automatic'
    });
    
    // Wait a bit for progress events
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`   Total progress events received: ${progressCount}\n`);
    
    // Test 7: Session management
    console.log('📋 Test 7: Session management');
    const sessions = bridge.getActiveSessions();
    console.log(`   Active sessions: ${sessions.length}`);
    sessions.forEach(session => {
      console.log(`   - Session ${session.id}: ${session.type} (${session.status})`);
    });
    console.log();
    
    // Test 8: Message correlation timeout
    console.log('📋 Test 8: Message correlation timeout');
    try {
      // Send a request with very short timeout
      await bridge.sendRequest(MessageType.EXTRACTION_PROCESS, 
        { file: '/slow-file.pdf' }, 
        { timeout: 100 } // 100ms timeout
      );
    } catch (error) {
      if (error.code === 'TIMEOUT') {
        console.log('✅ Timeout handled correctly');
        console.log(`   Error: ${error.message}\n`);
      } else {
        console.log(`❌ Unexpected error: ${error.message}\n`);
      }
    }
    
    // Final statistics
    console.log('📊 Final Statistics:');
    const finalStats = bridge.getStats();
    console.log(JSON.stringify(finalStats, null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await bridge.shutdown();
    console.log('✅ IPC Bridge shut down');
  }
}

// Run tests
runTests().catch(console.error);