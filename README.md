# Sentinel AI — Predictive DevOps & Deployment Guardian

> The intelligent deployment guardian that predicts outages and release risks *before* they happen. Built for the **Slack Agent Builder Challenge**.

---

## 🚀 Vision

**From:** Reacting to out-of-memory and timeout alerts after outages occur.  
**To:** Blocking risky deployments before they reach your Kubernetes cluster.

Sentinel AI acts as **"Grammarly for Software Releases."** Instead of simply tracking metrics in Grafana after code is live, Sentinel is integrated into your deployment pipelines (or directly via Slack interactive commands) to predict outage risks beforehand.

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────────┐
                    │      Slack Client       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Sentinel AI Backend   │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   GitHub MCP Node         Jira MCP Node        Prometheus MCP Node
 (Commits, diffs, PRs)   (Open bug backlogs)    (CPU/Memory/Latency)
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                     ┌────────────────────────┐
                     │    Gemini AI Engine    │
                     │  (Flash/Pro Rotation)  │
                     └───────────┬────────────┘
                                 │
                                 ▼
                     ┌────────────────────────┐
                     │  Risk Score Calculator │
                     │   (Weight Analytics)   │
                     └───────────┬────────────┘
                                 │
                                 ▼
                     ┌────────────────────────┐
                     │ Slack Block Kit Render │
                     └────────────────────────┘
```

---

## ⚡ Key Features

1. **Deployment Risk Analyzer (`/analyze-release`)**
   - Automatically cross-references PR commits with active system loads and Jira bugs.
   - Outputs a computed risk coefficient metric.

2. **Incident Time Machine (`/explain-outage`)**
   - Reconstructs timeline chains of previous incidents.
   - Highlights cascading anomalies and triggers.

3. **Intelligent Release Advisor (`/deployment-advice`)**
   - Suggests deployment styles (e.g. Canary Splits: 10%, 25%, 50%, 100%) and traffic schedules.

4. **Root Cause Analysis (`/investigate`)**
   - Direct troubleshooting scanner mapping live telemetry warning statuses to runbook files.

---

## 🧠 AI Workflow & Risk Score Formula

When a release query is submitted:
1. **Context Collection:** Sentinel queries Git, Jira, Prometheus, and historical incident logs.
2. **Formula Weights Application:**
   $$\text{Risk Score} = \text{Memory Risk (25)} + \text{Jira Bug Risk (25)} + \text{Latency Risk (25)} + \text{Similarity Risk (25)}$$
3. **Gemini Guardrail Synthesis:** The payload is packaged and evaluated by the Gemini AI Engine to produce formatted diagnostic reports and deployment advice.

---

## 🔄 Free Tier Optimization: Model Switching & Fallback

To maximize utilization of the Gemini Free Tier while avoiding rate limit errors:
- **Model Switching:** Sentinel attempts API connections sequentially through the following queue:
  1. `gemini-2.5-flash`
  2. `gemini-1.5-flash`
  3. `gemini-1.5-pro`
- **Fallback Credentials:** If the primary configured API key is exhausted or missing, the system automatically hot-switches to the backup hackathon API token:  
  `AQ.Ab8RN6LSUm4etQfdxuGi49NfCkW8biaf8aefoKCPnJhhv6Gv3w`

---

## ⚙️ Local Development Setup

### Prerequisites
- Node.js (v18+)
- NPM

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/nomaantalib/Senitel-AI.git
   cd Senitel-AI
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Compile TypeScript:
   ```bash
   npm run build
   ```
4. Start development server:
   ```bash
   npm run dev
   ```
5. Open your browser to `http://localhost:3000` to access the hero landing page and console control dashboard.

---

## 🧪 Testing Live & Demo Mode
- **Demo Mode:** Toggle to "Demo Mode" in the header to run calculations using high-fidelity pre-packaged incident datasets in `mockData.json`.
- **Live Mode:** Toggle to "Live Mode" and enter a custom Gemini API key in the settings panel to run real-time prompt generation and analysis against the Live Gemini endpoints.
