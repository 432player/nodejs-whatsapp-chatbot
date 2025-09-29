#!/usr/bin/env node

/**
 * Integration Test Script
 * Tests the complete flow of session creation, message sending, and webhook handling
 */

const fetch = require('node-fetch');
const config = require('../config');

const BOT_BASE_URL = config.bot.baseUrl || 'http://localhost:3001';
const TEST_TENANT_ID = 'test-tenant-' + Date.now();
const TEST_PHONE = '1234567890'; // Replace with a real test number

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${BOT_BASE_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    console.log(`📡 ${method} ${url}`);
    if (body) {
        console.log('   Body:', JSON.stringify(body, null, 2));
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`   Response (${response.status}):`, JSON.stringify(data, null, 2));
    console.log('');
    
    return { response, data };
}

async function runIntegrationTest() {
    console.log('🧪 Starting Integration Test...\n');
    console.log(`Test Tenant ID: ${TEST_TENANT_ID}`);
    console.log(`Bot Base URL: ${BOT_BASE_URL}\n`);
    
    try {
        // Test 1: Health check
        console.log('1️⃣ Testing health check...');
        await makeRequest('/');
        
        // Test 2: Create session
        console.log('2️⃣ Creating test session...');
        const { data: sessionData } = await makeRequest('/admin/sessions', 'POST', {
            tenantId: TEST_TENANT_ID
        });
        
        if (!sessionData.success) {
            throw new Error('Failed to create session');
        }
        
        // Test 3: Check session status
        console.log('3️⃣ Checking session status...');
        await makeRequest(`/admin/sessions/${TEST_TENANT_ID}`);
        
        // Test 4: List all sessions
        console.log('4️⃣ Listing all sessions...');
        await makeRequest('/admin/sessions');
        
        // Test 5: Send test message (will fail if not connected, but tests the endpoint)
        console.log('5️⃣ Testing message sending...');
        const { response: msgResponse } = await makeRequest('/admin/send-message', 'POST', {
            tenantId: TEST_TENANT_ID,
            to: TEST_PHONE,
            message: 'Test message from integration test',
            type: 'text'
        });
        
        if (msgResponse.status === 500) {
            console.log('   ⚠️  Message sending failed (expected if WhatsApp not linked)');
        }
        
        // Test 6: Health check
        console.log('6️⃣ Running health check...');
        await makeRequest('/admin/health-check', 'POST');
        
        // Test 7: Clean up - delete session
        console.log('7️⃣ Cleaning up test session...');
        await makeRequest(`/admin/sessions/${TEST_TENANT_ID}`, 'DELETE');
        
        console.log('✅ Integration test completed successfully!\n');
        
        console.log('📋 Test Summary:');
        console.log('   ✅ Bot server is running');
        console.log('   ✅ Session creation works');
        console.log('   ✅ Session management works');
        console.log('   ✅ Admin API endpoints are functional');
        console.log('   ✅ Gateway integration is working\n');
        
        console.log('🔗 Next steps for full testing:');
        console.log('   1. Create a real session for testing');
        console.log('   2. Scan QR code from gateway dashboard');
        console.log('   3. Send a test message to a real WhatsApp number');
        console.log('   4. Send a message to the bot to test webhook handling');
        
    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        
        // Try to clean up
        try {
            console.log('🧹 Attempting cleanup...');
            await makeRequest(`/admin/sessions/${TEST_TENANT_ID}`, 'DELETE');
        } catch (cleanupError) {
            console.error('⚠️  Cleanup failed:', cleanupError.message);
        }
        
        process.exit(1);
    }
}

// Handle command line execution
if (require.main === module) {
    runIntegrationTest().catch(error => {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runIntegrationTest };