const express = require('express');
const bodyParser = require('body-parser');
const config = require('./config.js');
const WebhookHandler = require('./handlers/webhookHandler');

process.on('unhandledRejection', err => {
    console.log('Unhandled rejection:', err);
});

// Initialize webhook handler
const webhookHandler = new WebhookHandler();

/**
 * Admin endpoint to create a session for a tenant
 */
async function createTenantSession(req, res) {
    try {
        const { tenantId } = req.body;
        
        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required' });
        }

        console.log(`Creating session for tenant: ${tenantId}`);
        
        const sessionData = await webhookHandler.getSessionManager().getOrCreateSession(tenantId);
        
        res.json({
            success: true,
            message: 'Session created successfully',
            data: {
                tenantId,
                sessionId: sessionData.sessionId,
                status: sessionData.status,
                createdAt: sessionData.createdAt,
                webhookSet: sessionData.webhookSet
            }
        });
        
    } catch (error) {
        console.error('Error creating tenant session:', error);
        res.status(500).json({ 
            error: 'Failed to create session', 
            message: error.message 
        });
    }
}

/**
 * Admin endpoint to get session status for a tenant
 */
async function getTenantSessionStatus(req, res) {
    try {
        const { tenantId } = req.params;
        
        const sessionStatus = webhookHandler.getSessionManager().getSessionStatus(tenantId);
        
        if (!sessionStatus) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        res.json({
            success: true,
            data: {
                tenantId,
                ...sessionStatus
            }
        });
        
    } catch (error) {
        console.error('Error getting session status:', error);
        res.status(500).json({ 
            error: 'Failed to get session status', 
            message: error.message 
        });
    }
}

/**
 * Admin endpoint to delete a tenant session
 */
async function deleteTenantSession(req, res) {
    try {
        const { tenantId } = req.params;
        
        await webhookHandler.getSessionManager().deleteSession(tenantId);
        
        res.json({
            success: true,
            message: 'Session deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ 
            error: 'Failed to delete session', 
            message: error.message 
        });
    }
}

/**
 * Admin endpoint to list all sessions
 */
async function listAllSessions(req, res) {
    try {
        const sessions = webhookHandler.getSessionManager().getAllSessions();
        
        res.json({
            success: true,
            data: sessions
        });
        
    } catch (error) {
        console.error('Error listing sessions:', error);
        res.status(500).json({ 
            error: 'Failed to list sessions', 
            message: error.message 
        });
    }
}

/**
 * Admin endpoint to send a message for a tenant
 */
async function sendTenantMessage(req, res) {
    try {
        const { tenantId, to, message, type = 'text' } = req.body;
        
        if (!tenantId || !to || !message) {
            return res.status(400).json({ 
                error: 'tenantId, to, and message are required' 
            });
        }

        const messageObj = {
            type: type,
            text: message
        };

        const result = await webhookHandler.getSessionManager().sendMessage(
            tenantId,
            to,
            messageObj
        );
        
        res.json({
            success: true,
            message: 'Message sent successfully',
            data: result
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ 
            error: 'Failed to send message', 
            message: error.message 
        });
    }
}

/**
 * Health check endpoint
 */
async function healthCheck(req, res) {
    try {
        await webhookHandler.getSessionManager().healthCheck();
        
        res.json({
            success: true,
            message: 'Health check completed',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error during health check:', error);
        res.status(500).json({ 
            error: 'Health check failed', 
            message: error.message 
        });
    }
}

// Create Express app
const app = express();
app.use(bodyParser.json());

// Health check and keep-alive
app.get('/', function (req, res) {
    res.json({
        status: 'running',
        message: 'Medidate Bot - Super Light WhatsApp API Server',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

// Webhook endpoint for Super Light Gateway
app.post('/webhooks/whatsapp', (req, res) => {
    webhookHandler.handleWebhook(req, res);
});

// Admin API endpoints
app.post('/admin/sessions', createTenantSession);
app.get('/admin/sessions/:tenantId', getTenantSessionStatus);
app.delete('/admin/sessions/:tenantId', deleteTenantSession);
app.get('/admin/sessions', listAllSessions);
app.post('/admin/send-message', sendTenantMessage);
app.post('/admin/health-check', healthCheck);

// Legacy endpoint (for backward compatibility during migration)
app.post('/messages', (req, res) => {
    console.log('Legacy /messages endpoint called - this should be migrated');
    res.status(410).json({
        error: 'This endpoint is deprecated',
        message: 'Please use the new webhook endpoint: /webhooks/whatsapp'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// Start server
const port = config.port || 3001;
app.listen(port, function () {
    console.log(`🚀 Medidate Bot started on port ${port}`);
    console.log(`📱 Webhook endpoint: /webhooks/whatsapp`);
    console.log(`⚙️  Admin API available at /admin/*`);
    console.log(`🔗 Gateway URL: ${config.gateway.baseUrl}`);
    
    // Start session health check
    webhookHandler.getSessionManager().startHealthCheck();
    
    // Keep server alive (for Heroku)
    setInterval(function () {
        console.log('🔄 Keep server alive ping');
    }, 600000); // 10 minutes
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
});