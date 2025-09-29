# CRM Integration Guide - WhatsApp Session Management

This guide shows how to integrate WhatsApp session management directly into your CRM system without requiring users to access the gateway UI.

## 🚀 Quick Start for CRM Integration

### 1. Create Session with QR Code (One-Step)

**POST** `/admin/sessions/create-with-qr`

```json
{
  "tenantId": "user_123",
  "userInfo": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session created successfully",
  "data": {
    "tenantId": "user_123",
    "sessionId": "user_123",
    "status": "created",
    "createdAt": "2023-...",
    "webhookSet": true,
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

### 2. Display QR Code in Your CRM

```html
<!-- Example HTML for displaying QR code -->
<div class="whatsapp-setup">
  <h3>Connect Your WhatsApp</h3>
  <div class="qr-container">
    <img src="data:image/png;base64,{QR_CODE_BASE64}" alt="WhatsApp QR Code" />
  </div>
  <div class="instructions">
    <ol>
      <li>Open WhatsApp on your phone</li>
      <li>Go to Settings → Linked Devices</li>
      <li>Tap "Link a Device"</li>
      <li>Scan the QR code above</li>
      <li>Wait for connection confirmation</li>
    </ol>
  </div>
  <div class="status" id="connection-status">
    Status: Waiting for QR scan...
  </div>
</div>
```

### 3. Poll for Connection Status

**GET** `/admin/sessions/{tenantId}/poll`

```javascript
// JavaScript example for polling status
async function pollConnectionStatus(tenantId) {
  const response = await fetch(`/admin/sessions/${tenantId}/poll`);
  const data = await response.json();
  
  if (data.success) {
    const { status, nextAction, message } = data.data;
    
    switch (nextAction) {
      case 'scan_qr':
        updateUI('Please scan the QR code', 'waiting');
        break;
      case 'wait':
        updateUI('Connecting...', 'connecting');
        break;
      case 'ready':
        updateUI('WhatsApp connected successfully!', 'connected');
        // Stop polling, user is ready
        return;
      case 'reconnect':
        updateUI('Connection lost. Please reconnect.', 'error');
        break;
    }
    
    // Continue polling every 3 seconds
    setTimeout(() => pollConnectionStatus(tenantId), 3000);
  }
}

function updateUI(message, status) {
  document.getElementById('connection-status').textContent = message;
  document.getElementById('connection-status').className = `status ${status}`;
}
```

## 📱 Complete CRM Integration Flow

### Step 1: User Initiates WhatsApp Setup

```javascript
// When user clicks "Connect WhatsApp" in your CRM
async function connectWhatsApp(userId) {
  try {
    const response = await fetch('/admin/sessions/create-with-qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + userToken // Your CRM auth
      },
      body: JSON.stringify({
        tenantId: userId,
        userInfo: {
          name: currentUser.name,
          email: currentUser.email
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      displayQRCode(data.data.qr.qrUrl);
      startStatusPolling(userId);
    } else {
      showError('Failed to create WhatsApp session');
    }
  } catch (error) {
    showError('Connection error: ' + error.message);
  }
}
```

### Step 2: Monitor Connection Status

```javascript
let pollingInterval;

function startStatusPolling(tenantId) {
  pollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`/admin/sessions/${tenantId}/poll`);
      const data = await response.json();
      
      if (data.success) {
        const { status, nextAction, message } = data.data;
        
        updateConnectionStatus(message, status);
        
        if (nextAction === 'ready') {
          // Connection successful
          clearInterval(pollingInterval);
          onWhatsAppConnected(tenantId);
        } else if (nextAction === 'reconnect') {
          // Connection lost
          clearInterval(pollingInterval);
          onWhatsAppDisconnected(tenantId);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 3000); // Poll every 3 seconds
}

function onWhatsAppConnected(tenantId) {
  // Update CRM UI to show WhatsApp is connected
  document.getElementById('whatsapp-status').innerHTML = 
    '<span class="connected">✅ WhatsApp Connected</span>';
  
  // Enable WhatsApp messaging features in CRM
  enableWhatsAppFeatures(tenantId);
  
  // Show success message
  showSuccess('WhatsApp connected successfully! You can now send messages.');
}

function onWhatsAppDisconnected(tenantId) {
  // Update CRM UI to show disconnection
  document.getElementById('whatsapp-status').innerHTML = 
    '<span class="disconnected">❌ WhatsApp Disconnected</span>';
  
  // Show reconnect button
  showReconnectOption(tenantId);
}
```

### Step 3: Send Messages from CRM

```javascript
async function sendWhatsAppMessage(tenantId, phoneNumber, message) {
  try {
    const response = await fetch('/admin/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + userToken
      },
      body: JSON.stringify({
        tenantId: tenantId,
        to: phoneNumber,
        message: message,
        type: 'text'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showSuccess('WhatsApp message sent successfully!');
      logMessageInCRM(phoneNumber, message, 'sent');
    } else {
      showError('Failed to send WhatsApp message: ' + data.message);
    }
  } catch (error) {
    showError('Error sending message: ' + error.message);
  }
}
```

## 🔄 Reconnection Flow

### Handle Disconnections

```javascript
async function reconnectWhatsApp(tenantId) {
  try {
    // Restart the session
    const response = await fetch(`/admin/sessions/${tenantId}/restart`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + userToken
      }
    });
    
    if (response.ok) {
      // Wait a moment for restart
      setTimeout(async () => {
        // Get new QR code
        const qrResponse = await fetch(`/admin/sessions/${tenantId}/qr`);
        const qrData = await qrResponse.json();
        
        if (qrData.success) {
          displayQRCode(qrData.data.qrUrl);
          startStatusPolling(tenantId);
        }
      }, 2000);
    }
  } catch (error) {
    showError('Failed to restart session: ' + error.message);
  }
}
```

## 🎨 UI Components for CRM

### WhatsApp Status Widget

```html
<div class="whatsapp-widget">
  <div class="widget-header">
    <h4>WhatsApp Integration</h4>
    <span id="whatsapp-status" class="status-badge">Not Connected</span>
  </div>
  
  <div id="setup-area" class="setup-area">
    <button onclick="connectWhatsApp(currentUserId)" class="btn-connect">
      Connect WhatsApp
    </button>
  </div>
  
  <div id="qr-area" class="qr-area" style="display: none;">
    <img id="qr-image" alt="QR Code" />
    <p class="qr-instructions">Scan with WhatsApp to connect</p>
    <div id="connection-progress" class="progress-indicator">
      Waiting for scan...
    </div>
  </div>
  
  <div id="connected-area" class="connected-area" style="display: none;">
    <p class="success-message">✅ WhatsApp Connected</p>
    <button onclick="testWhatsAppMessage()" class="btn-test">
      Send Test Message
    </button>
    <button onclick="disconnectWhatsApp()" class="btn-disconnect">
      Disconnect
    </button>
  </div>
</div>
```

### CSS Styling

```css
.whatsapp-widget {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  background: #f9f9f9;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status-badge.connected {
  background: #d4edda;
  color: #155724;
}

.status-badge.disconnected {
  background: #f8d7da;
  color: #721c24;
}

.qr-area {
  text-align: center;
  padding: 20px;
}

.qr-area img {
  max-width: 200px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.progress-indicator {
  margin-top: 10px;
  font-style: italic;
  color: #666;
}

.btn-connect, .btn-test, .btn-disconnect {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin: 4px;
}

.btn-connect {
  background: #25d366;
  color: white;
}

.btn-test {
  background: #007bff;
  color: white;
}

.btn-disconnect {
  background: #dc3545;
  color: white;
}
```

## 📊 Session Management Dashboard

### List All User Sessions

```javascript
async function loadUserSessions() {
  try {
    const response = await fetch('/admin/sessions');
    const data = await response.json();
    
    if (data.success) {
      displaySessionsTable(data.data);
    }
  } catch (error) {
    console.error('Error loading sessions:', error);
  }
}

function displaySessionsTable(sessions) {
  const tableBody = document.getElementById('sessions-table-body');
  tableBody.innerHTML = '';
  
  sessions.forEach(session => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${session.tenantId}</td>
      <td><span class="status-${session.status}">${session.status}</span></td>
      <td>${new Date(session.createdAt).toLocaleString()}</td>
      <td>${new Date(session.lastActivity).toLocaleString()}</td>
      <td>
        <button onclick="viewSession('${session.tenantId}')">View</button>
        <button onclick="restartSession('${session.tenantId}')">Restart</button>
        <button onclick="deleteSession('${session.tenantId}')">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}
```

## 🔐 Security Considerations

### Authentication & Authorization

```javascript
// Add authentication to your API calls
const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + userToken,
  'X-User-ID': currentUserId // Optional: for additional validation
};

// Validate user permissions before session operations
async function validateUserAccess(tenantId, userId) {
  // Ensure user can only manage their own sessions
  if (tenantId !== userId && !isAdmin(userId)) {
    throw new Error('Unauthorized access');
  }
}
```

### Rate Limiting

```javascript
// Implement rate limiting for session creation
const sessionCreationAttempts = new Map();

function checkRateLimit(userId) {
  const attempts = sessionCreationAttempts.get(userId) || 0;
  if (attempts > 5) {
    throw new Error('Too many session creation attempts. Please wait.');
  }
  sessionCreationAttempts.set(userId, attempts + 1);
  
  // Reset after 1 hour
  setTimeout(() => {
    sessionCreationAttempts.delete(userId);
  }, 3600000);
}
```

## 📈 Monitoring & Analytics

### Track Session Usage

```javascript
// Log session events for analytics
function logSessionEvent(tenantId, event, data = {}) {
  fetch('/admin/analytics/session-event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tenantId,
      event,
      timestamp: new Date().toISOString(),
      data
    })
  });
}

// Usage examples:
logSessionEvent(tenantId, 'session_created');
logSessionEvent(tenantId, 'qr_displayed');
logSessionEvent(tenantId, 'connection_successful');
logSessionEvent(tenantId, 'message_sent', { messageType: 'text' });
```

## 🚀 Advanced Features

### Bulk Session Management

```javascript
async function createMultipleSessions(userIds) {
  const results = [];
  
  for (const userId of userIds) {
    try {
      const result = await fetch('/admin/sessions/create-with-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: userId })
      });
      
      results.push({
        userId,
        success: result.ok,
        data: await result.json()
      });
    } catch (error) {
      results.push({
        userId,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}
```

### Session Health Monitoring

```javascript
// Monitor session health across all users
async function monitorSessionHealth() {
  const response = await fetch('/admin/sessions');
  const data = await response.json();
  
  if (data.success) {
    const sessions = data.data;
    const healthReport = {
      total: sessions.length,
      connected: sessions.filter(s => s.status === 'connected').length,
      disconnected: sessions.filter(s => s.status === 'disconnected').length,
      pending: sessions.filter(s => s.status === 'qr_required').length
    };
    
    updateHealthDashboard(healthReport);
  }
}

// Run health check every 5 minutes
setInterval(monitorSessionHealth, 300000);
```

This integration approach allows your CRM users to connect their WhatsApp without ever needing to access the gateway UI directly. Everything is handled through your CRM interface with a smooth, user-friendly experience.

## 🔗 API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/sessions/create-with-qr` | POST | Create session + get QR in one call |
| `/admin/sessions/:id/qr` | GET | Get QR code for existing session |
| `/admin/sessions/:id/poll` | GET | Poll session status with next action |
| `/admin/sessions/:id/restart` | POST | Restart/reconnect session |
| `/admin/sessions/:id` | GET | Get detailed session status |
| `/admin/sessions/:id` | DELETE | Delete session |
| `/admin/send-message` | POST | Send WhatsApp message |

All endpoints return consistent JSON responses with `success`, `message`, and `data` fields for easy integration.