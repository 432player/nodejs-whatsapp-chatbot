const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Super Light WhatsApp API Server (Baileys) Gateway Client
 * Handles all communication with the Super Light Web WhatsApp API Server
 */
class SuperLightGatewayClient {
    constructor(baseUrl, masterKey) {
        this.baseUrl = baseUrl;
        this.masterKey = masterKey;
        this.sessions = new Map(); // Store session data: sessionId -> { token, status }
    }

    /**
     * Create a new WhatsApp session for a tenant
     * @param {string} tenantId - Unique identifier for the tenant
     * @returns {Promise<{sessionId: string, token: string}>}
     */
    async createSession(tenantId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.masterKey
                },
                body: JSON.stringify({
                    sessionId: tenantId,
                    readIncomingMessages: true,
                    readStatus: true
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create session: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Session created:', JSON.stringify(data, null, 2));
            
            // Store session data
            this.sessions.set(tenantId, {
                sessionId: data.sessionId || tenantId,
                token: data.token,
                status: 'created'
            });

            return {
                sessionId: data.sessionId || tenantId,
                token: data.token
            };
        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }

    /**
     * Set webhook URL for a session
     * @param {string} sessionId - Session identifier
     * @param {string} webhookUrl - Webhook URL to receive events
     * @param {string} token - Session token
     */
    async setWebhook(sessionId, webhookUrl, token) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    url: webhookUrl,
                    events: ['message', 'status']
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to set webhook: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Webhook set:', JSON.stringify(data, null, 2));
            
            // Update session status
            if (this.sessions.has(sessionId)) {
                this.sessions.get(sessionId).webhookSet = true;
            }

            return data;
        } catch (error) {
            console.error('Error setting webhook:', error);
            throw error;
        }
    }

    /**
     * Send text message
     * @param {string} sessionId - Session identifier
     * @param {string} token - Session token
     * @param {string} to - Recipient phone number (international format)
     * @param {string} text - Message text
     */
    async sendText(sessionId, token, to, text) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/messages?sessionId=${sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: this.formatPhoneNumber(to),
                    type: 'text',
                    text: {
                        body: text
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to send text: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Text message sent:', JSON.stringify(data, null, 2));
            return data;
        } catch (error) {
            console.error('Error sending text:', error);
            throw error;
        }
    }

    /**
     * Upload media file
     * @param {Buffer|ReadStream} mediaBuffer - Media file buffer or stream
     * @param {string} mimeType - MIME type of the media
     * @param {string} token - Session token
     * @returns {Promise<string>} Media ID
     */
    async uploadMedia(mediaBuffer, mimeType, token) {
        try {
            const form = new FormData();
            form.append('media', mediaBuffer, { contentType: mimeType });

            const response = await fetch(`${this.baseUrl}/api/v1/media`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...form.getHeaders()
                },
                body: form
            });

            if (!response.ok) {
                throw new Error(`Failed to upload media: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Media uploaded:', JSON.stringify(data, null, 2));
            return data.mediaId || data.id;
        } catch (error) {
            console.error('Error uploading media:', error);
            throw error;
        }
    }

    /**
     * Send media message (image, document, video)
     * @param {string} sessionId - Session identifier
     * @param {string} token - Session token
     * @param {string} to - Recipient phone number
     * @param {Buffer|ReadStream|string} media - Media buffer, stream, or media ID
     * @param {string} mimeType - MIME type
     * @param {string} caption - Optional caption
     * @param {string} type - Media type: 'image', 'document', 'video'
     */
    async sendMedia(sessionId, token, to, media, mimeType, caption = '', type = 'document') {
        try {
            let mediaId = media;
            
            // If media is not a string (media ID), upload it first
            if (typeof media !== 'string') {
                mediaId = await this.uploadMedia(media, mimeType, token);
            }

            const messageBody = {
                to: this.formatPhoneNumber(to),
                type: type,
                [type]: {
                    id: mediaId
                }
            };

            // Add caption if provided
            if (caption && (type === 'image' || type === 'document' || type === 'video')) {
                messageBody[type].caption = caption;
            }

            const response = await fetch(`${this.baseUrl}/api/v1/messages?sessionId=${sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(messageBody)
            });

            if (!response.ok) {
                throw new Error(`Failed to send media: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Media message sent:', JSON.stringify(data, null, 2));
            return data;
        } catch (error) {
            console.error('Error sending media:', error);
            throw error;
        }
    }

    /**
     * Send contact (vCard)
     * @param {string} sessionId - Session identifier
     * @param {string} token - Session token
     * @param {string} to - Recipient phone number
     * @param {string} name - Contact name
     * @param {string} vcard - vCard content
     */
    async sendContact(sessionId, token, to, name, vcard) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/messages?sessionId=${sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: this.formatPhoneNumber(to),
                    type: 'contacts',
                    contacts: [{
                        name: {
                            formatted_name: name
                        },
                        vcard: vcard
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to send contact: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Contact sent:', JSON.stringify(data, null, 2));
            return data;
        } catch (error) {
            console.error('Error sending contact:', error);
            throw error;
        }
    }

    /**
     * Get all sessions
     * @returns {Promise<Array>} List of sessions
     */
    async getSessions() {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/sessions`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': this.masterKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get sessions: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Sessions retrieved:', JSON.stringify(data, null, 2));
            return data;
        } catch (error) {
            console.error('Error getting sessions:', error);
            throw error;
        }
    }

    /**
     * Delete a session
     * @param {string} sessionId - Session identifier
     */
    async deleteSession(sessionId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'X-Master-Key': this.masterKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete session: ${response.statusText}`);
            }

            // Remove from local cache
            this.sessions.delete(sessionId);

            const data = await response.json();
            console.log('Session deleted:', JSON.stringify(data, null, 2));
            return data;
        } catch (error) {
            console.error('Error deleting session:', error);
            throw error;
        }
    }

    /**
     * Format phone number to international format without + and spaces
     * @param {string} phoneNumber - Phone number to format
     * @returns {string} Formatted phone number
     */
    formatPhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        let formatted = phoneNumber.replace(/\D/g, '');
        
        // Ensure it doesn't start with leading zeros (except country codes)
        formatted = formatted.replace(/^0+/, '');
        
        // If it doesn't start with a country code, assume it needs one
        // This is a basic implementation - you might want to make this more sophisticated
        if (formatted.length < 10) {
            throw new Error('Phone number too short');
        }
        
        return formatted + '@s.whatsapp.net';
    }

    /**
     * Get session data from cache
     * @param {string} sessionId - Session identifier
     * @returns {Object|null} Session data or null if not found
     */
    getSessionData(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Update session status
     * @param {string} sessionId - Session identifier
     * @param {string} status - New status
     */
    updateSessionStatus(sessionId, status) {
        if (this.sessions.has(sessionId)) {
            this.sessions.get(sessionId).status = status;
        }
    }
}

module.exports = SuperLightGatewayClient;