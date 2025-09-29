const SuperLightGatewayClient = require('./superLightGatewayClient');
const config = require('../config');

/**
 * Session Manager for Multi-Tenant WhatsApp Sessions
 * Handles session creation, management, and persistence for CRM users
 */
class SessionManager {
    constructor() {
        this.gatewayClient = new SuperLightGatewayClient(
            config.gateway.baseUrl,
            config.gateway.masterKey
        );
        
        // In-memory storage for sessions (in production, use a database)
        this.sessions = new Map(); // tenantId -> { sessionId, token, status, createdAt, lastActivity }
        this.tenantSessions = new Map(); // sessionId -> tenantId
    }

    /**
     * Create or get existing session for a tenant
     * @param {string} tenantId - Unique tenant identifier
     * @param {boolean} forceCreate - Force creation of new session
     * @returns {Promise<{sessionId: string, token: string, status: string}>}
     */
    async getOrCreateSession(tenantId, forceCreate = false) {
        try {
            // Check if session already exists and is valid
            if (!forceCreate && this.sessions.has(tenantId)) {
                const session = this.sessions.get(tenantId);
                if (session.status !== 'disconnected' && session.status !== 'error') {
                    console.log(`Using existing session for tenant ${tenantId}`);
                    return session;
                }
            }

            console.log(`Creating new session for tenant ${tenantId}`);
            
            // Create new session via gateway
            const { sessionId, token } = await this.gatewayClient.createSession(tenantId);
            
            // Store session data
            const sessionData = {
                sessionId,
                token,
                status: 'created',
                createdAt: new Date(),
                lastActivity: new Date(),
                webhookSet: false
            };
            
            this.sessions.set(tenantId, sessionData);
            this.tenantSessions.set(sessionId, tenantId);
            
            // Set webhook for this session
            await this.setSessionWebhook(tenantId);
            
            return sessionData;
        } catch (error) {
            console.error(`Error creating session for tenant ${tenantId}:`, error);
            throw error;
        }
    }

    /**
     * Set webhook for a tenant's session
     * @param {string} tenantId - Tenant identifier
     */
    async setSessionWebhook(tenantId) {
        try {
            const session = this.sessions.get(tenantId);
            if (!session) {
                throw new Error(`No session found for tenant ${tenantId}`);
            }

            await this.gatewayClient.setWebhook(
                session.sessionId,
                config.gateway.webhookUrl,
                session.token
            );

            session.webhookSet = true;
            session.lastActivity = new Date();
            
            console.log(`Webhook set for tenant ${tenantId}`);
        } catch (error) {
            console.error(`Error setting webhook for tenant ${tenantId}:`, error);
            throw error;
        }
    }

    /**
     * Send message for a tenant
     * @param {string} tenantId - Tenant identifier
     * @param {string} to - Recipient phone number
     * @param {Object} message - Message object
     * @param {Object} options - Additional options
     */
    async sendMessage(tenantId, to, message, options = {}) {
        try {
            const session = await this.getOrCreateSession(tenantId);
            
            if (!session || !session.token) {
                throw new Error(`No valid session for tenant ${tenantId}`);
            }

            let result;
            
            switch (message.type) {
                case 'text':
                    result = await this.gatewayClient.sendText(
                        session.sessionId,
                        session.token,
                        to,
                        message.text
                    );
                    break;
                    
                case 'image':
                case 'document':
                case 'video':
                    result = await this.gatewayClient.sendMedia(
                        session.sessionId,
                        session.token,
                        to,
                        message.media,
                        message.mimeType,
                        message.caption,
                        message.type
                    );
                    break;
                    
                case 'contact':
                    result = await this.gatewayClient.sendContact(
                        session.sessionId,
                        session.token,
                        to,
                        message.name,
                        message.vcard
                    );
                    break;
                    
                default:
                    throw new Error(`Unsupported message type: ${message.type}`);
            }
            
            // Update last activity
            session.lastActivity = new Date();
            
            return result;
        } catch (error) {
            console.error(`Error sending message for tenant ${tenantId}:`, error);
            
            // If session error, mark as disconnected
            if (error.message.includes('session') || error.message.includes('unauthorized')) {
                this.updateSessionStatus(tenantId, 'disconnected');
            }
            
            throw error;
        }
    }

    /**
     * Update session status
     * @param {string} tenantId - Tenant identifier
     * @param {string} status - New status
     */
    updateSessionStatus(tenantId, status) {
        if (this.sessions.has(tenantId)) {
            const session = this.sessions.get(tenantId);
            session.status = status;
            session.lastActivity = new Date();
            
            console.log(`Session status updated for tenant ${tenantId}: ${status}`);
        }
    }

    /**
     * Get session status for a tenant
     * @param {string} tenantId - Tenant identifier
     * @param {boolean} includeGatewayStatus - Whether to fetch fresh status from gateway
     * @returns {Object|null} Session status or null if not found
     */
    async getSessionStatus(tenantId, includeGatewayStatus = false) {
        const session = this.sessions.get(tenantId);
        if (!session) return null;
        
        let gatewayStatus = null;
        if (includeGatewayStatus) {
            try {
                gatewayStatus = await this.gatewayClient.getSessionStatus(session.sessionId);
            } catch (error) {
                console.error(`Error fetching gateway status for ${tenantId}:`, error);
            }
        }
        
        return {
            sessionId: session.sessionId,
            status: gatewayStatus?.status || session.status,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            webhookSet: session.webhookSet,
            gatewayInfo: gatewayStatus
        };
    }

    /**
     * Get QR code for a tenant's session
     * @param {string} tenantId - Tenant identifier
     * @returns {Promise<{qr: string, status: string, qrUrl?: string}>} QR code data
     */
    async getSessionQR(tenantId) {
        try {
            const session = this.sessions.get(tenantId);
            if (!session) {
                throw new Error(`No session found for tenant ${tenantId}`);
            }

            const qrData = await this.gatewayClient.getSessionQR(session.sessionId);
            
            // Update session status if provided
            if (qrData.status) {
                this.updateSessionStatus(tenantId, qrData.status);
            }
            
            return {
                ...qrData,
                sessionId: session.sessionId,
                tenantId: tenantId,
                // Generate a data URL for the QR code if it's base64
                qrUrl: qrData.qr ? `data:image/png;base64,${qrData.qr}` : null
            };
        } catch (error) {
            console.error(`Error getting QR code for tenant ${tenantId}:`, error);
            throw error;
        }
    }

    /**
     * Restart/re-link a session for a tenant
     * @param {string} tenantId - Tenant identifier
     * @returns {Promise<Object>} Restart result
     */
    async restartSession(tenantId) {
        try {
            const session = this.sessions.get(tenantId);
            if (!session) {
                throw new Error(`No session found for tenant ${tenantId}`);
            }

            console.log(`Restarting session for tenant ${tenantId}`);
            
            const result = await this.gatewayClient.restartSession(session.sessionId);
            
            // Update session status
            this.updateSessionStatus(tenantId, 'restarting');
            
            return result;
        } catch (error) {
            console.error(`Error restarting session for tenant ${tenantId}:`, error);
            throw error;
        }
    }

    /**
     * Get tenant ID from session ID
     * @param {string} sessionId - Session identifier
     * @returns {string|null} Tenant ID or null if not found
     */
    getTenantFromSession(sessionId) {
        return this.tenantSessions.get(sessionId) || null;
    }

    /**
     * Delete session for a tenant
     * @param {string} tenantId - Tenant identifier
     */
    async deleteSession(tenantId) {
        try {
            const session = this.sessions.get(tenantId);
            if (!session) {
                console.log(`No session found for tenant ${tenantId}`);
                return;
            }

            // Delete from gateway
            await this.gatewayClient.deleteSession(session.sessionId);
            
            // Remove from local storage
            this.sessions.delete(tenantId);
            this.tenantSessions.delete(session.sessionId);
            
            console.log(`Session deleted for tenant ${tenantId}`);
        } catch (error) {
            console.error(`Error deleting session for tenant ${tenantId}:`, error);
            throw error;
        }
    }

    /**
     * Get all sessions
     * @returns {Array} Array of session data
     */
    getAllSessions() {
        const sessions = [];
        for (const [tenantId, session] of this.sessions.entries()) {
            sessions.push({
                tenantId,
                ...session
            });
        }
        return sessions;
    }

    /**
     * Health check - sync with gateway sessions
     */
    async healthCheck() {
        try {
            console.log('Running session health check...');
            
            const gatewaySessions = await this.gatewayClient.getSessions();
            const gatewaySessionIds = new Set(gatewaySessions.map(s => s.sessionId));
            
            // Check for orphaned local sessions
            for (const [tenantId, session] of this.sessions.entries()) {
                if (!gatewaySessionIds.has(session.sessionId)) {
                    console.log(`Orphaned session detected for tenant ${tenantId}, marking as disconnected`);
                    this.updateSessionStatus(tenantId, 'disconnected');
                }
            }
            
            // Update status from gateway
            for (const gatewaySession of gatewaySessions) {
                const tenantId = this.getTenantFromSession(gatewaySession.sessionId);
                if (tenantId && this.sessions.has(tenantId)) {
                    const localSession = this.sessions.get(tenantId);
                    if (gatewaySession.status && gatewaySession.status !== localSession.status) {
                        console.log(`Updating session status for tenant ${tenantId}: ${gatewaySession.status}`);
                        this.updateSessionStatus(tenantId, gatewaySession.status);
                    }
                }
            }
            
            console.log('Session health check completed');
        } catch (error) {
            console.error('Error during session health check:', error);
        }
    }

    /**
     * Start periodic health checks
     * @param {number} intervalMs - Interval in milliseconds (default: 5 minutes)
     */
    startHealthCheck(intervalMs = 5 * 60 * 1000) {
        setInterval(() => {
            this.healthCheck();
        }, intervalMs);
        
        console.log(`Session health check started with ${intervalMs}ms interval`);
    }
}

module.exports = SessionManager;