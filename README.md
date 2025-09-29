# Medidate Bot - Super Light WhatsApp API Server Integration

A multi-tenant WhatsApp bot built with the Super Light WhatsApp API Server (Baileys-based) for CRM integration.

## 🚀 Features

- **Multi-tenant support**: Each CRM user can connect their own WhatsApp number
- **Session management**: Automatic session creation, health monitoring, and reconnection
- **Media support**: Send/receive text, images, documents, videos, and contacts
- **Webhook integration**: Real-time message processing
- **Admin API**: Complete session management via REST endpoints
- **Health monitoring**: Automatic session status synchronization

## 📋 Prerequisites

1. **Super Light WhatsApp API Server** - You need to have the Super Light Web WhatsApp API Server running
2. **Node.js** - Version 14.x or higher
3. **Environment variables** - Properly configured environment

## 🛠️ Installation

1. **Clone and install dependencies:**
```bash
git clone <your-repo>
cd MedidateBot
npm install
```

2. **Set up environment variables:**
Create a `.env` file or set the following environment variables:

```bash
# Server Configuration
PORT=3001
PUBLIC_WEBHOOK_URL=https://your-domain.com

# Super Light Gateway Configuration
GATEWAY_BASE_URL=http://localhost:3000
GATEWAY_MASTER_KEY=your-master-key-here

# Legacy (remove after migration)
TOKEN=your-old-whapi-token
baseURL=https://your-domain.com
```

## 🔧 Super Light Gateway Setup

### Option 1: Run Gateway Locally

1. **Download and run the Super Light WhatsApp API Server:**
```bash
# Clone the Super Light Gateway repository
git clone https://github.com/salman0ansari/whatsapp-api-nodejs
cd whatsapp-api-nodejs

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start the gateway
npm start
```

2. **Configure the gateway:**
- The gateway will run on `http://localhost:3000` by default
- Access the dashboard at `http://localhost:3000`
- Note down your master key from the dashboard

### Option 2: Use Remote Gateway

If you have the gateway running elsewhere:
```bash
GATEWAY_BASE_URL=https://your-gateway-domain.com
GATEWAY_MASTER_KEY=your-master-key
```

## 🚀 Running the Bot

1. **Start the bot:**
```bash
npm start
```

2. **For development:**
```bash
npm run dev
```

The bot will start on the configured port (default: 3001) and automatically:
- Initialize session management
- Start health monitoring
- Set up webhook endpoints

## 📱 Session Management

### Option 1: CRM-Integrated Session Creation (Recommended)

**POST** `/admin/sessions/create-with-qr`
```json
{
  "tenantId": "user123",
  "userInfo": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

Response includes QR code for immediate display:
```json
{
  "success": true,
  "message": "Session created successfully",
  "data": {
    "tenantId": "user123",
    "sessionId": "user123",
    "status": "created",
    "qr": {
      "qr": "base64-encoded-qr-image",
      "qrUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
      "status": "qr_required"
    },
    "instructions": {
      "step1": "Open WhatsApp on your phone",
      "step2": "Go to Settings → Linked Devices",
      "step3": "Tap \"Link a Device\"",
      "step4": "Scan the QR code below",
      "step5": "Wait for connection confirmation"
    }
  }
}
```

### Option 2: Traditional Session Creation

**POST** `/admin/sessions`
```json
{
  "tenantId": "user123"
}
```

Then get QR code separately:
**GET** `/admin/sessions/user123/qr`

### Linking WhatsApp (QR Code Process)

#### For CRM Integration (No Gateway UI needed):
1. **Create session with QR** using `/admin/sessions/create-with-qr`
2. **Display QR code** in your CRM interface using the returned `qrUrl`
3. **Poll for status** using `/admin/sessions/user123/poll`
4. **User scans QR** with WhatsApp (Settings → Linked Devices → Link a Device)
5. **Session status** automatically updates to "connected"

#### For Gateway Dashboard Access:
1. **Create a session** using `/admin/sessions`
2. **Access the Gateway Dashboard** at `http://localhost:3000` (or your gateway URL)
3. **Find your session** in the dashboard
4. **Scan the QR code** with WhatsApp
5. **Session status** will automatically update to "connected"

### Checking Session Status

**GET** `/admin/sessions/:tenantId`

Response:
```json
{
  "success": true,
  "data": {
    "tenantId": "user123",
    "sessionId": "user123",
    "status": "connected",
    "createdAt": "2023-...",
    "lastActivity": "2023-...",
    "webhookSet": true
  }
}
```

### Session Status Values

- `created` - Session created, QR code needed
- `qr_required` - QR code needs to be scanned
- `connected` - WhatsApp linked and ready
- `disconnected` - Session disconnected, needs re-linking

## 💬 Sending Messages

### Send Text Message

**POST** `/admin/send-message`
```json
{
  "tenantId": "user123",
  "to": "1234567890",
  "message": "Hello from Medidate Bot!",
  "type": "text"
}
```

### Send Media Message

For media messages, the system will automatically handle file upload to the gateway.

## 🔗 Webhook Integration

The bot receives webhooks at `/webhooks/whatsapp` and processes:

- **Incoming messages** - Text, media, contacts
- **Status updates** - Connection, disconnection, QR required
- **Session events** - Ready, error states

### Webhook Event Format

The gateway sends events like:
```json
{
  "sessionId": "user123",
  "type": "message",
  "data": {
    "id": "message-id",
    "from": "1234567890@s.whatsapp.net",
    "type": "conversation",
    "message": {
      "conversation": "Hello bot!"
    },
    "timestamp": 1234567890
  }
}
```

## 🔧 Admin API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/sessions/create-with-qr` | **Create session + get QR (CRM-friendly)** |
| POST | `/admin/sessions` | Create new session |
| GET | `/admin/sessions/:tenantId` | Get session status |
| GET | `/admin/sessions/:tenantId/qr` | **Get QR code for session** |
| GET | `/admin/sessions/:tenantId/poll` | **Poll session status (with next action)** |
| POST | `/admin/sessions/:tenantId/restart` | **Restart/reconnect session** |
| DELETE | `/admin/sessions/:tenantId` | Delete session |
| GET | `/admin/sessions` | List all sessions |
| POST | `/admin/send-message` | Send message |
| POST | `/admin/health-check` | Run health check |

### 🎯 CRM Integration Endpoints

The **bolded** endpoints above are specifically designed for seamless CRM integration, allowing your users to connect WhatsApp without accessing the gateway UI.

📖 **For detailed CRM integration examples, see [CRM_INTEGRATION.md](./CRM_INTEGRATION.md)**

## 🏥 Health Monitoring

The bot automatically:
- **Monitors session health** every 5 minutes
- **Syncs with gateway** to detect disconnections
- **Updates session status** based on gateway state
- **Logs health check results**

Manual health check:
**POST** `/admin/health-check`

## 📞 Bot Commands

Users can send numbered commands to interact with the bot:

1. **Simple text message** - Echo functionality
2. **Send image** - Sends sample image
3. **Send document** - Sends sample PDF
4. **Send video** - Sends sample video
5. **Send contact** - Sends vCard contact
6. **Send product** - Product message (placeholder)
7. **Create group** - Group creation (placeholder)
8. **Simple text message for the group** - Group messaging (placeholder)
9. **Get the id's of your three groups** - List groups (placeholder)

## 🔒 Security Notes

1. **Master Key**: Keep your `GATEWAY_MASTER_KEY` secure - it can create/delete sessions
2. **Session Tokens**: Session tokens are stored server-side and never exposed to clients
3. **Phone Format**: All phone numbers are automatically formatted to international format
4. **Webhook Validation**: Consider implementing webhook signature validation in production

## 🐛 Troubleshooting

### Common Issues

1. **"Session not found"**
   - Ensure the session was created via `/admin/sessions`
   - Check if the session was deleted or expired

2. **"QR code required"**
   - Access the gateway dashboard
   - Scan the QR code with WhatsApp
   - Wait for status to change to "connected"

3. **"Gateway connection failed"**
   - Verify `GATEWAY_BASE_URL` is correct
   - Ensure the gateway is running
   - Check `GATEWAY_MASTER_KEY` is valid

4. **Messages not being received**
   - Verify webhook URL is accessible from the gateway
   - Check `PUBLIC_WEBHOOK_URL` environment variable
   - Ensure webhook was set successfully during session creation

### Logs

The bot provides detailed logging for:
- Session creation and management
- Message sending and receiving
- Health checks and status updates
- Error conditions and troubleshooting

## 🔄 Migration from Whapi.cloud

This bot has been fully migrated from Whapi.cloud to the Super Light Gateway. The old endpoints are deprecated:

- ❌ `/messages` (legacy webhook) - Returns 410 Gone
- ✅ `/webhooks/whatsapp` (new webhook)

## 📚 API Documentation

For detailed Super Light Gateway API documentation, refer to:
- Gateway repository README
- `api_documentation.md` in the gateway project
- Dashboard API explorer (if available)

## 🤝 Support

For issues related to:
- **Bot functionality**: Check this repository's issues
- **Gateway issues**: Refer to the Super Light Gateway repository
- **Baileys issues**: Check the @whiskeysockets/baileys documentation

## 📄 License

This project is licensed under the terms specified in the package.json file.

---

**Version**: 2.0.0  
**Last Updated**: Migration to Super Light WhatsApp API Server (Baileys)