#!/usr/bin/env node

/**
 * Migration Script for Whapi.cloud to Super Light Gateway
 * This script helps migrate existing configurations and test the new setup
 */

const config = require('../config');
const SessionManager = require('../services/sessionManager');

async function runMigration() {
    console.log('🔄 Starting migration from Whapi.cloud to Super Light Gateway...\n');
    
    // Check environment variables
    console.log('📋 Checking environment configuration...');
    
    const requiredEnvVars = [
        'GATEWAY_BASE_URL',
        'GATEWAY_MASTER_KEY',
        'PUBLIC_WEBHOOK_URL'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:');
        missingVars.forEach(varName => {
            console.error(`   - ${varName}`);
        });
        console.log('\n📝 Please set these variables in your .env file or environment');
        console.log('   See .env.example for reference');
        process.exit(1);
    }
    
    console.log('✅ Environment configuration looks good\n');
    
    // Test gateway connection
    console.log('🔗 Testing gateway connection...');
    
    try {
        const sessionManager = new SessionManager();
        const sessions = await sessionManager.gatewayClient.getSessions();
        console.log(`✅ Gateway connection successful! Found ${sessions.length} existing sessions\n`);
    } catch (error) {
        console.error('❌ Gateway connection failed:', error.message);
        console.log('\n🔧 Please check:');
        console.log('   - GATEWAY_BASE_URL is correct and gateway is running');
        console.log('   - GATEWAY_MASTER_KEY is valid');
        console.log('   - Network connectivity to the gateway');
        process.exit(1);
    }
    
    // Create test session
    console.log('🧪 Creating test session...');
    
    try {
        const sessionManager = new SessionManager();
        const testTenantId = 'migration-test-' + Date.now();
        
        const sessionData = await sessionManager.getOrCreateSession(testTenantId);
        console.log(`✅ Test session created successfully!`);
        console.log(`   Session ID: ${sessionData.sessionId}`);
        console.log(`   Status: ${sessionData.status}`);
        console.log(`   Webhook set: ${sessionData.webhookSet}\n`);
        
        // Clean up test session
        console.log('🧹 Cleaning up test session...');
        await sessionManager.deleteSession(testTenantId);
        console.log('✅ Test session cleaned up\n');
        
    } catch (error) {
        console.error('❌ Test session creation failed:', error.message);
        process.exit(1);
    }
    
    // Migration summary
    console.log('🎉 Migration validation completed successfully!\n');
    console.log('📋 Next steps:');
    console.log('   1. Start your bot: npm start');
    console.log('   2. Create sessions for your CRM users via POST /admin/sessions');
    console.log('   3. Have users scan QR codes from the gateway dashboard');
    console.log('   4. Test message sending via POST /admin/send-message');
    console.log('   5. Monitor session health via GET /admin/sessions\n');
    
    console.log('🔗 Useful URLs:');
    console.log(`   - Gateway Dashboard: ${config.gateway.baseUrl}`);
    console.log(`   - Bot Webhook: ${config.gateway.webhookUrl}`);
    console.log(`   - Bot Admin API: ${config.bot.baseUrl}/admin/sessions\n`);
    
    console.log('⚠️  Remember to:');
    console.log('   - Remove legacy environment variables after testing');
    console.log('   - Update your CRM integration to use new admin endpoints');
    console.log('   - Monitor logs for any issues during the transition');
}

// Handle command line execution
if (require.main === module) {
    runMigration().catch(error => {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    });
}

module.exports = { runMigration };