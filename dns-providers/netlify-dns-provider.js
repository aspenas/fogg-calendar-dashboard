/**
 * Netlify DNS Provider Implementation
 * Final fallback DNS management option
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class NetlifyDNSProvider {
  constructor() {
    this.name = 'Netlify DNS';
    this.apiBase = 'https://api.netlify.com/api/v1';
    this.credentials = null;
    this.dnsZoneId = null;
  }

  async healthCheck() {
    try {
      this.credentials = await this.loadCredentials();
      
      const response = await axios.get(`${this.apiBase}/user`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      return { 
        healthy: response.status === 200,
        error: response.data.error_message 
      };
      
    } catch (error) {
      return { 
        healthy: false, 
        error: `Netlify API unreachable: ${error.message}` 
      };
    }
  }

  async createRecord({ domain, subdomain, target, ttl }) {
    try {
      // First, ensure DNS zone exists for the domain
      await this.ensureDNSZone(domain);
      
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
        error: `Netlify DNS error: ${error.message}`
      };
    }
  }

  async ensureDNSZone(domain) {
    try {
      // Check if DNS zone already exists
      const zones = await this.getDNSZones();
      const existingZone = zones.find(zone => zone.name === domain);
      
      if (existingZone) {
        this.dnsZoneId = existingZone.id;
        return existingZone;
      }

      // Create new DNS zone
      const response = await axios.post(`${this.apiBase}/dns_zones`, {
        name: domain
      }, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      this.dnsZoneId = response.data.id;
      
      // Return setup instructions since nameservers need to be changed
      return {
        id: response.data.id,
        nameservers: response.data.dns_servers,
        setupRequired: true
      };

    } catch (error) {
      throw new Error(`Failed to create/find DNS zone: ${error.message}`);
    }
  }

  async getDNSZones() {
    const response = await axios.get(`${this.apiBase}/dns_zones`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  async findExistingRecord(subdomain) {
    if (!this.dnsZoneId) return null;

    const response = await axios.get(`${this.apiBase}/dns_zones/${this.dnsZoneId}/dns_records`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.find(record => 
      record.hostname === subdomain && record.type === 'CNAME'
    );
  }

  async createNewRecord({ subdomain, target, ttl }) {
    const response = await axios.post(`${this.apiBase}/dns_zones/${this.dnsZoneId}/dns_records`, {
      type: 'CNAME',
      hostname: subdomain,
      value: target,
      ttl: ttl
    }, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: response.status === 201,
      recordId: response.data.id,
      error: response.data.error_message
    };
  }

  async updateRecord(recordId, { target, ttl }) {
    const response = await axios.put(`${this.apiBase}/dns_zones/${this.dnsZoneId}/dns_records/${recordId}`, {
      type: 'CNAME',
      value: target,
      ttl: ttl
    }, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      success: response.status === 200,
      recordId: recordId,
      error: response.data.error_message
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
        console.warn(`Netlify credential source failed: ${error.message}`);
      }
    }

    throw new Error('No valid Netlify credentials found');
  }

  async loadFromEnvironment() {
    if (process.env.NETLIFY_ACCESS_TOKEN) {
      return {
        accessToken: process.env.NETLIFY_ACCESS_TOKEN
      };
    }
    return null;
  }

  async loadFromFile() {
    try {
      const credsPath = path.join(__dirname, '..', 'config', 'netlify-creds.json');
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
   * Setup instructions for Netlify DNS as final fallback
   */
  static async generateSetupInstructions(domain, nameservers) {
    return `
# Netlify DNS Setup Instructions

## When to Use This Option
This is the final fallback when both Porkbun and Cloudflare fail.
Netlify DNS is reliable but requires nameserver changes.

## Setup Steps:

### 1. Get Netlify Access Token
1. Go to https://app.netlify.com/user/applications
2. Click "New access token"
3. Give it a name: "DNS Management"
4. Copy the token
5. Set environment variable: NETLIFY_ACCESS_TOKEN=your_token_here

### 2. Change Nameservers (Required)
At your domain registrar (Porkbun), change nameservers to:
${nameservers ? nameservers.map(ns => `- ${ns}`).join('\n') : '- (Will be provided after DNS zone creation)'}

### 3. Run Automated Setup
\`\`\`bash
NETLIFY_ACCESS_TOKEN=your_token_here node dns-management-system.js
\`\`\`

### 4. Alternative: Manual Setup in Netlify Dashboard
1. Go to https://app.netlify.com/teams/[your-team]/dns
2. Click "Add domain"
3. Enter: ${domain}
4. Add DNS record:
   - Type: CNAME
   - Name: fogg
   - Value: fogg-calendar.netlify.app
   - TTL: 300

## Important Notes:
- ⚠️  Changing nameservers affects ALL DNS records for ${domain}
- 🕐 DNS propagation can take 24-48 hours
- ✅ Once setup, Netlify DNS is very reliable
- 🆓 Netlify DNS is free with any Netlify account

## Verification:
After nameserver propagation (24-48 hours), test with:
\`\`\`bash
dig fogg.${domain}
curl -I https://fogg.${domain}
\`\`\`

## Rollback Plan:
If you need to rollback, change nameservers back to:
- curitiba.ns.porkbun.com
- salvador.ns.porkbun.com
- fortaleza.ns.porkbun.com
- maceio.ns.porkbun.com
`;
  }
}

module.exports = NetlifyDNSProvider;