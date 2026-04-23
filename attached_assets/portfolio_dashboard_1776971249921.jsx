import { useState, useMemo, useCallback, useEffect } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

// ─── Smartsheet Links (static - workspace structure doesn't change) ───
const SMARTSHEET_LINKS = {
  "P-0249": { dashboard: "https://app.smartsheet.com/dashboards/pHp6Hq44Q699mJ29FWJ632x82VWvgRxQxfh378W1", projectPlan: "https://app.smartsheet.com/sheets/j8WVFpvhXCRCmMRhx7Hj8MVwj43Fwwx8h9xcXqM1", budget: "https://app.smartsheet.com/sheets/mRhW3rh82FFJ3pMH5ccmjCW2FVjhPQVh2mfFH7C1", status: "https://app.smartsheet.com/sheets/pcrmfh7p4VmG5jpxhFqMjCRQwPq7GrFQR4gX2HJ1", roster: "https://app.smartsheet.com/sheets/gQ78x84PhgwfRgQwG95qq8vrgg72vr43hvWH9XG1" },
  "P-0036": { dashboard: "https://app.smartsheet.com/dashboards/VJw55fPQwWq2mp4X4WRgF5WVGHCWhCX5CQmW2PC1", projectPlan: "https://app.smartsheet.com/sheets/J7hGHhVJwhr6M2Q6J5mf7FV9hJ42gpqJPF8jpp51", budget: "https://app.smartsheet.com/sheets/gFqGRxWhcRjqHRhHRCJWmH6gMhWPGC756VhJC721", status: "https://app.smartsheet.com/sheets/4xrFQ689r8XvJ8jhC3WP7w3jj7Xv4Wgmq2J3jFG1", roster: "https://app.smartsheet.com/sheets/qPJGgV5jww98PJwPFCx2wRGPp8XjXfjh9MrGQjh1" },
  "P-0244": { dashboard: "https://app.smartsheet.com/dashboards/CX68xf4jh4QRQ9rgXhwrVhfRjXjwQ5qwF2rm48v1", projectPlan: "https://app.smartsheet.com/sheets/x6w3Vh77gFH4VxrXmR3JCHhW2G4fwPj2gvMQQ4h1", budget: "https://app.smartsheet.com/sheets/p7222CmFpFQ48FRJXvCj4c46PHf4R9qMv926pgr1", status: "https://app.smartsheet.com/sheets/rV3wPC9QrFHR7f8w6PRQ9gxxG9j7WvQ4Fgx8mfx1", roster: "https://app.smartsheet.com/sheets/CCpQ77vCG4h4CPGrqmwpHPmHGjp3MvQVXRff6pR1" },
  "P-0224": { dashboard: "https://app.smartsheet.com/dashboards/CHR5pXCQ38jv5W6P3x5MR9CfGQh79RXFq9mVFHJ1", projectPlan: "https://app.smartsheet.com/sheets/cXXGgg7mVQqXgx5hMqJ58Xc2pfWwjWWc9fJcvc51", budget: "https://app.smartsheet.com/sheets/mrmHHMc9fRQmx6W2XpP3JfWc5r57QhxFGpmRjJ91", status: "https://app.smartsheet.com/sheets/8JV3JCXr89mQfG9VhV9J2jFx9fx6X9HgmqCRRh31", roster: "https://app.smartsheet.com/sheets/7q37F993JfpPJgMgmf2Fvg64HRxmM9pm36q5q7r1" },
};

const PARENT_MAP = { "Parent 1": "Finance", "Parent 2": "IT", "Parent 3": "HR", "Parent 4": "Operations", "Parent 5": "Sales" };

// ─── Helpers ───
const fmt = (n) => "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtK = (n) => "$" + (Math.abs(n) / 1000).toFixed(0) + "K";
const pct = (n) => Math.round(n * 100) + "%";

const COLORS = {
  bg: "#f5f2ed", card: "#ffffff", cardHover: "#faf8f5", border: "#e2ddd5", borderLight: "#d4cec4",
  text: "#2c2825", textMuted: "#6b635a", textDim: "#9a938a",
  accent: "#7c6a52", accentGlow: "rgba(124,106,82,0.1)",
  green: "#5f8a5e", greenBg: "rgba(95,138,94,0.1)",
  yellow: "#b08d4a", yellowBg: "rgba(176,141,74,0.1)",
  red: "#b05a4a", redBg: "rgba(176,90,74,0.1)",
  purple: "#7a6b8a", purpleBg: "rgba(122,107,138,0.1)",
  cyan: "#5a7f8a", cyanBg: "rgba(90,127,138,0.1)",
  orange: "#b87a4a",
};
const PIE_STATUS = ["#7c6a52", "#5f8a5e", "#b08d4a", "#b05a4a"];
const PIE_PRIORITY = ["#b05a4a", "#b08d4a", "#5f8a5e"];

const healthIcon = (h) => h === "Up" ? "▲" : h === "Down" ? "▼" : "●";
const healthColor = (h) => h === "Up" ? COLORS.green : h === "Down" ? COLORS.red : COLORS.yellow;
const priorityColor = (p) => p === "High" ? COLORS.red : p === "Medium" ? COLORS.yellow : COLORS.textDim;
const statusColor = (s) => s === "Complete" ? COLORS.green : s === "In Progress" ? COLORS.accent : COLORS.textMuted;
const varianceColor = (v) => v < -0.1 ? COLORS.red : v < 0 ? COLORS.yellow : COLORS.green;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: COLORS.text, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
          <span style={{ color: COLORS.textMuted }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{typeof p.value === "number" && p.value > 100 ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const PieLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill={COLORS.textMuted} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11}>{name} ({Math.round(percent * 100)}%)</text>;
};

// ─── Transform raw row into project object ───
function rowToProject(cells) {
  const num = (key) => { const v = cells[key]; if (v === undefined || v === null || v === "") return 0; return parseFloat(String(v).replace(/[^0-9.\-]/g, "")) || 0; };
  const str = (key) => String(cells[key] || "").trim();
  const parent = str("Parent");
  return {
    code: str("Project Code"), name: str("Project Name"), status: str("Status"), health: str("Health"),
    priority: str("Priority"), sponsor: str("Sponsor"), lead: str("Project Lead"), goal: str("Strategic Goal"),
    phase: str("Phase"), parent, parentLabel: PARENT_MAP[parent] || str("Phase") || parent,
    type: str("Project Type"), startDate: str("Planned Start Date"), endDate: str("Planned End Date"),
    pctComplete: num("% Complete"), openItems: num("Open Items"), closedItems: num("Closed Items"),
    highRisks: num("High Priority Risks"), highIssues: num("High Priority Issues"),
    proposedBudget: num("Proposed Budget"), budget: num("Budget"), actual: num("Actual"),
    difference: num("Difference"), variance: num("Variance"),
    capexBudget: num("CAPEX Budget"), capexActual: num("CAPEX Actual"),
    opexBudget: num("OPEX Budget"), opexActual: num("OPEX Actual"),
  };
}

// ─── Live data fetcher via Claude API + Smartsheet MCP ───
async function fetchSmartsheetData() {
  const SHEET_ID = 2994894059556740;
  const COLUMNS = [
    "Project Code", "Project Name", "Status", "Health", "Priority", "Phase",
    "Parent", "Project Type", "Strategic Goal", "Project Lead", "Sponsor",
    "Planned Start Date", "Planned End Date", "% Complete", "Open Items",
    "Closed Items", "High Priority Risks", "High Priority Issues",
    "Proposed Budget", "Budget", "Actual", "Difference", "Variance",
    "CAPEX Budget", "CAPEX Actual", "OPEX Budget", "OPEX Actual",
    "% Spent", "% Remaining", "% Over"
  ];

  const prompt = `Use the get_sheet_summary tool to retrieve data from Smartsheet sheet_id ${SHEET_ID} with these columns: ${JSON.stringify(COLUMNS)}.

After retrieving the data, respond ONLY with a valid JSON array of objects where each object represents one row, using the column names as keys and their cell values (as strings or numbers). No markdown, no explanation, no backticks — just the raw JSON array. Example format:
[{"Project Code":"P-0128","Project Name":"Example","Status":"In Progress",...},...]`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
      mcp_servers: [{ type: "url", url: "https://mcp.smartsheet.com", name: "smartsheet" }],
    }),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();

  // Collect all content
  const textParts = [];
  const toolResultParts = [];
  for (const block of (data.content || [])) {
    if (block.type === "text") textParts.push(block.text);
    if (block.type === "mcp_tool_result" && block.content?.[0]?.text) toolResultParts.push(block.content[0].text);
  }

  const allText = textParts.join("\n");
  const allToolResults = toolResultParts.join("\n");

  // Strategy 1: Parse JSON array from Claude's text response
  const jsonMatch = allText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((row) => rowToProject(row)).filter((p) => p.code && p.name);
      }
    } catch (e) { console.warn("JSON parse from text failed:", e); }
  }

  // Strategy 2: Parse from MCP tool result (structured text)
  if (allToolResults) {
    // Try JSON parse first
    try {
      const parsed = JSON.parse(allToolResults);
      const rows = parsed.rows || parsed.data?.rows || (Array.isArray(parsed) ? parsed : []);
      if (rows.length > 0) {
        return rows.map((r) => {
          if (r.cells && typeof r.cells === "object" && !Array.isArray(r.cells)) return rowToProject(r.cells);
          if (r["Project Code"]) return rowToProject(r);
          return null;
        }).filter(Boolean).filter((p) => p.code && p.name);
      }
    } catch { /* continue to text parsing */ }

    // Parse structured text format from Smartsheet MCP
    const projects = [];
    let currentCells = {};
    const lines = allToolResults.split("\n");
    for (const line of lines) {
      if (line.includes("row_id:") || line.match(/^\s*-\s*row_id/)) {
        if (currentCells["Project Code"]) { projects.push(rowToProject(currentCells)); }
        currentCells = {};
      }
      const tabMatch = line.match(/^\s+(.+?)\t(.+?)\t\w+/);
      if (tabMatch) { currentCells[tabMatch[1].trim()] = tabMatch[2].trim().replace(/^"|"$/g, ""); }
      const colonMatch = line.match(/^\s+([\w\s%]+?):\s+(.+)/);
      if (colonMatch && !line.includes("row_id")) { currentCells[colonMatch[1].trim()] = colonMatch[2].trim().replace(/^"|"$/g, ""); }
    }
    if (currentCells["Project Code"]) projects.push(rowToProject(currentCells));
    if (projects.length > 0) return projects.filter((p) => p.code && p.name);
  }

  throw new Error("Could not parse project data from Smartsheet. Please try refreshing.");
}


// ═══════════════════════════════════════════════════
// ─── Main Dashboard Component ───
// ═══════════════════════════════════════════════════
export default function PortfolioDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadPhase, setLoadPhase] = useState("Connecting to Smartsheet...");

  const [filters, setFilters] = useState({});
  const [expandedFilter, setExpandedFilter] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [view, setView] = useState("overview");
  const [sortCol, setSortCol] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);
      setLoadPhase("Connecting to Smartsheet...");
      const t1 = setTimeout(() => setLoadPhase("Fetching portfolio data..."), 2000);
      const t2 = setTimeout(() => setLoadPhase("Processing project records..."), 5000);
      const t3 = setTimeout(() => setLoadPhase("Almost there..."), 10000);
      const data = await fetchSmartsheetData();
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setProjects(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const FILTER_DIMS = useMemo(() => [
    { key: "status", label: "Status", values: [...new Set(projects.map((p) => p.status))].filter(Boolean).sort() },
    { key: "priority", label: "Priority", values: ["High", "Medium", "Low"].filter((v) => projects.some((p) => p.priority === v)) },
    { key: "health", label: "Health", values: ["Up", "Unchanged", "Down"].filter((v) => projects.some((p) => p.health === v)) },
    { key: "parentLabel", label: "Department", values: [...new Set(projects.map((p) => p.parentLabel))].filter(Boolean).sort() },
    { key: "goal", label: "Strategic Goal", values: [...new Set(projects.map((p) => p.goal))].filter(Boolean).sort() },
    { key: "type", label: "Project Type", values: [...new Set(projects.map((p) => p.type))].filter(Boolean).sort() },
    { key: "lead", label: "Project Lead", values: [...new Set(projects.map((p) => p.lead))].filter(Boolean).sort() },
    { key: "sponsor", label: "Sponsor", values: [...new Set(projects.map((p) => p.sponsor))].filter(Boolean).sort() },
  ], [projects]);

  const toggleFilter = useCallback((dim, val) => {
    setFilters((prev) => {
      const cur = prev[dim] || [];
      const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
      const out = { ...prev };
      if (next.length === 0) delete out[dim]; else out[dim] = next;
      return out;
    });
  }, []);
  const clearFilters = useCallback(() => setFilters({}), []);

  const filtered = useMemo(() => projects.filter((p) => Object.entries(filters).every(([dim, vals]) => vals.includes(p[dim]))), [filters, projects]);
  const activeFilterCount = Object.values(filters).reduce((s, v) => s + v.length, 0);

  const summary = useMemo(() => {
    const f = filtered;
    return { totalBudget: f.reduce((s, p) => s + p.budget, 0), totalActual: f.reduce((s, p) => s + p.actual, 0), totalProposed: f.reduce((s, p) => s + p.proposedBudget, 0), avgComplete: f.length ? f.reduce((s, p) => s + p.pctComplete, 0) / f.length : 0, totalOpenItems: f.reduce((s, p) => s + p.openItems, 0), totalHighRisks: f.reduce((s, p) => s + p.highRisks, 0), totalHighIssues: f.reduce((s, p) => s + p.highIssues, 0), overBudget: f.filter((p) => p.actual > p.budget).length, count: f.length };
  }, [filtered]);

  const statusData = useMemo(() => { const m = {}; filtered.forEach((p) => { m[p.status] = (m[p.status] || 0) + 1; }); return Object.entries(m).map(([name, value]) => ({ name, value })); }, [filtered]);
  const healthData = useMemo(() => { const m = {}; filtered.forEach((p) => { m[p.health] = (m[p.health] || 0) + 1; }); return Object.entries(m).map(([name, value]) => ({ name, value })); }, [filtered]);
  const priorityData = useMemo(() => { const m = {}; filtered.forEach((p) => { m[p.priority] = (m[p.priority] || 0) + 1; }); return ["High", "Medium", "Low"].filter((k) => m[k]).map((name) => ({ name, value: m[name] })); }, [filtered]);
  const deptBudgetData = useMemo(() => { const m = {}; filtered.forEach((p) => { if (!m[p.parentLabel]) m[p.parentLabel] = { name: p.parentLabel, budget: 0, actual: 0 }; m[p.parentLabel].budget += p.budget; m[p.parentLabel].actual += p.actual; }); return Object.values(m).sort((a, b) => b.budget - a.budget); }, [filtered]);
  const goalBudgetData = useMemo(() => { const m = {}; filtered.forEach((p) => { if (!m[p.goal]) m[p.goal] = { name: p.goal, budget: 0, actual: 0 }; m[p.goal].budget += p.budget; m[p.goal].actual += p.actual; }); return Object.values(m).sort((a, b) => b.budget - a.budget); }, [filtered]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => { let av = a[sortCol], bv = b[sortCol]; if (typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); } if (av < bv) return sortDir === "asc" ? -1 : 1; if (av > bv) return sortDir === "asc" ? 1 : -1; return 0; });
    return arr;
  }, [filtered, sortCol, sortDir]);

  const handleSort = (col) => { if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortCol(col); setSortDir("asc"); } };
  const SortIcon = ({ col }) => { if (sortCol !== col) return <span style={{ opacity: 0.3, marginLeft: 4 }}>⇅</span>; return <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>; };

  const S = {
    root: { fontFamily: "Helvetica, 'Helvetica Neue', Arial, sans-serif", background: COLORS.bg, color: COLORS.text, minHeight: "100vh", padding: 0 },
    header: { padding: "28px 32px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, background: "#fff" },
    title: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", margin: 0, color: "#3a332c" },
    subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
    nav: { display: "flex", gap: 4, background: COLORS.bg, borderRadius: 10, padding: 4, border: `1px solid ${COLORS.border}` },
    navBtn: (a) => ({ padding: "8px 18px", borderRadius: 8, border: "none", background: a ? COLORS.accent : "transparent", color: a ? "#fff" : COLORS.textMuted, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }),
    filterBar: { padding: "16px 32px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, background: "#fff" },
    filterChip: (a) => ({ padding: "6px 14px", borderRadius: 20, border: `1px solid ${a ? COLORS.accent : COLORS.border}`, background: a ? COLORS.accentGlow : "transparent", color: a ? COLORS.accent : COLORS.textMuted, fontSize: 12, cursor: "pointer", fontWeight: a ? 600 : 400, userSelect: "none" }),
    filterDropdown: { position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 8, zIndex: 100, minWidth: 180, boxShadow: "0 12px 40px rgba(0,0,0,0.1)" },
    filterOption: (a) => ({ padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 8, background: a ? COLORS.accentGlow : "transparent", color: a ? COLORS.accent : COLORS.textMuted }),
    content: { padding: "24px 32px" },
    kpiRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 },
    kpiCard: () => ({ background: COLORS.card, borderRadius: 12, padding: "18px 20px", border: `1px solid ${COLORS.border}`, position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }),
    kpiAccent: (c) => ({ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: c }),
    kpiLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600 },
    kpiValue: (c) => ({ fontSize: 28, fontWeight: 700, color: c || COLORS.text, marginTop: 6, letterSpacing: "-0.5px" }),
    kpiSub: { fontSize: 11, color: COLORS.textDim, marginTop: 4 },
    chartGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, marginBottom: 28 },
    chartCard: { background: COLORS.card, borderRadius: 12, padding: "20px", border: `1px solid ${COLORS.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
    chartTitle: { fontSize: 14, fontWeight: 600, marginBottom: 16, color: COLORS.text },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
    th: { padding: "10px 14px", textAlign: "left", fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 600, borderBottom: `2px solid ${COLORS.border}`, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" },
    td: { padding: "12px 14px", fontSize: 13, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap" },
    badge: (bg, c) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color: c }),
    clearBtn: { padding: "5px 12px", borderRadius: 16, border: `1px solid ${COLORS.red}`, background: COLORS.redBg, color: COLORS.red, fontSize: 11, cursor: "pointer", fontWeight: 600 },
    progressBar: () => ({ width: 80, height: 6, borderRadius: 3, background: COLORS.border, position: "relative", overflow: "hidden" }),
    progressFill: (p, c) => ({ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(p * 100, 100)}%`, borderRadius: 3, background: c }),
    detailPanel: { background: COLORS.card, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: 28, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  };

  // ─── Loading ───
  if (loading) return (
    <div style={{ ...S.root, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20 }}>
      <div style={{ width: 48, height: 48, border: `3px solid ${COLORS.border}`, borderTop: `3px solid ${COLORS.accent}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text }}>{loadPhase}</div>
      <div style={{ fontSize: 12, color: COLORS.textMuted }}>Pulling live data from Smartsheet via MCP</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ─── Error (no data) ───
  if (error && projects.length === 0) return (
    <div style={{ ...S.root, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.red }}>Failed to load portfolio data</div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, maxWidth: 400, textAlign: "center" }}>{error}</div>
      <button onClick={() => loadData()} style={{ ...S.navBtn(true), marginTop: 8, padding: "10px 24px" }}>Retry</button>
    </div>
  );

  const DetailPanel = ({ project: p }) => (
    <div style={S.detailPanel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textDim, fontWeight: 600 }}>{p.code}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{p.name}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={S.badge(statusColor(p.status) + "22", statusColor(p.status))}>{p.status}</span>
            <span style={S.badge(healthColor(p.health) + "22", healthColor(p.health))}>{healthIcon(p.health)} {p.health}</span>
            <span style={S.badge(priorityColor(p.priority) + "22", priorityColor(p.priority))}>{p.priority} Priority</span>
          </div>
        </div>
        <button onClick={() => setSelectedProject(null)} style={{ background: "none", border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>✕ Close</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
        {[{ l: "Department", v: p.parentLabel }, { l: "Strategic Goal", v: p.goal }, { l: "Project Lead", v: p.lead }, { l: "Sponsor", v: p.sponsor }, { l: "Timeline", v: `${p.startDate} → ${p.endDate}` }].map((x, i) => <div key={i}><div style={S.kpiLabel}>{x.l}</div><div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{x.v}</div></div>)}
        <div><div style={S.kpiLabel}>% Complete</div><div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{pct(p.pctComplete)}</div><div style={{ ...S.progressBar(), marginTop: 6, width: "100%" }}><div style={S.progressFill(p.pctComplete, COLORS.accent)} /></div></div>
      </div>
      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
        {[{ label: "Budget", value: fmt(p.budget), color: COLORS.accent }, { label: "Actual", value: fmt(p.actual), color: p.actual > p.budget ? COLORS.red : COLORS.green }, { label: "Variance", value: fmt(p.difference), color: varianceColor(p.variance) }, { label: "CAPEX Budget", value: fmt(p.capexBudget), color: COLORS.purple }, { label: "OPEX Budget", value: fmt(p.opexBudget), color: COLORS.cyan }, { label: "Open Items", value: p.openItems, color: COLORS.yellow }, { label: "High Risks", value: p.highRisks, color: COLORS.red }, { label: "High Issues", value: p.highIssues, color: COLORS.orange }].map((m, i) => (
          <div key={i} style={{ background: COLORS.bg, borderRadius: 8, padding: "12px 14px", border: `1px solid ${COLORS.border}` }}><div style={S.kpiLabel}>{m.label}</div><div style={{ fontSize: 18, fontWeight: 700, color: m.color, marginTop: 4 }}>{m.value}</div></div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>ACM Corp | Portfolio Dashboard</h1>
          <p style={S.subtitle}>PPM ACM Corp Admin · {filtered.length} of {projects.length} projects · Live from Smartsheet{lastRefresh && <span> · Updated {lastRefresh.toLocaleTimeString()}</span>}</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <button onClick={() => loadData(true)} disabled={refreshing} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: refreshing ? COLORS.bg : "#fff", color: refreshing ? COLORS.textDim : COLORS.accent, fontSize: 13, fontWeight: 600, cursor: refreshing ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</span>
            {refreshing ? "Refreshing..." : "Refresh Data"}
          </button>
          <div style={S.nav}>
            {["overview", "table", "budget", "report"].map((v) => <button key={v} style={S.navBtn(view === v)} onClick={() => setView(v)}>{v === "overview" ? "Overview" : v === "table" ? "Portfolio Table" : v === "budget" ? "Budget Analysis" : "Smartsheet Report"}</button>)}
          </div>
        </div>
      </div>

      {error && projects.length > 0 && (
        <div style={{ padding: "10px 32px", background: COLORS.redBg, borderBottom: `1px solid ${COLORS.red}33`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: COLORS.red }}>⚠ Refresh failed: {error}. Showing previously loaded data.</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 12 }}>Dismiss</button>
        </div>
      )}

      <div style={S.filterBar}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textDim, marginRight: 4 }}>FILTERS</span>
        {FILTER_DIMS.map((dim) => {
          const active = filters[dim.key]?.length > 0;
          return (<div key={dim.key} style={{ position: "relative" }}>
            <div style={S.filterChip(active)} onClick={() => setExpandedFilter(expandedFilter === dim.key ? null : dim.key)}>{dim.label}{active ? ` (${filters[dim.key].length})` : ""} ▾</div>
            {expandedFilter === dim.key && <div style={S.filterDropdown}>{dim.values.map((val) => { const isOn = filters[dim.key]?.includes(val); return (<div key={val} style={S.filterOption(isOn)} onClick={() => toggleFilter(dim.key, val)}><span style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${isOn ? COLORS.accent : COLORS.borderLight}`, background: isOn ? COLORS.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", flexShrink: 0 }}>{isOn && "✓"}</span>{val}</div>); })}</div>}
          </div>);
        })}
        {activeFilterCount > 0 && <button style={S.clearBtn} onClick={clearFilters}>Clear All ({activeFilterCount})</button>}
      </div>

      <div style={S.content}>
        {selectedProject && <DetailPanel project={selectedProject} />}

        {view === "overview" && <>
          <div style={S.kpiRow}>
            {[{ label: "Total Projects", value: summary.count, color: COLORS.accent }, { label: "Avg Completion", value: pct(summary.avgComplete), color: COLORS.green, sub: `${filtered.filter((p) => p.pctComplete === 1).length} complete` }, { label: "Total Budget", value: fmtK(summary.totalBudget), color: COLORS.accent, sub: `Proposed: ${fmtK(summary.totalProposed)}` }, { label: "Total Actual", value: fmtK(summary.totalActual), color: summary.totalActual > summary.totalBudget ? COLORS.red : COLORS.green, sub: `${summary.totalActual > summary.totalBudget ? "Over" : "Under"} by ${fmtK(Math.abs(summary.totalBudget - summary.totalActual))}` }, { label: "Over Budget", value: summary.overBudget, color: summary.overBudget > 0 ? COLORS.red : COLORS.green, sub: `of ${summary.count} projects` }, { label: "Open Items", value: summary.totalOpenItems, color: COLORS.yellow }, { label: "High Risks", value: summary.totalHighRisks, color: COLORS.red }, { label: "High Issues", value: summary.totalHighIssues, color: COLORS.orange }].map((kpi, i) => (
              <div key={i} style={S.kpiCard()}><div style={S.kpiAccent(kpi.color)} /><div style={S.kpiLabel}>{kpi.label}</div><div style={S.kpiValue(kpi.color)}>{kpi.value}</div>{kpi.sub && <div style={S.kpiSub}>{kpi.sub}</div>}</div>
            ))}
          </div>
          <div style={S.chartGrid}>
            <div style={S.chartCard}><div style={S.chartTitle}>Projects by Status</div><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={PieLabel} labelLine={false}>{statusData.map((_, i) => <Cell key={i} fill={PIE_STATUS[i % PIE_STATUS.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart></ResponsiveContainer></div>
            <div style={S.chartCard}><div style={S.chartTitle}>Projects by Health</div><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={healthData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={PieLabel} labelLine={false}>{healthData.map((e, i) => <Cell key={i} fill={e.name === "Up" ? COLORS.green : e.name === "Down" ? COLORS.red : COLORS.yellow} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart></ResponsiveContainer></div>
            <div style={S.chartCard}><div style={S.chartTitle}>Projects by Priority</div><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={priorityData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={PieLabel} labelLine={false}>{priorityData.map((_, i) => <Cell key={i} fill={PIE_PRIORITY[i % PIE_PRIORITY.length]} />)}</Pie><Tooltip content={<CustomTooltip />} /></PieChart></ResponsiveContainer></div>
            <div style={{ ...S.chartCard, gridColumn: "span 2" }}><div style={S.chartTitle}>Budget vs Actual by Department</div><ResponsiveContainer width="100%" height={260}><BarChart data={deptBudgetData} barGap={4}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} /><XAxis dataKey="name" tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} /><YAxis tick={{ fill: COLORS.textMuted, fontSize: 11 }} axisLine={{ stroke: COLORS.border }} tickFormatter={(v) => fmtK(v)} /><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="budget" name="Budget" fill={COLORS.accent} radius={[4, 4, 0, 0]} /><Bar dataKey="actual" name="Actual" fill={COLORS.purple} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <div style={S.chartCard}><div style={S.chartTitle}>Budget by Strategic Goal</div><ResponsiveContainer width="100%" height={260}><BarChart data={goalBudgetData} layout="vertical" barGap={4}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} /><XAxis type="number" tick={{ fill: COLORS.textMuted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickFormatter={(v) => fmtK(v)} /><YAxis type="category" dataKey="name" width={130} tick={{ fill: COLORS.textMuted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} /><Tooltip content={<CustomTooltip />} /><Bar dataKey="budget" name="Budget" fill={COLORS.cyan} radius={[0, 4, 4, 0]} /><Bar dataKey="actual" name="Actual" fill={COLORS.orange} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
          </div>
        </>}

        {view === "table" && <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.card }}>
          <table style={S.table}><thead><tr>{[{ col: "code", label: "Code" }, { col: "name", label: "Project" }, { col: "status", label: "Status" }, { col: "health", label: "Health" }, { col: "priority", label: "Priority" }, { col: "parentLabel", label: "Dept" }, { col: "pctComplete", label: "% Done" }, { col: "budget", label: "Budget" }, { col: "actual", label: "Actual" }, { col: "variance", label: "Variance" }, { col: "highRisks", label: "Risks" }, { col: "highIssues", label: "Issues" }].map((c) => <th key={c.col} style={S.th} onClick={() => handleSort(c.col)}>{c.label}<SortIcon col={c.col} /></th>)}</tr></thead>
            <tbody>{sorted.map((p) => (
              <tr key={p.code} onClick={() => setSelectedProject(p)} style={{ cursor: "pointer" }} onMouseOver={(e) => e.currentTarget.style.background = COLORS.cardHover} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                <td style={{ ...S.td, color: COLORS.textDim, fontFamily: "monospace", fontSize: 12 }}>{p.code}</td>
                <td style={{ ...S.td, fontWeight: 600, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</td>
                <td style={S.td}><span style={S.badge(statusColor(p.status) + "22", statusColor(p.status))}>{p.status}</span></td>
                <td style={S.td}><span style={{ color: healthColor(p.health), fontWeight: 600 }}>{healthIcon(p.health)} {p.health}</span></td>
                <td style={S.td}><span style={{ color: priorityColor(p.priority), fontWeight: 600 }}>{p.priority}</span></td>
                <td style={{ ...S.td, color: COLORS.textMuted }}>{p.parentLabel}</td>
                <td style={S.td}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={S.progressBar()}><div style={S.progressFill(p.pctComplete, p.pctComplete === 1 ? COLORS.green : COLORS.accent)} /></div><span style={{ fontSize: 12, color: COLORS.textMuted }}>{pct(p.pctComplete)}</span></div></td>
                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12 }}>{fmt(p.budget)}</td>
                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, color: p.actual > p.budget ? COLORS.red : COLORS.green }}>{fmt(p.actual)}</td>
                <td style={{ ...S.td, fontFamily: "monospace", fontSize: 12, color: varianceColor(p.variance) }}>{(p.variance * 100).toFixed(1)}%</td>
                <td style={{ ...S.td, textAlign: "center", color: p.highRisks > 2 ? COLORS.red : COLORS.textMuted, fontWeight: p.highRisks > 2 ? 700 : 400 }}>{p.highRisks}</td>
                <td style={{ ...S.td, textAlign: "center", color: p.highIssues > 4 ? COLORS.red : COLORS.textMuted, fontWeight: p.highIssues > 4 ? 700 : 400 }}>{p.highIssues}</td>
              </tr>
            ))}</tbody></table>
        </div>}

        {view === "budget" && <>
          <div style={S.kpiRow}>
            {[{ label: "Total Proposed", value: fmt(summary.totalProposed), color: COLORS.textMuted }, { label: "Approved Budget", value: fmt(summary.totalBudget), color: COLORS.accent }, { label: "Actual Spend", value: fmt(summary.totalActual), color: summary.totalActual > summary.totalBudget ? COLORS.red : COLORS.green }, { label: "Remaining", value: fmt(summary.totalBudget - summary.totalActual), color: (summary.totalBudget - summary.totalActual) < 0 ? COLORS.red : COLORS.green }, { label: "CAPEX Total", value: fmt(filtered.reduce((s, p) => s + p.capexBudget, 0)), color: COLORS.purple, sub: `Actual: ${fmt(filtered.reduce((s, p) => s + p.capexActual, 0))}` }, { label: "OPEX Total", value: fmt(filtered.reduce((s, p) => s + p.opexBudget, 0)), color: COLORS.cyan, sub: `Actual: ${fmt(filtered.reduce((s, p) => s + p.opexActual, 0))}` }].map((kpi, i) => (
              <div key={i} style={S.kpiCard()}><div style={S.kpiAccent(kpi.color)} /><div style={S.kpiLabel}>{kpi.label}</div><div style={S.kpiValue(kpi.color)}>{kpi.value}</div>{kpi.sub && <div style={S.kpiSub}>{kpi.sub}</div>}</div>
            ))}
          </div>
          <div style={S.chartGrid}>
            <div style={{ ...S.chartCard, gridColumn: "span 2" }}><div style={S.chartTitle}>Project Budget vs Actual</div><ResponsiveContainer width="100%" height={360}><BarChart data={sorted.map((p) => ({ name: p.code, budget: p.budget, actual: p.actual }))} barGap={2}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} /><XAxis dataKey="name" tick={{ fill: COLORS.textMuted, fontSize: 9 }} axisLine={{ stroke: COLORS.border }} angle={-45} textAnchor="end" height={50} /><YAxis tick={{ fill: COLORS.textMuted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickFormatter={(v) => fmtK(v)} /><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="budget" name="Budget" fill={COLORS.accent} radius={[3, 3, 0, 0]} /><Bar dataKey="actual" name="Actual" fill={COLORS.orange} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
            <div style={S.chartCard}><div style={S.chartTitle}>CAPEX vs OPEX by Dept</div><ResponsiveContainer width="100%" height={260}><BarChart data={deptBudgetData.map((d) => { const dp = filtered.filter((p) => p.parentLabel === d.name); return { name: d.name, capex: dp.reduce((s, p) => s + p.capexBudget, 0), opex: dp.reduce((s, p) => s + p.opexBudget, 0) }; })}><CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} /><XAxis dataKey="name" tick={{ fill: COLORS.textMuted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} /><YAxis tick={{ fill: COLORS.textMuted, fontSize: 10 }} axisLine={{ stroke: COLORS.border }} tickFormatter={(v) => fmtK(v)} /><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="capex" name="CAPEX" fill={COLORS.purple} radius={[4, 4, 0, 0]} stackId="a" /><Bar dataKey="opex" name="OPEX" fill={COLORS.cyan} radius={[4, 4, 0, 0]} stackId="a" /></BarChart></ResponsiveContainer></div>
            <div style={S.chartCard}><div style={S.chartTitle}>Over-Budget Projects</div><div style={{ maxHeight: 260, overflowY: "auto" }}>{sorted.filter((p) => p.actual > p.budget).length === 0 ? <div style={{ textAlign: "center", padding: 40, color: COLORS.green, fontSize: 14, fontWeight: 600 }}>All projects within budget ✓</div> : sorted.filter((p) => p.actual > p.budget).sort((a, b) => (a.actual - a.budget) - (b.actual - b.budget)).map((p) => (<div key={p.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer" }} onClick={() => setSelectedProject(p)}><div><div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{p.parentLabel} · {p.code}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 700, color: COLORS.red }}>-{fmt(p.actual - p.budget)}</div><div style={{ fontSize: 11, color: COLORS.textMuted }}>{Math.abs(Math.round(p.variance * 100))}% over</div></div></div>))}</div></div>
          </div>
        </>}

        {view === "report" && <>
          <div style={{ background: "linear-gradient(135deg, #4a3f33 0%, #5c4f3e 50%, #4a3f33 100%)", borderRadius: 12, padding: "24px 28px", marginBottom: 24, border: "1px solid #6b5d4a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
              <div><div style={{ fontSize: 18, fontWeight: 700, color: "#f5f2ed" }}>Project Portfolio Report</div><div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>Live data from Smartsheet · Click to open dashboards, plans, and sheets</div></div>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
              {[{ l: "Provisioned", v: filtered.filter((p) => SMARTSHEET_LINKS[p.code]).length, c: "#5f8a5e" }, { l: "Pending", v: filtered.filter((p) => !SMARTSHEET_LINKS[p.code]).length, c: "#b08d4a" }, { l: "Total", v: filtered.length, c: "#f5f2ed" }].map((k, i) => <div key={i} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px" }}><div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{k.l}</div><div style={{ fontSize: 20, fontWeight: 700, color: k.c }}>{k.v}</div></div>)}
            </div>
          </div>
          <div style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.card, overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(180deg, #5c4f3e 0%, #4a3f33 100%)", padding: "1px 0" }}>
              <table style={{ ...S.table, tableLayout: "fixed" }}><colgroup><col style={{ width: 50 }} /><col style={{ width: 76 }} /><col style={{ width: "22%" }} /><col style={{ width: 82 }} /><col style={{ width: 72 }} /><col style={{ width: 72 }} /><col style={{ width: 90 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 64 }} /><col /></colgroup>
                <thead><tr>{["#", "Code", "Project Name", "Status", "Health", "Priority", "Dept", "Budget", "Actual", "% Done", "Smartsheet Links"].map((h, i) => <th key={i} style={{ padding: "10px 10px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700, borderBottom: "2px solid #6b5d4a", whiteSpace: "nowrap", background: "transparent" }}>{h}</th>)}</tr></thead>
              </table>
            </div>
            <div style={{ maxHeight: 620, overflowY: "auto" }}>
              <table style={{ ...S.table, tableLayout: "fixed" }}><colgroup><col style={{ width: 50 }} /><col style={{ width: 76 }} /><col style={{ width: "22%" }} /><col style={{ width: 82 }} /><col style={{ width: 72 }} /><col style={{ width: 72 }} /><col style={{ width: 90 }} /><col style={{ width: 100 }} /><col style={{ width: 100 }} /><col style={{ width: 64 }} /><col /></colgroup>
                <tbody>{sorted.map((p, idx) => {
                  const links = SMARTSHEET_LINKS[p.code]; const isP = !!links;
                  const rowBg = idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)";
                  const ls = { display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap" };
                  return (<tr key={p.code} style={{ background: rowBg }} onMouseOver={(e) => e.currentTarget.style.background = COLORS.cardHover} onMouseOut={(e) => e.currentTarget.style.background = rowBg}>
                    <td style={{ ...S.td, color: COLORS.textDim, fontSize: 11, textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: COLORS.textDim }}>{p.code}</td>
                    <td style={{ ...S.td, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isP ? <a href={links.dashboard} target="_blank" rel="noopener noreferrer" style={{ color: "#7c6a52", textDecoration: "none", borderBottom: "1px dotted rgba(124,106,82,0.4)" }}>{p.name}</a> : p.name}</td>
                    <td style={S.td}><span style={S.badge(statusColor(p.status) + "22", statusColor(p.status))}>{p.status}</span></td>
                    <td style={S.td}><span style={{ color: healthColor(p.health), fontWeight: 600, fontSize: 12 }}>{healthIcon(p.health)} {p.health}</span></td>
                    <td style={S.td}><span style={{ color: priorityColor(p.priority), fontWeight: 600, fontSize: 12 }}>{p.priority}</span></td>
                    <td style={{ ...S.td, color: COLORS.textMuted, fontSize: 12 }}>{p.parentLabel}</td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>{fmt(p.budget)}</td>
                    <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: p.actual > p.budget ? COLORS.red : COLORS.green }}>{fmt(p.actual)}</td>
                    <td style={S.td}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 40, height: 5, borderRadius: 3, background: COLORS.border, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(p.pctComplete * 100, 100)}%`, borderRadius: 3, background: p.pctComplete === 1 ? COLORS.green : COLORS.accent }} /></div><span style={{ fontSize: 11, color: COLORS.textMuted }}>{pct(p.pctComplete)}</span></div></td>
                    <td style={{ ...S.td, padding: "8px 10px" }}>{isP ? (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {[{ key: "dashboard", label: "Dashboard", bg: "rgba(124,106,82,0.1)", color: "#7c6a52", border: "rgba(124,106,82,0.25)", icon: "M2 2h5v5H2V2zm7 0h5v5H9V2zm-7 7h5v5H2V9zm7 0h5v5H9V9z" }, { key: "projectPlan", label: "Plan", bg: "rgba(95,138,94,0.1)", color: "#5f8a5e", border: "rgba(95,138,94,0.25)", icon: "M1 3h14v2H1V3zm2 4h10v2H3V7zm1 4h8v2H4v-2z" }, { key: "budget", label: "Budget", bg: "rgba(122,107,138,0.1)", color: "#7a6b8a", border: "rgba(122,107,138,0.25)", icon: "M8 1a7 7 0 100 14A7 7 0 008 1zm.5 3v1.5H10v1H8.5V8h-1V6.5H6v-1h1.5V4h1zm-2 6h3v1h-3v-1z" }, { key: "status", label: "Status", bg: "rgba(176,141,74,0.1)", color: "#b08d4a", border: "rgba(176,141,74,0.25)", icon: "M3 1h10a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V3a2 2 0 012-2zm1 3v2h8V4H4zm0 4v2h6V8H4z" }, { key: "roster", label: "Roster", bg: "rgba(90,127,138,0.1)", color: "#5a7f8a", border: "rgba(90,127,138,0.25)", icon: "M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0H3z" }].map((btn) => (
                          <a key={btn.key} href={links[btn.key]} target="_blank" rel="noopener noreferrer" style={{ ...ls, background: btn.bg, color: btn.color, border: `1px solid ${btn.border}` }}><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d={btn.icon} /></svg>{btn.label}</a>
                        ))}
                      </div>
                    ) : <span style={{ fontSize: 11, color: COLORS.textDim, fontStyle: "italic" }}>Not yet provisioned</span>}</td>
                  </tr>);
                })}</tbody>
              </table>
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${COLORS.border}`, background: "rgba(0,0,0,0.02)", fontSize: 11, color: COLORS.textDim }}>Showing {filtered.length} project{filtered.length !== 1 ? "s" : ""} · {filtered.filter((p) => SMARTSHEET_LINKS[p.code]).length} provisioned</div>
          </div>
          <div style={{ marginTop: 16, padding: "14px 20px", background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.5px" }}>Legend:</span>
            {[{ l: "Dashboard", c: "#7c6a52" }, { l: "Plan", c: "#5f8a5e" }, { l: "Budget", c: "#7a6b8a" }, { l: "Status", c: "#b08d4a" }, { l: "Roster", c: "#5a7f8a" }].map((x, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: COLORS.textMuted }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: x.c }} /><span style={{ color: x.c, fontWeight: 600 }}>{x.l}</span></div>)}
          </div>
        </>}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
