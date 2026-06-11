import express from 'express';
import cors from 'cors';
import path from 'path';
import { db } from './database/mockDb';
import { RiskEngine } from './utils/helpers';
import { GeminiService } from './ai/geminiService';
import { connectMongo } from './database/mongo';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../public'))); // Fallback for tsc dist pathing

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

/**
 * Endpoint to verify server health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Endpoint to fetch Prometheus metrics
 */
app.get('/api/metrics', (req, res) => {
  res.json(db.getPrometheusMetrics());
});

/**
 * Endpoint to retrieve system fallback credentials
 */
app.get('/api/config', (req, res) => {
  res.json({
    fallbackApiKey: process.env.FALLBACK_GEMINI_API_KEY || ''
  });
});

/**
 * Endpoint to analyze a release
 */
app.post('/api/analyze-release', async (req, res) => {
  const { version, service = 'checkout-service', mode = 'demo', apiKey } = req.body;

  const isDemo = mode === 'demo';
  const selectedService = service || 'checkout-service';

  // 1. Calculate risk score using the risk engine
  const riskAnalysis = RiskEngine.calculateRisk(selectedService, isDemo);

  // 2. Draft prompt for Gemini
  const systemPrompt = `You are Sentinel AI, the Predictive DevOps & Deployment Guardian. 
Analyze the release metrics and write a professional, high-impact release risk summary.
Structure your response in markdown format with sections:
- Executive Prediction
- Detailed Risk Breakdown (Memory, Bug, Latency, Historical Outages)
- Actionable Recommendation`;

  const userPrompt = `
Analyze release version: ${version} for service: ${selectedService}.
Telemetry and health details:
- Computed Total Risk Score: ${riskAnalysis.totalRisk}%
- Memory Risk Factor: ${riskAnalysis.memoryRisk}/25
- Open Bugs Risk Factor: ${riskAnalysis.bugRisk}/25
- Latency Risk Factor: ${riskAnalysis.latencyRisk}/25
- Historical Outage Similarity: ${riskAnalysis.historicalRisk}/25
- Raw telemetry warnings/flags:
${riskAnalysis.reasons.map(r => `  * ${r}`).join('\n')}

Please generate a deployment guard report based on this telemetry. Explain why the risk score is at ${riskAnalysis.totalRisk}% and outline the best path forward (e.g. Canary strategy, delay deployment, or normal rolling).`;

  // 3. Request analysis from Gemini (with fallback handling)
  const aiResult = await GeminiService.generateContent(userPrompt, systemPrompt, apiKey);

  res.json({
    version,
    service: selectedService,
    riskScore: riskAnalysis.totalRisk,
    breakdown: {
      memoryRisk: riskAnalysis.memoryRisk,
      bugRisk: riskAnalysis.bugRisk,
      latencyRisk: riskAnalysis.latencyRisk,
      historicalRisk: riskAnalysis.historicalRisk,
      reasons: riskAnalysis.reasons
    },
    report: aiResult.text,
    aiMeta: {
      modelUsed: aiResult.modelUsed,
      keyUsed: aiResult.keyUsed,
      error: aiResult.error
    }
  });
});

/**
 * Endpoint to explain outage (Incident Time Machine)
 */
app.post('/api/explain-outage', async (req, res) => {
  const { query = 'Friday outage', mode = 'demo', apiKey } = req.body;

  // Retrieve matching incident
  const incidents = db.getIncidents();
  const searchIncident = incidents.find(inc => 
    inc.rootCause.toLowerCase().includes(query.toLowerCase()) || 
    inc.service.toLowerCase().includes(query.toLowerCase()) ||
    query.toLowerCase().includes('friday') ||
    query.toLowerCase().includes('outage')
  ) || incidents[0]; // default to first incident

  const systemPrompt = `You are Sentinel AI Incident Time Machine.
Reconstruct the incident timeline based on historical telemetry.
Create a step-by-step chronology showing the start of deployment, initial degradation, cascading failures, root cause analysis, and resolution.
Format in a beautiful markdown list with clear timestamp logs.`;

  const userPrompt = `
Reconstruct the timeline for incident ID ${searchIncident._id} affecting "${searchIncident.service}".
Historical timeline steps:
${searchIncident.timeline.map(t => `- ${t}`).join('\n')}
Root Cause identified: ${searchIncident.rootCause}
Resolution: ${searchIncident.resolution}

Generate an analytical incident autopsy report explaining the cascading failure chain and recommended safeguards to prevent recurrence.`;

  const aiResult = await GeminiService.generateContent(userPrompt, systemPrompt, apiKey);

  res.json({
    incidentId: searchIncident._id,
    service: searchIncident.service,
    rootCause: searchIncident.rootCause,
    timeline: searchIncident.timeline,
    resolution: searchIncident.resolution,
    analysis: aiResult.text,
    aiMeta: {
      modelUsed: aiResult.modelUsed,
      keyUsed: aiResult.keyUsed,
      error: aiResult.error
    }
  });
});

/**
 * Endpoint to get deployment advice
 */
app.post('/api/deployment-advice', async (req, res) => {
  const { service = 'checkout-service', apiKey } = req.body;

  const systemPrompt = `You are Sentinel AI Release Advisor. Provide tactical deployment strategies (e.g. Canary, Blue-Green, Rolling) and safety checks for the specified service. Use tables or lists in markdown to outline traffic split schedules and expected risk reduction percentages.`;
  const userPrompt = `Provide strategic deployment advice for deploying updates to "${service}". The current environment has memory warnings and a history of database connection pool exhaustion. Provide traffic splits (10%, 25%, 50%, 100%) and validation tests.`;

  const aiResult = await GeminiService.generateContent(userPrompt, systemPrompt, apiKey);

  res.json({
    service,
    advice: aiResult.text,
    aiMeta: {
      modelUsed: aiResult.modelUsed,
      keyUsed: aiResult.keyUsed,
      error: aiResult.error
    }
  });
});

/**
 * Endpoint to investigate service root causes
 */
app.post('/api/investigate', async (req, res) => {
  const { service = 'checkout-service', apiKey } = req.body;

  const tickets = db.getJiraTickets().filter(t => t.service === service);
  const metrics = db.getPrometheusMetrics()[service];

  const systemPrompt = `You are Sentinel AI Root Cause Investigator. Your task is to diagnose active anomalies in infrastructure and logs, matching them against known incident patterns.`;
  const userPrompt = `
Investigate the active health state of "${service}".
Active Prometheus telemetry:
- CPU: ${metrics?.cpuUsage || 'N/A'}
- Memory: ${metrics?.memoryUsage || 'N/A'}
- Latency: ${metrics?.latency || 'N/A'}
- Error Rate: ${metrics?.errorRate || 'N/A'}

Active Jira Blocker tickets:
${tickets.map(t => `- [${t.id}] ${t.summary} (${t.priority})`).join('\n')}

Identify the root cause probability, provide specific evidence logs, and list previous matching incident files.`;

  const aiResult = await GeminiService.generateContent(userPrompt, systemPrompt, apiKey);

  res.json({
    service,
    activeMetrics: metrics,
    investigation: aiResult.text,
    aiMeta: {
      modelUsed: aiResult.modelUsed,
      keyUsed: aiResult.keyUsed,
      error: aiResult.error
    }
  });
});

/**
 * Endpoint simulating Slack Slash Commands and Slack Block Kit payload formats
 */
app.post('/api/slack-command', (req, res) => {
  const { commandText } = req.body;
  const normalized = commandText.trim().toLowerCase();

  let blocks: any[] = [];
  let responseText = '';

  if (normalized.startsWith('/analyze-release') || normalized.includes('analyze release')) {
    const parts = commandText.split(' ');
    const version = parts[2] || parts[1] || 'v4.2';
    const serviceName = 'checkout-service';
    const riskAnalysis = RiskEngine.calculateRisk(serviceName, true);

    responseText = `Risk assessment report for *${serviceName} ${version}*`;
    blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔍 *Sentinel AI Release Analysis* for \`${serviceName}\` (\`${version}\`)`
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Risk Score:* ${riskAnalysis.totalRisk}%` },
          { type: 'mrkdwn', text: `*Status:* ${riskAnalysis.totalRisk > 70 ? '🚨 HIGH RISK' : '✅ LOW RISK'}` },
          { type: 'mrkdwn', text: `*Memory Risk:* ${riskAnalysis.memoryRisk}/25` },
          { type: 'mrkdwn', text: `*Bug Risk:* ${riskAnalysis.bugRisk}/25` }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *Risk Triggers Found:*\n${riskAnalysis.reasons.map(r => `• ${r}`).join('\n')}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Delay Deployment 🛑' },
            style: 'danger',
            value: 'delay_deploy'
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Deploy to Canary 🧪' },
            style: 'primary',
            value: 'canary_deploy'
          }
        ]
      }
    ];
  } else if (normalized.startsWith('/explain-outage') || normalized.includes('explain outage')) {
    const incident = db.getIncidents()[0];
    responseText = `Incident autopsy for *${incident.service}*`;
    blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⏳ *Sentinel AI Incident Time Machine* - Autopsy for \`${incident.service}\``
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Root Cause:* ${incident.rootCause}\n*Resolution:* ${incident.resolution}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Timeline History:*\n${incident.timeline.map(t => `• \`${t.split(' - ')[0]}\` - ${t.split(' - ')[1]}`).join('\n')}`
        }
      }
    ];
  } else if (normalized.startsWith('/deployment-advice') || normalized.includes('deployment advice')) {
    responseText = 'Sentinel Deployment Strategy Recommendation';
    blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '💡 *Sentinel AI Intelligent Release Advisor*'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Recommended Strategy:* Canary Deployment\n*Expected Risk Reduction:* 68%\n\n*Traffic Split Schedule:*\n• Split 1: 10% traffic (observe 10 mins)\n• Split 2: 25% traffic (observe 15 mins)\n• Split 3: 50% traffic (observe 20 mins)\n• Split 4: 100% traffic (full roll)'
        }
      }
    ];
  } else if (normalized.startsWith('/investigate') || normalized.includes('investigate')) {
    const serviceName = 'checkout-service';
    const metrics = db.getPrometheusMetrics()[serviceName];
    responseText = `Root cause investigation diagnostics for *${serviceName}*`;
    blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🛠️ *Sentinel AI Root Cause Analysis* for \`${serviceName}\``
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*CPU Usage:* ${metrics.cpuUsage}` },
          { type: 'mrkdwn', text: `*Memory Usage:* ${metrics.memoryUsage}` },
          { type: 'mrkdwn', text: `*Latency:* ${metrics.latency}` },
          { type: 'mrkdwn', text: `*Error Rate:* ${metrics.errorRate}` }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Diagnosis:* Probable database connection pool exhaustion due to open blocking connections and latency spikes. Code matches incident *inc_001*.'
        }
      }
    ];
  } else {
    responseText = 'Unknown command. Available commands: `/analyze-release <version>`, `/explain-outage`, `/deployment-advice`, `/investigate <service>`';
    blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *Command Not Found*\n\nAvailable commands:\n• \`/analyze-release v4.2\` - Perform risk prediction\n• \`/explain-outage\` - Launch Incident Time Machine\n• \`/deployment-advice\` - Fetch canary templates\n• \`/investigate checkout-service\` - Trigger root cause search`
        }
      }
    ];
  }

  res.json({
    text: responseText,
    blocks: blocks
  });
});

// Serve the index.html landing page for all other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to MongoDB Atlas first, then start server
connectMongo().then(() => {
  app.listen(PORT, () => {
    console.log(`[Sentinel Server] Started on http://localhost:${PORT}`);
  });
});
