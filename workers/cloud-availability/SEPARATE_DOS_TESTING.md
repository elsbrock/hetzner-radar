# Testing Separate Durable Objects

## 🏗️ **New Architecture**

The worker now uses **two separate Durable Objects** for better separation of concerns:

### **1. CloudAvailabilityDO** 
- **Purpose**: Hetzner Cloud server availability tracking
- **Interval**: Every 60 seconds
- **Storage**: Cloud availability data in DO storage

### **2. AuctionImportDO**
- **Purpose**: Hetzner auction data import
- **Interval**: Every 5 minutes  
- **Storage**: Auction data in D1 database + import timestamps in DO storage

## 🧪 **Testing Endpoints**

### **Cloud Availability Tests**
```bash
# Get cloud server availability status
curl http://localhost:8787/status
curl http://localhost:8787/cloud/status

# Manual cloud status update
curl -X POST http://localhost:8787/cloud/trigger

# Cloud availability debug info
curl http://localhost:8787/cloud/debug
```

### **Auction Import Tests**
```bash
# Manual auction import
curl -X POST http://localhost:8787/auction/import

# Auction import debug info
curl http://localhost:8787/auction/debug

# Database stats
curl http://localhost:8787/auction/stats
```

### **Combined Tests**
```bash
# Combined debug info from both DOs
curl http://localhost:8787/debug

# Help (lists all endpoints)
curl http://localhost:8787/help
```

## 📊 **What to Monitor**

### **Separate Alarm Schedules**
- **CloudAvailabilityDO**: Alarms every 60 seconds for cloud status
- **AuctionImportDO**: Alarms every 5 minutes for auction import
- **Staggered startup**: Auction DO starts 10 seconds after cloud DO

### **Independent Operation**
- Each DO operates completely independently
- Cloud status failures don't affect auction imports
- Auction import failures don't affect cloud status
- Better error isolation and debugging

### **Individual Logs**
```
[CloudAvailabilityDO abc123] Cloud status update...
[AuctionImportDO def456] Auction import starting...
```

## 🔍 **Debug Output Examples**

### **Cloud Debug (`/cloud/debug`)**
```json
{
  "type": "cloud-availability",
  "lastUpdated": "2025-01-19T...",
  "nextAlarm": "2025-01-19T...",
  "interval": "60000ms",
  "doId": "abc123"
}
```

### **Auction Debug (`/auction/debug`)**
```json
{
  "type": "auction-import", 
  "lastAuctionImport": "2025-01-19T...",
  "nextAlarm": "2025-01-19T...",
  "interval": "300000ms",
  "auctionApiUrl": "https://www.hetzner.com/...",
  "doId": "def456"
}
```

### **Combined Debug (`/debug`)**
```json
{
  "cloudAvailability": { /* cloud DO debug info */ },
  "auctionImport": { /* auction DO debug info */ },
  "worker": {
    "timestamp": "2025-01-19T...",
    "environment": { /* env vars status */ }
  }
}
```

## ✅ **Benefits of Separate DOs**

### **1. Better Separation of Concerns**
- Cloud availability logic is completely isolated
- Auction import logic is completely isolated
- Each DO has single responsibility

### **2. Independent Scaling**
- Cloud availability runs every 60s
- Auction import runs every 5min
- No complex scheduling logic in one DO

### **3. Better Error Handling** 
- Cloud API failures don't affect auction imports
- Database issues only affect auction imports
- Easier to debug and monitor each service

### **4. Easier Testing**
- Test cloud availability independently
- Test auction import independently
- Mock individual services easily

### **5. Future Flexibility**
- Easy to add more specialized DOs
- Can deploy different versions independently
- Clear API boundaries between services

## 🚀 **Testing Strategy**

1. **Test cloud availability**: Trigger manual updates, verify cloud data
2. **Test auction import**: Trigger manual imports, check database
3. **Test independence**: Break one service, verify other continues
4. **Test combined**: Use `/debug` to monitor both services
5. **Test alarms**: Watch logs for proper scheduling intervals