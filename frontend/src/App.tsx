import React, { useState, useEffect, useRef } from 'react';

// Interfaces for UI state
interface IncidentStep {
  type: string;
  content: string;
}

interface SlackMessage {
  id: string;
  sender: 'bot' | 'user';
  name: string;
  timestamp: string;
  text: string;
  avatarBg?: string;
  avatarIcon?: string;
  blocks?: any[];
}

interface MetricState {
  cpuUsage: string;
  memoryUsage: string;
  latency: string;
  errorRate: string;
  status: string;
}

export default function App() {
  // Page routing state: 'landing' or 'console'
  const [currentPage, setCurrentPage] = useState<'landing' | 'console'>(
    window.location.pathname === '/console' ? 'console' : 'landing'
  );

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<
    'risk-analyzer' | 'time-machine' | 'release-advisor' | 'root-cause' | 'slack-simulator' | 'model-config'
  >('risk-analyzer');

  // Mode Selection: Demo or Live
  const [isDemo, setIsDemo] = useState<boolean>(true);

  // Gemini API Key config
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [fallbackKey, setFallbackKey] = useState<string>('Loading...');
  
  // Diagnostics
  const [lastModel, setLastModel] = useState<string>('N/A');
  const [lastKeyUsed, setLastKeyUsed] = useState<string>('N/A');

  // GitHub Connection State (for Live Mode) - Load from localStorage or fallback to default
  const getInitialRepo = () => {
    const saved = localStorage.getItem('sentinel_connected_repo');
    if (saved !== null) return saved;
    return 'nomaantalib/Senitel-AI';
  };

  const getInitialConnected = () => {
    const saved = localStorage.getItem('sentinel_github_connected');
    if (saved !== null) return saved === 'true';
    return true; // default pre-connected
  };

  const [githubRepo, setGithubRepo] = useState<string>(getInitialRepo);
  const [githubInput, setGithubInput] = useState<string>(getInitialRepo);
  const [isGithubVerifying, setIsGithubVerifying] = useState<boolean>(false);
  const [githubMsg, setGithubMsg] = useState<{ text: string; type: 'info' | 'success' | 'error' | 'warn' } | null>({
    text: getInitialConnected() ? 'Connected to repository' : 'Disconnected',
    type: getInitialConnected() ? 'success' : 'warn'
  });
  const [githubConnected, setGithubConnected] = useState<boolean>(getInitialConnected);

  // Feature 1: Pre-Deployment Risk Analyzer
  const [releaseVersion, setReleaseVersion] = useState<string>('v4.2');
  const [targetService, setTargetService] = useState<string>('checkout-service');
  const [analyzerLogs, setAnalyzerLogs] = useState<string[]>([
    'Idle. Input version and service to trigger scanning.'
  ]);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskBadge, setRiskBadge] = useState<{ text: string; className: string }>({ text: 'N/A', className: 'badge' });
  const [recommendation, setRecommendation] = useState<string>('Pending Input');
  const [breakdown, setBreakdown] = useState({ memory: 0, bugs: 0, latency: 0, history: 0 });
  const [riskReport, setRiskReport] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Feature 2: Incident Time Machine
  const [outageQuery, setOutageQuery] = useState<string>('checkout memory leak');
  const [timelineSteps, setTimelineSteps] = useState<IncidentStep[]>([]);
  const [outageAutopsy, setOutageAutopsy] = useState<string>('');
  const [isReconstructing, setIsReconstructing] = useState<boolean>(false);

  // Feature 3: Release Advisor
  const [adviceService, setAdviceService] = useState<string>('checkout-service');
  const [adviceReport, setAdviceReport] = useState<string>('');
  const [isFetchingAdvice, setIsFetchingAdvice] = useState<boolean>(false);

  // Feature 4: Root Cause Anomaly Scanner
  const [rcaService, setRcaService] = useState<string>('checkout-service');
  const [rcaMetrics, setRcaMetrics] = useState<MetricState | null>(null);
  const [rcaReport, setRcaReport] = useState<string>('');
  const [isScanningRca, setIsScanningRca] = useState<boolean>(false);

  // Feature 5: Slack Workspace Simulator
  const [slackInput, setSlackInput] = useState<string>('');
  const [slackMessages, setSlackMessages] = useState<SlackMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      name: 'Sentinel AI',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: 'Welcome to Sentinel AI DevOps Guardian interface. I am monitoring your deployment risk in real-time. Try typing `/analyze-release v4.2` or `/explain-outage` in the simulator prompt.'
    }
  ]);
  const [isSlackResponding, setIsSlackResponding] = useState<boolean>(false);

  const slackFeedEndRef = useRef<HTMLDivElement>(null);
  const logFeedIntervalRef = useRef<any>(null);
  const [landingLogs, setLandingLogs] = useState<Array<{ type: string; text: string; time: string }>>([
    { type: 'info', text: 'SENTINEL AI: Initializing pre-deployment scanner...', time: new Date().toLocaleTimeString() },
    { type: 'info', text: 'github-mcp: Fetching commits & changed files (v4.2)', time: new Date().toLocaleTimeString() },
    { type: 'warn', text: 'jira-mcp: Found critical open bug JIRA-101 (checkout-service)', time: new Date().toLocaleTimeString() },
    { type: 'error', text: 'prometheus-mcp: Memory usage exceeds 85% warning threshold', time: new Date().toLocaleTimeString() },
    { type: 'info', text: 'rag-db: Indexing database incident database matching inc_001', time: new Date().toLocaleTimeString() },
    { type: 'success', text: 'gemini-llm: Model switching to gemini-2.5-flash', time: new Date().toLocaleTimeString() },
    { type: 'bold', text: 'RISK PREDICTION: 76% High Risk Outage Probability', time: new Date().toLocaleTimeString() }
  ]);

  // Sync state with browser navigation
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPage(window.location.pathname === '/console' ? 'console' : 'landing');
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Fetch fallback key config on startup
  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const data = await response.json();
          if (data.fallbackApiKey) {
            setFallbackKey(data.fallbackApiKey);
          }
        }
      } catch (err) {
        console.error('Failed to fetch config credentials:', err);
      }
    }
    fetchConfig();
  }, []);

  // Auto scroll Slack Simulator chat feed
  useEffect(() => {
    slackFeedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [slackMessages]);

  // Landing page live background logger simulation
  useEffect(() => {
    if (currentPage === 'landing') {
      const sampleLogs = [
        { type: 'info', text: 'github-mcp: PR #182 merged successfully.' },
        { type: 'info', text: 'prometheus-mcp: Service checkout-service telemetry synced.' },
        { type: 'warn', text: 'jira-mcp: Blocker ticket JIRA-102 unresolved.' },
        { type: 'error', text: 'prometheus-mcp: Latency exceeded 200ms threshold.' },
        { type: 'success', text: 'gemini-llm: Analysis generated via gemini-2.5-flash.' },
        { type: 'bold', text: 'SENTINEL: Outage prediction checked (Score: 76%)' }
      ];
      let logIndex = 0;
      logFeedIntervalRef.current = setInterval(() => {
        const log = sampleLogs[logIndex];
        setLandingLogs(prev => [
          ...prev.slice(-15),
          { type: log.type, text: log.text, time: new Date().toLocaleTimeString() }
        ]);
        logIndex = (logIndex + 1) % sampleLogs.length;
      }, 4000);
    } else {
      if (logFeedIntervalRef.current) {
        clearInterval(logFeedIntervalRef.current);
      }
    }

    return () => {
      if (logFeedIntervalRef.current) {
        clearInterval(logFeedIntervalRef.current);
      }
    };
  }, [currentPage]);

  // Navigate function updating URL path dynamically
  const navigateTo = (page: 'landing' | 'console') => {
    window.history.pushState({}, '', page === 'console' ? '/console' : '/');
    setCurrentPage(page);
  };

  // Helper API selector depending on Demo / Live configuration
  const getModeParams = () => {
    return {
      mode: isDemo ? 'demo' : 'live',
      apiKey: userApiKey.trim() || undefined,
      githubRepo: !isDemo && githubConnected ? githubRepo : undefined
    };
  };

  // Update last run metrics for Config UI
  const updateMetaInfo = (meta: any) => {
    if (meta) {
      setLastModel(meta.modelUsed || 'N/A');
      setLastKeyUsed(meta.keyUsed || 'N/A');
    }
  };

  // GitHub Connection Action handler
  const handleConnectGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    const repoVal = githubInput.trim();
    if (!repoVal) {
      setGithubMsg({ text: 'Please enter repository owner/name.', type: 'error' });
      return;
    }

    setIsGithubVerifying(true);
    setGithubMsg({ text: 'Locating repository...', type: 'info' });

    try {
      const response = await fetch(`https://api.github.com/repos/${repoVal}`);
      if (response.ok) {
        setGithubRepo(repoVal);
        setGithubConnected(true);
        setGithubMsg({ text: `Connected successfully to ${repoVal}`, type: 'success' });
        localStorage.setItem('sentinel_connected_repo', repoVal);
        localStorage.setItem('sentinel_github_connected', 'true');
      } else {
        setGithubMsg({
          text: `Verification failed (status ${response.status} - repository not found or private). Click "Force Connect" to proceed anyway.`,
          type: 'error'
        });
      }
    } catch (err: any) {
      setGithubMsg({ text: `Connection error: ${err.message}. Click "Force Connect" to proceed anyway.`, type: 'error' });
    } finally {
      setIsGithubVerifying(false);
    }
  };

  const handleForceConnect = () => {
    const repoVal = githubInput.trim() || 'sentinel-ai-custom-repo';
    setGithubRepo(repoVal);
    setGithubConnected(true);
    setGithubMsg({ text: `Connected successfully (Forced) to ${repoVal}`, type: 'success' });
    localStorage.setItem('sentinel_connected_repo', repoVal);
    localStorage.setItem('sentinel_github_connected', 'true');
  };

  const handleDisconnectGithub = () => {
    setGithubRepo('');
    setGithubConnected(false);
    setGithubInput('');
    setGithubMsg(null);
    localStorage.removeItem('sentinel_connected_repo');
    localStorage.removeItem('sentinel_github_connected');
  };

  // Feature 1 Audit function
  const handleAnalyzeRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDemo && !githubConnected) {
      alert('You must connect a GitHub repository first to run Live Mode audits.');
      return;
    }

    setIsAnalyzing(true);
    setAnalyzerLogs(['[' + new Date().toLocaleTimeString() + '] Initializing pre-deployment scan routine...']);

    const steps = [
      isDemo ? 'github-mcp: Loading package commits...' : `github-api: Fetching recent commits for "${githubRepo}"...`,
      'jira-mcp: Auditing open bugs and blockers...',
      'prometheus-mcp: Loading system telemetry & cpu/memory loads...',
      'rag-db: Matching deployment blueprints against historical runbooks...',
      'gemini-service: Evaluating risk matrices using Gemini LLM...'
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      setAnalyzerLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${steps[i]}`]);
    }

    try {
      const response = await fetch('/api/analyze-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: releaseVersion,
          service: targetService,
          ...getModeParams()
        })
      });

      if (!response.ok) throw new Error('API server returned error status code.');
      const data = await response.json();

      setRiskScore(data.riskScore);
      setBreakdown({
        memory: data.breakdown.memoryRisk,
        bugs: data.breakdown.bugRisk,
        latency: data.breakdown.latencyRisk,
        history: data.breakdown.historicalRisk
      });

      if (data.riskScore > 70) {
        setRiskBadge({ text: 'High Risk', className: 'badge badge-red' });
        setRecommendation('Delay Deployment');
      } else if (data.riskScore > 40) {
        setRiskBadge({ text: 'Medium Risk', className: 'badge badge-yellow' });
        setRecommendation('Canary Split');
      } else {
        setRiskBadge({ text: 'Low Risk', className: 'badge badge-green' });
        setRecommendation('Deploy Approved');
      }

      setRiskReport(data.report);
      updateMetaInfo(data.aiMeta);
      setAnalyzerLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Pre-deployment audit completed. Risk Score: ${data.riskScore}%`]);
    } catch (err: any) {
      setAnalyzerLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [ERROR] Failed to run audit: ${err.message}`]);
      setRiskReport(`### 🚨 Pre-Deployment Audit Failed\n\n**Reason:** ${err.message || 'Connection Timed Out'}\n\nUnable to establish communication with the Sentinel AI analysis engine. \n- Please verify that your backend Express server is running on port 3000.\n- Check your internet connection.\n- Ensure your API credentials are valid.`);
      setRecommendation('Audit Failed');
      setRiskScore(null);
      setRiskBadge({ text: 'Error', className: 'badge badge-red' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Feature 2 Autopsy function
  const handleReconstructTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsReconstructing(true);
    setOutageAutopsy('');
    setTimelineSteps([{ type: 'info', content: 'Reconstructing incident logs...' }]);

    try {
      const response = await fetch('/api/explain-outage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: outageQuery,
          ...getModeParams()
        })
      });

      if (!response.ok) throw new Error('Failed to reconstruct outage chronology.');
      const data = await response.json();

      const parsedSteps: IncidentStep[] = data.timeline.map((step: string) => {
        let type = 'completed-step';
        const lower = step.toLowerCase();
        if (lower.includes('started') || lower.includes('completed')) {
          type = 'completed-step';
        } else if (lower.includes('spike') || lower.includes('exhaustion') || lower.includes('increase')) {
          type = 'warn-step';
        } else if (lower.includes('failure') || lower.includes('restart') || lower.includes('error')) {
          type = 'failed-step';
        }
        return { type, content: step };
      });

      setTimelineSteps(parsedSteps);
      setOutageAutopsy(data.analysis);
      updateMetaInfo(data.aiMeta);
    } catch (err: any) {
      setTimelineSteps([{ type: 'failed-step', content: `Autopsy failed: ${err.message}` }]);
      setOutageAutopsy(`### 🚨 Chronology Reconstruction Failed\n\n**Reason:** ${err.message || 'Connection Timed Out'}\n\nCould not reconstruct the timeline. Please verify your connection to the Express server.`);
    } finally {
      setIsReconstructing(false);
    }
  };

  // Feature 3 Release Advisor function
  const handleGetReleaseAdvice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFetchingAdvice(true);
    setAdviceReport('');

    try {
      const response = await fetch('/api/deployment-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: adviceService,
          apiKey: userApiKey.trim() || undefined
        })
      });
      if (!response.ok) throw new Error('API server failed to provide recommendations.');
      const data = await response.json();
      setAdviceReport(data.advice);
      updateMetaInfo(data.aiMeta);
    } catch (err: any) {
      setAdviceReport(`### 🚨 Advice Consultation Failed\n\n**Reason:** ${err.message || 'Connection Timed Out'}\n\nCould not fetch release advice recommendations.`);
    } finally {
      setIsFetchingAdvice(false);
    }
  };

  // Feature 4 Anomaly Scanner function
  const handleRcaScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanningRca(true);
    setRcaReport('');

    try {
      const response = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: rcaService,
          apiKey: userApiKey.trim() || undefined
        })
      });
      if (!response.ok) throw new Error('API server investigation scan failed.');
      const data = await response.json();

      if (data.activeMetrics) {
        setRcaMetrics(data.activeMetrics);
      }
      setRcaReport(data.investigation);
      updateMetaInfo(data.aiMeta);
    } catch (err: any) {
      setRcaReport(`### 🚨 Anomaly Scan Failed\n\n**Reason:** ${err.message || 'Connection Timed Out'}\n\nCould not investigate Microservice health telemetry.`);
    } finally {
      setIsScanningRca(false);
    }
  };

  // Feature 5 Slack Simulator command execution
  const executeSlackCommand = async (commandText: string) => {
    if (!commandText.trim()) return;

    // Append operator query
    const userMsgId = 'usr-' + Date.now();
    setSlackMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        name: 'Operator',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: commandText,
        avatarBg: '#1f75cb'
      }
    ]);
    setSlackInput('');
    setIsSlackResponding(true);

    try {
      const response = await fetch('/api/slack-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandText })
      });
      const data = await response.json();
      
      // Simulate typing split delay
      await new Promise(r => setTimeout(r, 600));

      setSlackMessages(prev => [
        ...prev,
        {
          id: 'bot-' + Date.now(),
          sender: 'bot',
          name: 'Sentinel AI',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: data.text,
          blocks: data.blocks
        }
      ]);
    } catch (err: any) {
      setSlackMessages(prev => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'bot',
          name: 'Sentinel AI',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `Error connecting to simulator router: ${err.message}`
        }
      ]);
    } finally {
      setIsSlackResponding(false);
    }
  };

  // Helper to render basic markdown safely
  const renderMarkdown = (md: string) => {
    if (!md) return '';
    let html = md;
    
    // Code blocks: ```language ... ``` -> <pre><code>...</code></pre>
    html = html.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre class="code-block font-mono">$2</pre>');
    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    // Inline code
    html = html.replace(/`(.*?)`/gim, '<code>$1</code>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    // Lists
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // Radial score gauge geometry math
  const strokeDashoffset = riskScore !== null ? 314.16 * (1 - riskScore / 100) : 314.16;
  const strokeColor = riskScore !== null ? (riskScore > 70 ? 'var(--color-red)' : riskScore > 40 ? 'var(--color-yellow)' : 'var(--color-green)') : '#6366f1';

  // Render Landing Page
  if (currentPage === 'landing') {
    return (
      <div className="dark-theme">
        <section id="hero-section" className="hero-wrapper">
          <div className="glow-orb orb-1"></div>
          <div className="glow-orb orb-2"></div>
          
          <div className="hero-container">
            <nav className="hero-nav">
              <div className="logo" onClick={() => navigateTo('landing')} style={{ cursor: 'pointer' }}>
                <i className="fa-solid fa-shield-halved text-gradient"></i>
                <span>SENTINEL <span className="accent-text">AI</span></span>
              </div>
              <div className="nav-links">
                <a href="#features">Features</a>
                <a href="#architecture">How It Works</a>
                <button onClick={() => navigateTo('console')} className="btn btn-secondary">Enter Console</button>
              </div>
            </nav>

            <div className="hero-main">
              <div className="hero-left">
                <div className="badge-new">
                  <span className="pulse-dot"></span>
                  <span>Slack Agent Builder Challenge</span>
                </div>
                <h1>The Intelligent <span className="text-gradient">Deployment Guardian</span></h1>
                <p className="subtitle">
                  Sentinel AI predicts release failures before they break production. By proactively auditing GitHub code, Jira tickets, Prometheus telemetry, and incidents, Sentinel ensures zero-downtime deploys.
                </p>
                <div className="hero-ctas">
                  <button onClick={() => navigateTo('console')} className="btn btn-primary btn-glow">
                    Launch Dashboard Console <i className="fa-solid fa-arrow-right"></i>
                  </button>
                  <button onClick={() => { navigateTo('console'); setIsDemo(false); setActiveTab('risk-analyzer'); }} className="btn btn-outline">
                    <i className="fa-brands fa-github"></i> Connect Repository
                  </button>
                </div>
              </div>

              <div className="hero-right">
                <div className="glass-card telemetry-preview">
                  <div className="card-header">
                    <div className="window-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <span className="title">sentinel-risk-analyzer.log</span>
                  </div>
                  <div className="code-log-box" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                    {landingLogs.map((log, i) => (
                      <div key={i} className={`log-line ${log.type}`}>
                        [{log.time.split(' ')[0]}] {log.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-container">
            <h2 className="section-title">Core <span className="text-gradient">Guardian Features</span></h2>
            <p className="section-subtitle">Preventing outages by proactively validating code and infrastructure before deployment.</p>
            
            <div className="features-grid">
              <div className="glass-card feature-card">
                <i className="fa-solid fa-gauge-high icon-gradient"></i>
                <h3>Risk Analyzer</h3>
                <p>Scans Git branches, commits, active telemetry loads, and open Jira bugs to compute a predictive failure score before code is pushed.</p>
              </div>
              <div className="glass-card feature-card">
                <i className="fa-solid fa-clock-rotate-left icon-gradient"></i>
                <h3>Incident Time Machine</h3>
                <p>Reconstructs step-by-step chronology logs of previous production outages to audit cascading failure triggers and avoid recurrence.</p>
              </div>
              <div className="glass-card feature-card">
                <i className="fa-solid fa-wand-magic-sparkles icon-gradient"></i>
                <h3>Canary Release Advisor</h3>
                <p>Generates optimal traffic splits (10% → 25% → 50% → 100%) and safety verification checks tailored to the active service health.</p>
              </div>
              <div className="glass-card feature-card">
                <i className="fa-solid fa-magnifying-glass-chart icon-gradient"></i>
                <h3>RCA Diagnostics</h3>
                <p>Correlates infrastructure anomalies in Prometheus logs with open code bugs using RAG search over incident runbooks.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="architecture" className="landing-section bg-alt">
          <div className="landing-container">
            <h2 className="section-title">How It <span className="text-gradient">Works</span></h2>
            <p className="section-subtitle">Behind the scenes of Sentinel's predictive decision-making engine.</p>
            
            <div className="working-flow">
              <div className="flow-step-card">
                <div className="step-badge">01</div>
                <h4>Context Fetching</h4>
                <p>Sentinel queries GitHub (recent commit diffs), Jira (active blocker tickets), and Prometheus (CPU/Memory metrics).</p>
              </div>
              <div className="flow-arrow"><i className="fa-solid fa-arrow-right"></i></div>
              <div className="flow-step-card">
                <div className="step-badge">02</div>
                <h4>RAG Runbook Search</h4>
                <p>The incident details are cross-referenced with your postmortem database (ChromaDB) to fetch similar failure templates.</p>
              </div>
              <div className="flow-arrow"><i className="fa-solid fa-arrow-right"></i></div>
              <div className="flow-step-card">
                <div className="step-badge">03</div>
                <h4>Gemini Guardrail Synthesis</h4>
                <p>The context payload is processed by the Gemini model queue, auto-rotating to prevent free-tier limits and fallback key blockers.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="main-footer">
          <p>© 2026 Sentinel AI. Built for the Slack Agent Builder Challenge.</p>
        </footer>
      </div>
    );
  }

  // Render Console Dashboard Page
  return (
    <div className="dark-theme">
      <main id="app-console" className="console-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        
        {/* Top Header Status Bar */}
        <header className="console-header">
          <div className="header-left">
            <div className="logo shrink-logo" onClick={() => navigateTo('landing')} style={{ cursor: 'pointer' }}>
              <i className="fa-solid fa-shield-halved text-gradient"></i>
              <span>SENTINEL <span className="accent-text">AI</span></span>
            </div>
            
            {/* Mode Slide Toggle Switch */}
            <div className="mode-selector">
              <span className="mode-label">Mode:</span>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  id="mode-toggle"
                  checked={isDemo}
                  onChange={(e) => {
                    setIsDemo(e.target.checked);
                    if (e.target.checked) {
                      setGithubConnected(false);
                      setGithubMsg(null);
                    }
                  }}
                />
                <label htmlFor="mode-toggle">
                  <span className="toggle-btn-left">Live</span>
                  <span className="toggle-btn-right">Demo</span>
                </label>
              </div>
            </div>
          </div>

          <div className="header-right">
            <div className="status-indicators">
              <div className="status-indicator" title="GitHub Connection Status" id="github-connection-status">
                {isDemo ? (
                  <>
                    <i className="fa-brands fa-github text-green"></i> <span>Git Connected (Demo)</span>
                  </>
                ) : githubConnected ? (
                  <>
                    <i className="fa-brands fa-github text-green"></i> <span>Connected: {githubRepo}</span>
                  </>
                ) : (
                  <>
                    <i className="fa-brands fa-github text-yellow"></i> <span>Git Disconnected</span>
                  </>
                )}
              </div>
              <div className="status-indicator" title="Prometheus Metrics Monitor">
                <i className="fa-solid fa-chart-line text-green"></i> <span>Prometheus Active</span>
              </div>
              <div className="status-indicator" title="Gemini LLM Connectivity">
                <i className="fa-solid fa-brain text-gradient"></i> <span id="model-status-indicator">Gemini: {lastModel !== 'N/A' ? lastModel : 'Active'}</span>
              </div>
            </div>
            <button onClick={() => navigateTo('landing')} className="btn btn-icon-only" title="Return to Home">
              <i className="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </header>

        <div className="console-body" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Sidebar menu */}
          <aside className="console-sidebar">
            <ul className="sidebar-menu">
              <li className={activeTab === 'risk-analyzer' ? 'active' : ''} onClick={() => setActiveTab('risk-analyzer')}>
                <i className="fa-solid fa-gauge-high"></i> <span>Risk Analyzer</span>
              </li>
              <li className={activeTab === 'time-machine' ? 'active' : ''} onClick={() => setActiveTab('time-machine')}>
                <i className="fa-solid fa-clock-rotate-left"></i> <span>Time Machine</span>
              </li>
              <li className={activeTab === 'release-advisor' ? 'active' : ''} onClick={() => setActiveTab('release-advisor')}>
                <i className="fa-solid fa-wand-magic-sparkles"></i> <span>Release Advisor</span>
              </li>
              <li className={activeTab === 'root-cause' ? 'active' : ''} onClick={() => setActiveTab('root-cause')}>
                <i className="fa-solid fa-magnifying-glass-chart"></i> <span>Root Cause Analysis</span>
              </li>
              <li className={activeTab === 'slack-simulator' ? 'active' : ''} onClick={() => setActiveTab('slack-simulator')}>
                <i className="fa-brands fa-slack"></i> <span>Slack Simulator</span>
              </li>
              <li className={activeTab === 'model-config' ? 'active' : ''} onClick={() => setActiveTab('model-config')}>
                <i className="fa-solid fa-gear"></i> <span>Settings & Models</span>
              </li>
            </ul>

            <div className="sidebar-footer">
              <div className="active-profile">
                <div className="profile-info">
                  <span className="name">DevOps Operator</span>
                  <span className="role">Admin Console</span>
                </div>
                <i className="fa-solid fa-circle-user" style={{ fontSize: '1.8rem', color: 'var(--text-muted)' }}></i>
              </div>
            </div>
          </aside>

          {/* Core Content Box */}
          <section className="console-content" style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
            
            {/* Tab 1: Risk Analyzer */}
            {activeTab === 'risk-analyzer' && (
              <div className="tab-pane active">
                <div className="pane-grid-2">
                  <div className="glass-card fill-grid-cell">
                    <div className="card-header">
                      <h3><i className="fa-solid fa-gauge-high"></i> Release Pre-Deployment Analyzer</h3>
                    </div>
                    <div className="card-body">
                      
                      {/* Live Mode Repo Input card */}
                      {!isDemo && (
                        <div className="glass-card bg-glass-dark" style={{ padding: '20px', marginBottom: '20px' }}>
                          <h4><i className="fa-brands fa-github text-gradient"></i> Connect GitHub Repo for Live Mode</h4>
                          <p className="description-para" style={{ fontSize: '0.8rem', marginBottom: '12px' }}>
                            You must connect a public repository to fetch code changes and run live audits.
                          </p>
                          
                          {githubConnected ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div className="badge badge-green" style={{ display: 'inline-block', padding: '6px 12px', width: 'fit-content' }}>
                                <i className="fa-solid fa-circle-check"></i> Connected: {githubRepo}
                              </div>
                              <button type="button" onClick={handleDisconnectGithub} className="btn btn-secondary btn-full" style={{ padding: '6px 12px' }}>
                                Disconnect Repository
                              </button>
                            </div>
                          ) : (
                            <form onSubmit={handleConnectGithub}>
                              <div className="form-group" style={{ marginBottom: '12px' }}>
                                <input
                                  type="text"
                                  placeholder="e.g. owner/repository"
                                  value={githubInput}
                                  onChange={(e) => setGithubInput(e.target.value)}
                                  disabled={isGithubVerifying}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isGithubVerifying}>
                                  {isGithubVerifying ? 'Locating...' : 'Connect Repo'}
                                </button>
                                <button type="button" onClick={handleForceConnect} className="btn btn-secondary">
                                  Force Connect
                                </button>
                              </div>
                              {githubMsg && (
                                <div style={{ fontSize: '0.8rem', marginTop: '8px', color: githubMsg.type === 'success' ? 'var(--color-green)' : 'var(--color-red)' }}>
                                  {githubMsg.text}
                                </div>
                              )}
                            </form>
                          )}
                        </div>
                      )}

                      <form onSubmit={handleAnalyzeRelease} className="dashboard-form">
                        <div className="form-group">
                          <label>Release Version Tag / Commit Hash</label>
                          <input
                            type="text"
                            value={releaseVersion}
                            onChange={(e) => setReleaseVersion(e.target.value)}
                            placeholder="e.g., v4.2"
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Target Microservice</label>
                          <select value={targetService} onChange={(e) => setTargetService(e.target.value)}>
                            <option value="checkout-service">checkout-service</option>
                            <option value="payment-service">payment-service</option>
                            <option value="auth-service">auth-service</option>
                          </select>
                        </div>
                        <button type="submit" className="btn btn-primary btn-full" disabled={isAnalyzing}>
                          {isAnalyzing ? 'Scanning & Simulating...' : 'Run Pre-Deployment Audit'}
                        </button>
                      </form>

                      <div className="console-divider"></div>

                      <div className="terminal-logs-wrapper">
                        <span className="log-title">Telemetry Pipelines Log</span>
                        <div className="terminal-logs" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {analyzerLogs.map((log, index) => (
                            <div key={index} className="log-line info">{log}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audit details side */}
                  <div className="glass-card fill-grid-cell result-card">
                    <div className="card-header">
                      <h3>Risk Audit Results</h3>
                      <span className={riskBadge.className}>{riskBadge.text}</span>
                    </div>
                    <div className="card-body scroll-body" style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="gauge-center-wrapper">
                        <div className="risk-gauge-container">
                          <svg className="gauge-svg" viewBox="0 0 120 120">
                            <circle className="gauge-bg" cx="60" cy="60" r="50"></circle>
                            <circle
                              className="gauge-value"
                              cx="60"
                              cy="60"
                              r="50"
                              stroke={strokeColor}
                              strokeDasharray="314.16"
                              strokeDashoffset={strokeDashoffset}
                            ></circle>
                          </svg>
                          <div className="gauge-score-value">
                            <span>{riskScore !== null ? riskScore : '--'}</span>
                            <span className="pct">%</span>
                          </div>
                        </div>
                        <div className="gauge-labels">
                          <span className="label-name">Risk Coefficient</span>
                          <span className="label-val text-gradient">{recommendation}</span>
                        </div>
                      </div>

                      <div className="score-breakdown-sliders" style={{ marginBottom: '20px' }}>
                        <div className="slider-item">
                          <span>Memory & CPU Leak:</span>
                          <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${(breakdown.memory / 25) * 100}%` }}></div>
                          </div>
                        </div>
                        <div className="slider-item">
                          <span>Jira Open Bugs:</span>
                          <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${(breakdown.bugs / 25) * 100}%` }}></div>
                          </div>
                        </div>
                        <div className="slider-item">
                          <span>Prometheus Latency:</span>
                          <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${(breakdown.latency / 25) * 100}%` }}></div>
                          </div>
                        </div>
                        <div className="slider-item">
                          <span>Historical Similarity:</span>
                          <div className="progress-bar-container">
                            <div className="progress-bar-fill" style={{ width: `${(breakdown.history / 25) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>

                      <div className="ai-report-markdown">
                        {riskReport ? (
                          renderMarkdown(riskReport)
                        ) : (
                          <div className="empty-state">
                            <i className="fa-solid fa-brain-circuit"></i>
                            <p>Enter release and run audit to construct Gemini predictive outage report.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Incident Time Machine */}
            {activeTab === 'time-machine' && (
              <div className="tab-pane active">
                <div className="pane-grid-2">
                  <div className="glass-card fill-grid-cell">
                    <div className="card-header">
                      <h3><i className="fa-solid fa-clock-rotate-left"></i> Incident Time Machine</h3>
                    </div>
                    <div className="card-body">
                      <p className="description-para">
                        Reconstruct timeline steps, triggers, and cascading errors for historical outages to understand and block repetitions.
                      </p>
                      
                      <form onSubmit={handleReconstructTimeline} className="dashboard-form">
                        <div className="form-group">
                          <label>Investigate Outage Query</label>
                          <input
                            type="text"
                            value={outageQuery}
                            onChange={(e) => setOutageQuery(e.target.value)}
                            placeholder="e.g., checkout memory leak, payment stream error"
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary btn-full" disabled={isReconstructing}>
                          {isReconstructing ? 'Reconstructing...' : 'Reconstruct Incident Timeline'}
                        </button>
                      </form>

                      <div className="timeline-visual-wrapper" style={{ marginTop: '24px' }}>
                        <h4>Incident Chronology Timeline</h4>
                        <ul className="timeline-stepper">
                          {timelineSteps.length > 0 ? (
                            timelineSteps.map((step, idx) => (
                              <li key={idx} className={`timeline-step ${step.type}`}>
                                <div className="step-bullet"></div>
                                <div className="step-content">
                                  {step.content.includes(' - ') ? (
                                    <>
                                      <strong>{step.content.split(' - ')[0]}</strong> {step.content.split(' - ')[1]}
                                    </>
                                  ) : (
                                    step.content
                                  )}
                                </div>
                              </li>
                            ))
                          ) : (
                            <li className="timeline-step empty-timeline-step">
                              <div className="step-bullet"></div>
                              <div className="step-content">Enter a query above to load incident timeline.</div>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card fill-grid-cell">
                    <div className="card-header">
                      <h3>Incident Autopsy & RCA report</h3>
                    </div>
                    <div className="card-body scroll-body">
                      {outageAutopsy ? (
                        renderMarkdown(outageAutopsy)
                      ) : (
                        <div className="empty-state">
                          <i className="fa-solid fa-clock"></i>
                          <p>Reconstruct an incident to load Gemini outage diagnosis.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Release Advisor */}
            {activeTab === 'release-advisor' && (
              <div className="tab-pane active">
                <div className="pane-grid-2">
                  <div className="glass-card fill-grid-cell">
                    <div className="card-header">
                      <h3><i className="fa-solid fa-wand-magic-sparkles"></i> Intelligent Release Advisor</h3>
                    </div>
                    <div className="card-body">
                      <p className="description-para">
                        Get optimal deployment strategies based on active infrastructure cluster loads and open code vulnerabilities.
                      </p>
                      
                      <form onSubmit={handleGetReleaseAdvice} className="dashboard-form">
                        <div className="form-group">
                          <label>Select microservice</label>
                          <select value={adviceService} onChange={(e) => setAdviceService(e.target.value)}>
                            <option value="checkout-service">checkout-service</option>
                            <option value="payment-service">payment-service</option>
                            <option value="auth-service">auth-service</option>
                          </select>
                        </div>
                        <button type="submit" className="btn btn-primary btn-full" disabled={isFetchingAdvice}>
                          {isFetchingAdvice ? 'Consulting...' : 'Generate Release Strategy'}
                        </button>
                      </form>

                      <div className="canary-viz-container" style={{ marginTop: '24px' }}>
                        <h4>Recommended Canary Schedule</h4>
                        <div className="traffic-split-stages">
                          <div className="split-stage">
                            <div className="split-circle">10%</div>
                            <span>Stage 1</span>
                          </div>
                          <div className="split-arrow"><i className="fa-solid fa-arrow-right-long"></i></div>
                          <div className="split-stage">
                            <div className="split-circle">25%</div>
                            <span>Stage 2</span>
                          </div>
                          <div className="split-arrow"><i className="fa-solid fa-arrow-right-long"></i></div>
                          <div className="split-stage">
                            <div className="split-circle">50%</div>
                            <span>Stage 3</span>
                          </div>
                          <div className="split-arrow"><i className="fa-solid fa-arrow-right-long"></i></div>
                          <div className="split-stage highlight">
                            <div className="split-circle">100%</div>
                            <span>Stage 4</span>
                          </div>
                        </div>
                        <p className="canary-caption" style={{ marginTop: '16px' }}>
                          <i className="fa-solid fa-circle-info"></i> Estimated Risk Mitigation with Canary strategy: <strong>68% risk reduction</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card fill-grid-cell">
                    <div className="card-header">
                      <h3>AI Recommendation Strategy</h3>
                    </div>
                    <div className="card-body scroll-body">
                      {adviceReport ? (
                        renderMarkdown(adviceReport)
                      ) : (
                        <div className="empty-state">
                          <i className="fa-solid fa-scroll"></i>
                          <p>Fetch advice to generate personalized deployment plans.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Root Cause Analysis */}
            {activeTab === 'root-cause' && (
              <div className="tab-pane active">
                <div className="pane-grid-2">
                  <div className="glass-card fill-grid-cell">
                    <div className="card-header">
                      <h3><i className="fa-solid fa-magnifying-glass-chart"></i> Root Cause Anomaly Scanner</h3>
                    </div>
                    <div className="card-body">
                      <form onSubmit={handleRcaScan} className="dashboard-form">
                        <div className="form-group">
                          <label>Microservice to Investigate</label>
                          <select value={rcaService} onChange={(e) => setRcaService(e.target.value)}>
                            <option value="checkout-service">checkout-service</option>
                            <option value="payment-service">payment-service</option>
                            <option value="auth-service">auth-service</option>
                          </select>
                        </div>
                        <button type="submit" className="btn btn-primary btn-full" disabled={isScanningRca}>
                          {isScanningRca ? 'Investigating...' : 'Scan Metrics & Investigate'}
                        </button>
                      </form>

                      <div className="console-divider"></div>

                      <h4>Active Telemetry Gauges</h4>
                      <div className="telemetry-gauges-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                        <div className={`telemetry-gauge-card bg-glass-dark ${rcaMetrics ? (rcaMetrics.status === 'critical' ? 'badge-red' : rcaMetrics.status === 'warning' ? 'badge-yellow' : 'badge-green') : ''}`}>
                          <div className="gauge-title">CPU</div>
                          <div className="gauge-value font-mono">{rcaMetrics ? rcaMetrics.cpuUsage : '--'}</div>
                        </div>
                        <div className={`telemetry-gauge-card bg-glass-dark ${rcaMetrics ? (rcaMetrics.status === 'critical' ? 'badge-red' : rcaMetrics.status === 'warning' ? 'badge-yellow' : 'badge-green') : ''}`}>
                          <div className="gauge-title">Memory</div>
                          <div className="gauge-value font-mono">{rcaMetrics ? rcaMetrics.memoryUsage : '--'}</div>
                        </div>
                        <div className={`telemetry-gauge-card bg-glass-dark ${rcaMetrics ? (rcaMetrics.status === 'critical' ? 'badge-red' : rcaMetrics.status === 'warning' ? 'badge-yellow' : 'badge-green') : ''}`}>
                          <div className="gauge-title">Latency</div>
                          <div className="gauge-value font-mono">{rcaMetrics ? rcaMetrics.latency : '--'}</div>
                        </div>
                        <div className={`telemetry-gauge-card bg-glass-dark ${rcaMetrics ? (rcaMetrics.status === 'critical' ? 'badge-red' : rcaMetrics.status === 'warning' ? 'badge-yellow' : 'badge-green') : ''}`}>
                          <div className="gauge-title">Error Rate</div>
                          <div className="gauge-value font-mono">{rcaMetrics ? rcaMetrics.errorRate : '--'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card fill-grid-cell">
                    <div className="card-header">
                      <h3>Anomaly Investigation Report</h3>
                    </div>
                    <div className="card-body scroll-body">
                      {rcaReport ? (
                        renderMarkdown(rcaReport)
                      ) : (
                        <div className="empty-state">
                          <i className="fa-solid fa-dna"></i>
                          <p>Scan metrics to analyze core triggers and dependencies.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Slack Command Simulator */}
            {activeTab === 'slack-simulator' && (
              <div className="tab-pane active">
                <div className="slack-simulator-wrapper" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)' }}>
                  <div className="glass-card slack-header-card" style={{ padding: '16px', marginBottom: '16px' }}>
                    <h3><i className="fa-brands fa-slack text-gradient"></i> Slack Real-Time Agent Simulator</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Type Sentinel Slash commands below to preview their interactive response frames as structured Slack Block Kit components.
                    </p>
                  </div>

                  <div className="slack-chat-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0f1423', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div className="slack-messages-feed" style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {slackMessages.map((msg) => {
                        // Special block renderer for Slack Block Kit components
                        const hasBlocks = msg.blocks && msg.blocks.length > 0;
                        let attachmentHtml: React.ReactNode = null;
                        
                        if (hasBlocks) {
                          const sectionBlock = msg.blocks?.find(b => b.type === 'section' && b.fields);
                          const riskScoreField = sectionBlock?.fields?.find((f: any) => f.text.includes('Risk Score'));
                          let riskClass = '';
                          if (riskScoreField) {
                            const scoreMatch = riskScoreField.text.match(/\d+/);
                            if (scoreMatch && parseInt(scoreMatch[0]) > 70) {
                              riskClass = 'high-risk';
                            } else if (scoreMatch && parseInt(scoreMatch[0]) > 40) {
                              riskClass = 'medium-risk';
                            } else {
                              riskClass = 'low-risk';
                            }
                          }

                          attachmentHtml = (
                            <div className={`slack-attachment-card ${riskClass}`} style={{ marginTop: '8px', borderLeft: '4px solid #ddd', paddingLeft: '12px' }}>
                              {msg.blocks?.map((block, bIdx) => {
                                if (block.type === 'section') {
                                  if (block.fields) {
                                    return (
                                      <div key={bIdx} className="slack-attachment-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '8px 0' }}>
                                        {block.fields.map((f: any, fIdx: number) => (
                                          <div key={fIdx} className="slack-attachment-field" style={{ fontSize: '0.85rem' }}>
                                            {f.text.replace(/\*/g, '')}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  } else if (block.text) {
                                    const isTitle = block.text.text.includes('Release Analysis') ||
                                                    block.text.text.includes('Incident Time Machine') ||
                                                    block.text.text.includes('Advisor') ||
                                                    block.text.text.includes('Root Cause');
                                    return (
                                      <div key={bIdx} className={isTitle ? 'slack-attachment-title' : 'message-text'} style={{ fontWeight: isTitle ? 'bold' : 'normal', margin: '4px 0', fontSize: '0.9rem' }}>
                                        {block.text.text.replace(/\*/g, '')}
                                      </div>
                                    );
                                  }
                                } else if (block.type === 'actions') {
                                  return (
                                    <div key={bIdx} className="slack-actions" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                      {block.elements.map((el: any, elIdx: number) => {
                                        const isDanger = el.style === 'danger';
                                        const isPrimary = el.style === 'primary';
                                        const btnStyle = isDanger 
                                          ? { background: 'var(--color-red)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }
                                          : isPrimary
                                          ? { background: 'var(--color-green)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }
                                          : { background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' };
                                        return (
                                          <button key={elIdx} className="slack-btn" style={btnStyle}>
                                            {el.text.text}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          );
                        }

                        return (
                          <div key={msg.id} className="slack-message" style={{ display: 'flex', gap: '12px' }}>
                            <div className="avatar" style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '4px',
                              background: msg.avatarBg || '#c084fc',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              flexShrink: 0
                            }}>
                              <i className={msg.avatarIcon || (msg.sender === 'user' ? 'fa-solid fa-circle-user' : 'fa-solid fa-shield-halved')}></i>
                            </div>
                            <div className="message-content" style={{ display: 'flex', flexDirection: 'column' }}>
                              <div className="sender-name" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                                {msg.name} {msg.sender === 'bot' && <span className="app-tag" style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '3px', fontSize: '0.7rem', marginLeft: '4px' }}>APP</span>}
                                <span className="timestamp" style={{ fontWeight: 'normal', color: 'var(--text-dark)', fontSize: '0.75rem', marginLeft: '8px' }}>{msg.timestamp}</span>
                              </div>
                              <div className="message-text" style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                                {msg.sender === 'user' ? <code>{msg.text}</code> : msg.text}
                              </div>
                              {attachmentHtml}
                            </div>
                          </div>
                        );
                      })}
                      {isSlackResponding && (
                        <div className="slack-message" style={{ display: 'flex', gap: '12px', opacity: 0.7 }}>
                          <div className="avatar" style={{ width: '36px', height: '36px', borderRadius: '4px', background: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            <i className="fa-solid fa-shield-halved"></i>
                          </div>
                          <div className="message-content">
                            <div className="sender-name" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Sentinel AI <span className="app-tag">APP</span></div>
                            <div className="message-text" style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                              <i className="fa-solid fa-spinner fa-spin"></i> Typing response...
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={slackFeedEndRef} />
                    </div>

                    <div className="slack-prompt-line" style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--border-color)' }}>
                      <div className="quick-commands-list" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <button onClick={() => setSlackInput('/analyze-release v4.2')} className="badge badge-btn">/analyze-release v4.2</button>
                        <button onClick={() => setSlackInput('/explain-outage Friday')} className="badge badge-btn">/explain-outage Friday</button>
                        <button onClick={() => setSlackInput('/deployment-advice')} className="badge badge-btn">/deployment-advice</button>
                        <button onClick={() => setSlackInput('/investigate checkout-service')} className="badge badge-btn">/investigate checkout-service</button>
                      </div>
                      <form onSubmit={(e) => { e.preventDefault(); executeSlackCommand(slackInput); }} style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="text"
                          value={slackInput}
                          onChange={(e) => setSlackInput(e.target.value)}
                          placeholder="Type slash command e.g., /analyze-release v4.2..."
                          autoComplete="off"
                          style={{ flex: 1 }}
                        />
                        <button type="submit" className="btn btn-primary btn-round" style={{ width: '40px', height: '40px', padding: 0 }}>
                          <i className="fa-solid fa-paper-plane"></i>
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 6: Settings & Models */}
            {activeTab === 'model-config' && (
              <div className="tab-pane active">
                <div className="pane-grid-2">
                  <div className="glass-card fill-grid-cell">
                    <div className="card-header">
                      <h3><i className="fa-solid fa-gears"></i> Sentinel AI Control Board</h3>
                    </div>
                    <div className="card-body">
                      <div className="config-section">
                        <h4>Gemini API Configuration</h4>
                        <form onSubmit={(e) => e.preventDefault()}>
                          <div className="form-group" style={{ marginTop: '12px' }}>
                            <label>Your Gemini API Key</label>
                            <input
                              type="password"
                              value={userApiKey}
                              onChange={(e) => setUserApiKey(e.target.value)}
                              placeholder="Enter key (Optionally leaves blank to trigger Fallback API Key)"
                              autoComplete="current-password"
                            />
                            <small className="helper-text" style={{ display: 'block', marginTop: '6px' }}>
                              <i className="fa-solid fa-circle-exclamation text-yellow"></i> Leave blank to use our integrated Hackathon Fallback API Key.
                            </small>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="ai-studio-link" rel="noreferrer" style={{ display: 'block', marginTop: '8px', color: '#c084fc', textDecoration: 'none' }}>
                              <i className="fa-solid fa-arrow-up-right-from-square"></i> Get Gemini API Key on Google AI Studio
                            </a>
                          </div>
                        </form>
                      </div>

                      <div className="console-divider"></div>

                      <div className="config-section">
                        <h4>LLM Model Switching Queue</h4>
                        <p className="description-para">
                          To fully leverage the free tiers of Gemini and avoid rate limitation blockers, Sentinel AI automatically switches downstream LLM pipelines in the following order:
                        </p>
                        
                        <div className="model-queue-viz" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                          <div className="model-item active-model" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', borderLeft: '3px solid #a855f7' }}>
                            <div className="model-num" style={{ fontWeight: 'bold' }}>1</div>
                            <div className="model-name">gemini-2.5-flash <span className="badge-mini" style={{ fontSize: '0.7rem', padding: '2px 4px', background: '#a855f7', color: 'white', borderRadius: '3px' }}>Primary</span></div>
                          </div>
                          <div className="model-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            <div className="model-num">2</div>
                            <div className="model-name" style={{ color: 'var(--text-muted)' }}>gemini-1.5-flash <span className="badge-mini" style={{ fontSize: '0.7rem', padding: '2px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>Secondary Fallback</span></div>
                          </div>
                          <div className="model-item" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            <div className="model-num">3</div>
                            <div className="model-name" style={{ color: 'var(--text-muted)' }}>gemini-1.5-pro <span className="badge-mini" style={{ fontSize: '0.7rem', padding: '2px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>Tertiary Fallback</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card fill-grid-cell">
                    <div className="card-header">
                      <h3>Fallback API Credentials</h3>
                    </div>
                    <div className="card-body">
                      <div className="credentials-badge bg-glass-dark" style={{ padding: '16px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                        <div className="badge-title" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                          <i className="fa-solid fa-key text-gradient"></i> Hardcoded Fallback API Token
                        </div>
                        <div className="badge-token font-mono" style={{ background: '#02050b', padding: '8px 12px', borderRadius: '4px', fontSize: '0.85rem', wordBreak: 'break-all', marginBottom: '8px' }}>
                          {fallbackKey}
                        </div>
                        <p className="badge-note" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          If your primary key fails or rate-limits, this token is injected automatically into requests to ensure uninterrupted DevOps deployment analysis.
                        </p>
                      </div>

                      <div className="console-divider"></div>

                      <h4>Active AI Pipeline Session Diagnostics</h4>
                      <div className="diagnostic-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                        <div className="diag-item" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                          <span className="lbl" style={{ color: 'var(--text-muted)' }}>Last Model Selected:</span>
                          <span className="val font-mono">{lastModel}</span>
                        </div>
                        <div className="diag-item" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                          <span className="lbl" style={{ color: 'var(--text-muted)' }}>Credentials Target:</span>
                          <span className="val font-mono">{lastKeyUsed}</span>
                        </div>
                        <div className="diag-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px' }}>
                          <span className="lbl" style={{ color: 'var(--text-muted)' }}>Connectivity Status:</span>
                          <span className="val"><span className="badge badge-green">Ready</span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </section>
        </div>

        <footer className="main-footer" style={{ flexShrink: 0 }}>
          <p>© 2026 Sentinel AI. Built for the Slack Agent Builder Challenge.</p>
        </footer>
      </main>
    </div>
  );
}
