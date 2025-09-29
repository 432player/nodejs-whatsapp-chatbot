const SessionManager = require('../services/sessionManager');

/**
 * Webhook Handler for Super Light WhatsApp API Server Events
 * Processes incoming webhook events and normalizes them for the bot logic
 */
class WebhookHandler {
    constructor() {
        this.sessionManager = new SessionManager();
    }

    /**
     * Handle incoming webhook from Super Light Gateway
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleWebhook(req, res) {
        try {
            console.log('Received webhook:', JSON.stringify(req.body, null, 2));
            
            const event = req.body;
            
            // Validate webhook event
            if (!event || !event.sessionId) {
                console.log('Invalid webhook event: missing sessionId');
                return res.status(400).send('Invalid webhook event');
            }

            // Get tenant from session
            const tenantId = this.sessionManager.getTenantFromSession(event.sessionId);
            if (!tenantId) {
                console.log(`No tenant found for session ${event.sessionId}`);
                return res.status(404).send('Session not found');
            }

            // Process different event types
            switch (event.type) {
                case 'message':
                    await this.handleMessageEvent(event, tenantId);
                    break;
                    
                case 'status':
                    await this.handleStatusEvent(event, tenantId);
                    break;
                    
                case 'qr':
                    await this.handleQREvent(event, tenantId);
                    break;
                    
                case 'ready':
                    await this.handleReadyEvent(event, tenantId);
                    break;
                    
                case 'disconnected':
                    await this.handleDisconnectedEvent(event, tenantId);
                    break;
                    
                default:
                    console.log(`Unknown event type: ${event.type}`);
            }
            
            res.status(200).send('OK');
        } catch (error) {
            console.error('Error handling webhook:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Handle incoming message events
     * @param {Object} event - Webhook event
     * @param {string} tenantId - Tenant identifier
     */
    async handleMessageEvent(event, tenantId) {
        try {
            const message = event.data;
            
            // Skip messages sent by the bot itself
            if (message.fromMe || message.from_me) {
                console.log('Skipping message from bot');
                return;
            }

            // Normalize message format to match old Whapi format
            const normalizedMessage = this.normalizeMessage(message);
            
            console.log(`Processing message for tenant ${tenantId}:`, normalizedMessage);
            
            // Process the message using existing bot logic
            await this.processMessage(normalizedMessage, tenantId);
            
        } catch (error) {
            console.error('Error handling message event:', error);
        }
    }

    /**
     * Handle status update events
     * @param {Object} event - Webhook event
     * @param {string} tenantId - Tenant identifier
     */
    async handleStatusEvent(event, tenantId) {
        try {
            const status = event.data?.status || event.status;
            console.log(`Status update for tenant ${tenantId}: ${status}`);
            
            // Update session status
            this.sessionManager.updateSessionStatus(tenantId, status);
            
        } catch (error) {
            console.error('Error handling status event:', error);
        }
    }

    /**
     * Handle QR code events
     * @param {Object} event - Webhook event
     * @param {string} tenantId - Tenant identifier
     */
    async handleQREvent(event, tenantId) {
        try {
            console.log(`QR code required for tenant ${tenantId}`);
            
            // Update session status to indicate QR is needed
            this.sessionManager.updateSessionStatus(tenantId, 'qr_required');
            
            // In a real CRM, you might want to notify the user or store the QR code
            // For now, we'll log that the QR is available in the gateway dashboard
            console.log(`QR code available in gateway dashboard for session ${event.sessionId}`);
            
        } catch (error) {
            console.error('Error handling QR event:', error);
        }
    }

    /**
     * Handle ready events (session connected)
     * @param {Object} event - Webhook event
     * @param {string} tenantId - Tenant identifier
     */
    async handleReadyEvent(event, tenantId) {
        try {
            console.log(`Session ready for tenant ${tenantId}`);
            
            // Update session status to connected
            this.sessionManager.updateSessionStatus(tenantId, 'connected');
            
        } catch (error) {
            console.error('Error handling ready event:', error);
        }
    }

    /**
     * Handle disconnected events
     * @param {Object} event - Webhook event
     * @param {string} tenantId - Tenant identifier
     */
    async handleDisconnectedEvent(event, tenantId) {
        try {
            console.log(`Session disconnected for tenant ${tenantId}`);
            
            // Update session status to disconnected
            this.sessionManager.updateSessionStatus(tenantId, 'disconnected');
            
        } catch (error) {
            console.error('Error handling disconnected event:', error);
        }
    }

    /**
     * Normalize message from Super Light Gateway format to internal format
     * @param {Object} message - Raw message from gateway
     * @returns {Object} Normalized message
     */
    normalizeMessage(message) {
        // Map Super Light Gateway message format to our internal format
        const normalized = {
            id: message.id || message.key?.id,
            chat_id: message.from || message.key?.remoteJid,
            from: message.from || message.key?.remoteJid,
            from_me: message.fromMe || message.key?.fromMe || false,
            timestamp: message.messageTimestamp || message.timestamp || Date.now(),
            type: message.type || 'text'
        };

        // Handle different message types
        switch (message.type) {
            case 'conversation':
            case 'extendedTextMessage':
                normalized.text = {
                    body: message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || 
                          message.body || 
                          message.text,
                    text: message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || 
                          message.body || 
                          message.text
                };
                break;
                
            case 'imageMessage':
                normalized.image = {
                    caption: message.message?.imageMessage?.caption || message.caption,
                    mimetype: message.message?.imageMessage?.mimetype || message.mimeType,
                    id: message.message?.imageMessage?.mediaKey || message.mediaKey
                };
                break;
                
            case 'documentMessage':
                normalized.document = {
                    caption: message.message?.documentMessage?.caption || message.caption,
                    filename: message.message?.documentMessage?.fileName || message.fileName,
                    mimetype: message.message?.documentMessage?.mimetype || message.mimeType,
                    id: message.message?.documentMessage?.mediaKey || message.mediaKey
                };
                break;
                
            case 'videoMessage':
                normalized.video = {
                    caption: message.message?.videoMessage?.caption || message.caption,
                    mimetype: message.message?.videoMessage?.mimetype || message.mimeType,
                    id: message.message?.videoMessage?.mediaKey || message.mediaKey
                };
                break;
                
            case 'audioMessage':
                normalized.audio = {
                    mimetype: message.message?.audioMessage?.mimetype || message.mimeType,
                    id: message.message?.audioMessage?.mediaKey || message.mediaKey
                };
                break;
                
            default:
                // For unknown types, try to extract text
                normalized.text = {
                    body: message.body || message.text || '',
                    text: message.body || message.text || ''
                };
        }

        return normalized;
    }

    /**
     * Process normalized message using existing bot logic
     * @param {Object} message - Normalized message
     * @param {string} tenantId - Tenant identifier
     */
    async processMessage(message, tenantId) {
        try {
            // Import the existing command constants
            const COMMANDS = {
                TEXT: 'Simple text message',
                IMAGE: 'Send image',
                DOCUMENT: 'Send document',
                VIDEO: 'Send video',
                CONTACT: 'Send contact',
                PRODUCT: 'Send product',
                GROUP_CREATE: 'Create group',
                GROUP_TEXT: 'Simple text message for the group',
                GROUPS_IDS: 'Get the id\'s of your three groups'
            };

            const FILES = {
                IMAGE: './files/file_example_JPG_100kB.jpg',
                DOCUMENT: './files/file-example_PDF_500_kB.pdf',
                VIDEO: './files/file_example_MP4_480_1_5MG.mp4',
                VCARD: './files/sample-vcard.txt'
            };

            const fs = require('fs');
            
            // Extract command from message text
            const messageText = message.text?.body || message.text?.text || '';
            const command = Object.keys(COMMANDS)[+messageText.trim() - 1];
            
            let responseMessage = {};
            
            switch (command) {
                case 'TEXT':
                    responseMessage = {
                        type: 'text',
                        text: message.text?.text || 'Echo: ' + messageText
                    };
                    break;
                    
                case 'IMAGE':
                    responseMessage = {
                        type: 'image',
                        media: fs.createReadStream(FILES.IMAGE),
                        mimeType: 'image/jpeg',
                        caption: 'Medidate Bot Text under the photo.'
                    };
                    break;
                    
                case 'DOCUMENT':
                    responseMessage = {
                        type: 'document',
                        media: fs.createReadStream(FILES.DOCUMENT),
                        mimeType: 'application/pdf',
                        caption: 'Medidate Bot Text under the document.'
                    };
                    break;
                    
                case 'VIDEO':
                    responseMessage = {
                        type: 'video',
                        media: fs.createReadStream(FILES.VIDEO),
                        mimeType: 'video/mp4',
                        caption: 'Medidate Bot Text under the video.'
                    };
                    break;
                    
                case 'CONTACT':
                    responseMessage = {
                        type: 'contact',
                        name: 'Medidate Bot Test',
                        vcard: fs.readFileSync(FILES.VCARD).toString()
                    };
                    break;
                    
                case 'GROUP_CREATE':
                    // Note: Group creation might need special handling in Baileys
                    responseMessage = {
                        type: 'text',
                        text: 'Group creation feature will be implemented based on Baileys capabilities'
                    };
                    break;
                    
                case 'GROUP_TEXT':
                    responseMessage = {
                        type: 'text',
                        text: 'Group messaging feature will be implemented'
                    };
                    break;
                    
                case 'GROUPS_IDS':
                    responseMessage = {
                        type: 'text',
                        text: 'Groups listing feature will be implemented'
                    };
                    break;
                    
                default:
                    responseMessage = {
                        type: 'text',
                        text: 'Hi. Send me a number from the list. Don\'t forget to change the actual data in the code!\n\n' +
                              Object.values(COMMANDS).map((text, i) => `${i + 1}. ${text}`).join('\n')
                    };
            }
            
            // Send response using session manager
            await this.sessionManager.sendMessage(
                tenantId,
                message.from || message.chat_id,
                responseMessage
            );
            
        } catch (error) {
            console.error('Error processing message:', error);
            
            // Send error message
            try {
                await this.sessionManager.sendMessage(
                    tenantId,
                    message.from || message.chat_id,
                    {
                        type: 'text',
                        text: 'Sorry, there was an error processing your message.'
                    }
                );
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }

    /**
     * Get session manager instance
     * @returns {SessionManager} Session manager instance
     */
    getSessionManager() {
        return this.sessionManager;
    }
}

module.exports = WebhookHandler;