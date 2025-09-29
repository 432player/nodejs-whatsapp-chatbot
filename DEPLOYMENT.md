# Deployment Guide - Medidate Bot v2.0

## 🚀 Heroku Deployment

Since your bot is already connected to a Heroku machine, here's how to deploy the migrated version:

### 1. Environment Variables

Set these environment variables in your Heroku app:

```bash
# Via Heroku CLI
heroku config:set GATEWAY_BASE_URL=https://your-gateway-domain.com
heroku config:set GATEWAY_MASTER_KEY=your-master-key
heroku config:set PUBLIC_WEBHOOK_URL=https://your-heroku-app.herokuapp.com

# Keep existing PORT (Heroku sets this automatically)
# Remove old Whapi variables after testing:
heroku config:unset TOKEN
heroku config:unset baseURL
heroku config:unset GROUP
heroku config:unset PRODUCT
```

### 2. Gateway Setup Options

#### Option A: Use External Gateway Service
If you have the Super Light Gateway running on another server:
```bash
heroku config:set GATEWAY_BASE_URL=https://your-gateway-server.com
```

#### Option B: Run Gateway on Separate Heroku App
1. Create a new Heroku app for the gateway
2. Deploy the Super Light Gateway to that app
3. Use the new app's URL as your `GATEWAY_BASE_URL`

### 3. Deploy the Bot

```bash
# Add and commit your changes
git add .
git commit -m "Migrate to Super Light WhatsApp API Server v2.0"

# Deploy to Heroku
git push heroku main

# Check logs
heroku logs --tail
```

### 4. Post-Deployment Testing

```bash
# Test the migration
npm run migrate

# Run integration tests
npm test

# Check bot status
curl https://your-heroku-app.herokuapp.com/
```

## 🔧 Configuration Verification

### Required Environment Variables
- ✅ `PORT` (set by Heroku)
- ✅ `PUBLIC_WEBHOOK_URL` (your Heroku app URL)
- ✅ `GATEWAY_BASE_URL` (Super Light Gateway URL)
- ✅ `GATEWAY_MASTER_KEY` (from gateway dashboard)

### Webhook URL Format
Your webhook URL should be:
```
https://your-heroku-app.herokuapp.com/webhooks/whatsapp
```

## 📱 First Session Setup

After deployment:

1. **Create a session via API:**
```bash
curl -X POST https://your-heroku-app.herokuapp.com/admin/sessions \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "your-first-user"}'
```

2. **Get QR code:**
   - Visit your gateway dashboard
   - Find the session for "your-first-user"
   - Scan QR code with WhatsApp

3. **Test messaging:**
```bash
curl -X POST https://your-heroku-app.herokuapp.com/admin/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "your-first-user",
    "to": "1234567890",
    "message": "Hello from migrated bot!",
    "type": "text"
  }'
```

## 🔍 Monitoring & Logs

### Heroku Logs
```bash
# View real-time logs
heroku logs --tail

# View specific log lines
heroku logs --num 100

# Filter for errors
heroku logs --tail | grep ERROR
```

### Health Monitoring
The bot includes automatic health checks every 5 minutes. You can also trigger manual checks:

```bash
curl -X POST https://your-heroku-app.herokuapp.com/admin/health-check
```

## 🚨 Troubleshooting

### Common Issues

1. **Gateway Connection Failed**
   ```bash
   # Check if gateway URL is accessible
   curl https://your-gateway-domain.com/api/v1/sessions
   
   # Verify master key
   heroku config:get GATEWAY_MASTER_KEY
   ```

2. **Webhook Not Receiving Messages**
   ```bash
   # Verify webhook URL is set correctly
   heroku config:get PUBLIC_WEBHOOK_URL
   
   # Check if webhook endpoint is accessible
   curl https://your-heroku-app.herokuapp.com/webhooks/whatsapp
   ```

3. **Session Creation Fails**
   ```bash
   # Check logs for detailed error
   heroku logs --tail
   
   # Verify environment variables
   heroku config
   ```

### Debug Mode

To enable more verbose logging, you can temporarily add:
```bash
heroku config:set NODE_ENV=development
```

## 📊 Performance Considerations

### Heroku Dyno Management
- The bot includes keep-alive pings to prevent dyno sleeping
- Consider upgrading to Hobby dyno for 24/7 availability
- Monitor dyno usage in Heroku dashboard

### Session Limits
- Each session uses memory for caching
- Monitor memory usage with many concurrent sessions
- Consider implementing database persistence for production

## 🔄 Rollback Plan

If you need to rollback to the old Whapi.cloud version:

1. **Revert environment variables:**
```bash
heroku config:set TOKEN=your-old-whapi-token
heroku config:set baseURL=https://your-heroku-app.herokuapp.com
```

2. **Deploy previous version:**
```bash
git revert HEAD
git push heroku main
```

3. **Restore old webhook:**
The old `/messages` endpoint will need to be restored.

## 📈 Scaling Considerations

For high-volume usage:
- Consider using Redis for session storage
- Implement rate limiting per tenant
- Use database for persistent session management
- Set up monitoring and alerting

## 🔐 Security Checklist

- ✅ Master key is secure and not logged
- ✅ Session tokens are not exposed to clients
- ✅ Webhook endpoint validates requests
- ✅ Phone numbers are properly formatted
- ✅ Error messages don't leak sensitive information

---

**Need Help?** Check the main README.md for detailed API documentation and troubleshooting guides.