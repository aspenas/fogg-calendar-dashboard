/**
 * Cloudflare DNS Provider Implementation
 * Provides fallback DNS management when Porkbun fails
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class CloudflareProvider {
  constructor() {
    this.name = 'Cloudflare';
    this.apiBase = 'https://api.cloudflare.com/client/v4';
    this.credentials = null;
    this.zoneId = null;
  }

  async healthCheck() {
    try {
      this.credentials = await this.loadCredentials();
      
      const response = await axios.get(`${this.apiBase}/user/tokens/verify`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.apiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      return { 
        healthy: response.data.success,
        error: response.data.errors?.[0]?.message 
      };
      
    } catch (error) {
      return { 
        healthy: false, 
        error: `Cloudflare API unreachable: ${error.message}` 
      };
    }
  }

  async createRecord({ domain, subdomain, target, ttl }) {
    try {
      // First, get zone ID for the domain
      await this.getZoneId(domain);
      
      // Check if record already exists
      const existingRecord = await this.findExistingRecord(subdomain);
      
      if (existingRecord) {
        // Update existing record
        return await this.updateRecord(existingRecord.id, { target, ttl });
      } else {
        // Create new record
        return await this.createNewRecord({ subdomain, target, ttl });
      }

    } catch (error) {
      return {
        success: false,
        error: `Cloudflare DNS error: ${error.message}`
      };
    }
  }

  async getZoneId(domain) {
    if (this.zoneId) return this.zoneId;

    const response = await axios.get(`${this.apiBase}/zones`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.apiToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        name: domain,
        status: 'active'
      }
    });

    if (!response.data.success || response.data.result.length === 0) {
      throw new Error(`Zone not found for domain: ${domain}. Ensure domain is managed by Cloudflare.`);
    }

    this.zoneId = response.data.result[0].id;
    return this.zoneId;
  }

  async findExistingRecord(subdomain) {
    const response = await axios.get(`${this.apiBase}/zones/${this.zoneId}/dns_records`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.apiToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        name: subdomain,
        type: 'CNAME'
      }
    });

    if (response.data.success && response.data.result.length > 0) {
      return response.data.result[0];
    }

    return null;
  }

  async createNewRecord({ subdomain, target, ttl }) {
    const response = await axios.post(`${this.apiBase}/zones/${this.zoneId}/dns_records`, {
      type: 'CNAME',
      name: subdomain,
      content: target,
      ttl: ttl
    }, {
      headers: {
        'Authorization': `Bearer ${this.credentials.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: response.data.success,
      recordId: response.data.result?.id,
      error: response.data.errors?.[0]?.message
    };
  }

  async updateRecord(recordId, { target, ttl }) {
    const response = await axios.put(`${this.apiBase}/zones/${this.zoneId}/dns_records/${recordId}`, {
      type: 'CNAME',
      content: target,
      ttl: ttl
    }, {
      headers: {
        'Authorization': `Bearer ${this.credentials.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: response.data.success,
      recordId: recordId,
      error: response.data.errors?.[0]?.message
    };
  }

  async loadCredentials() {
    // Try multiple credential sources
    const sources = [
      () => this.loadFromEnvironment(),
      () => this.loadFromFile(),
      () => this.loadFromAWSSecrets()
    ];

    for (const source of sources) {
      try {
        const creds = await source();
        if (creds) return creds;
      } catch (error) {
        console.warn(`Cloudflare credential source failed: ${error.message}`);
      }
    }

    throw new Error('No valid Cloudflare credentials found');
  }

  async loadFromEnvironment() {
    if (process.env.CLOUDFLARE_API_TOKEN) {
      return {
        apiToken: process.env.CLOUDFLARE_API_TOKEN
      };
    }
    return null;
  }

  async loadFromFile() {
    try {
      const credsPath = path.join(__dirname, '..', 'config', 'cloudflare-creds.json');
      const creds = JSON.parse(await fs.readFile(credsPath, 'utf8'));
      return creds;
    } catch {
      return null;
    }
  }

  async loadFromAWSSecrets() {
    // Implementation would depend on AWS SDK
    return null;
  }

  /**
   * Setup instructions for Cloudflare as fallback
   */
  static async generateSetupInstructions(domain) {
    return `
# Cloudflare DNS Setup Instructions

## Prerequisites
Your domain (${domain}) needs to be managed by Cloudflare.

## Migration Steps:

### 1. Add Domain to Cloudflare
1. Go to https://dash.cloudflare.com
2. Click "Add site"
3. Enter: ${domain}
4. Choose plan (Free plan works fine)

### 2. Change Nameservers
At your domain registrar (Porkbun), change nameservers to:
- helen.ns.cloudflare.com
- ravi.ns.cloudflare.com
(Actual nameservers will be shown in Cloudflare dashboard)

### 3. Get API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Custom Token" with permissions:
   - Zone:Zone:Read
   - Zone:DNS:Edit
4. Include specific zone: ${domain}
5. Save token to environment variable: CLOUDFLARE_API_TOKEN

### 4. Run Automated Setup
\`\`\`bash
CLOUDFLARE_API_TOKEN=your_token_here node dns-management-system.js
\`\`\`

## Benefits of Cloudflare:
- ✅ More reliable API (99.9% uptime)
- ✅ Better DDoS protection
- ✅ Free SSL certificates
- ✅ CDN for faster loading
- ✅ Advanced DNS features
- ✅ Better monitoring and analytics

## Verification:
After setup, test with:
\`\`\`bash
dig fogg.${domain}
curl -I https://fogg.${domain}
\`\`\`
`;
  }
}

module.exports = CloudflareProvider;