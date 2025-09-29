module.exports = {
    port: process.env.PORT,
    
    // Super Light WhatsApp API Server (Baileys) Configuration
    gateway: {
        baseUrl: process.env.GATEWAY_BASE_URL || "http://localhost:3000",
        masterKey: process.env.GATEWAY_MASTER_KEY,
        webhookUrl: process.env.PUBLIC_WEBHOOK_URL + "/webhooks/whatsapp"
    },
    
    // Legacy configuration (kept for reference during migration)
    // Remove these after migration is complete
    legacy: {
        apiUrl: "https://gate.whapi.cloud",
        token: process.env.TOKEN,
        group: process.env.GROUP,
        product: process.env.PRODUCT,
        botUrl: process.env.baseURL + "/messages"
    },
    
    // Bot configuration
    bot: {
        webhookUrl: process.env.PUBLIC_WEBHOOK_URL + "/webhooks/whatsapp",
        baseUrl: process.env.baseURL || process.env.PUBLIC_WEBHOOK_URL
    }
}
