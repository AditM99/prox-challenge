import type { TroubleshootingFlow } from "./types";

export function generateTroubleshootingReactCode(flow: TroubleshootingFlow): string {
  const stepsJSON = JSON.stringify(flow.steps).replace(/`/g, "\\`").replace(/\$/g, "\\$");

  return `
const steps = ${stepsJSON};

function App() {
  const [currentStepId, setCurrentStepId] = React.useState("start");
  const [history, setHistory] = React.useState([]);
  const { CheckCircle, ChevronRight, RotateCcw, AlertTriangle, Wrench, ArrowLeft } = window.LucideIcons || {};

  const currentStep = steps[currentStepId];

  const handleOption = (nextId) => {
    setHistory(prev => [...prev, currentStepId]);
    setCurrentStepId(nextId);
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const prev = [...history];
    const last = prev.pop();
    setHistory(prev);
    setCurrentStepId(last);
  };

  const handleRestart = () => {
    setHistory([]);
    setCurrentStepId("start");
  };

  const isResolution = currentStep?.type === "resolution";
  const progress = history.length;

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", maxWidth: 540, margin: "0 auto", padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {Wrench ? <Wrench size={20} color="#6366f1" /> : <span>🔧</span>}
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: 0 }}>
          ${flow.title.replace(/'/g, "\\'")}
        </h2>
      </div>

      {/* Progress bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {Array.from({ length: Math.max(progress + 1, 3) }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= progress ? (isResolution ? "#22c55e" : "#6366f1") : "#e2e8f0",
              transition: "background 0.3s"
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      {history.length > 0 && (
        <button
          onClick={handleBack}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "none", border: "none", color: "#64748b",
            cursor: "pointer", fontSize: 12, padding: "4px 0", marginBottom: 12
          }}
        >
          {ArrowLeft ? <ArrowLeft size={14} /> : "<"} Back
        </button>
      )}

      {isResolution ? (
        /* Resolution Card */
        <div style={{
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius: 12, padding: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {CheckCircle ? <CheckCircle size={20} color="#16a34a" /> : <span>✅</span>}
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#16a34a", margin: 0 }}>
              {currentStep.title}
            </h3>
          </div>
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {currentStep.fix}
          </div>
          {currentStep.reference && (
            <p style={{ fontSize: 11, color: "#6366f1", marginTop: 12, fontStyle: "italic" }}>
              {currentStep.reference}
            </p>
          )}
          <button
            onClick={handleRestart}
            style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 16,
              background: "#f1f5f9", border: "1px solid #e2e8f0",
              borderRadius: 8, padding: "8px 16px", color: "#475569",
              cursor: "pointer", fontSize: 13
            }}
          >
            {RotateCcw ? <RotateCcw size={14} /> : "↺"} Start Over
          </button>
        </div>
      ) : (
        /* Question Card */
        <div>
          <div style={{
            background: "#eef2ff", border: "1px solid #c7d2fe",
            borderRadius: 12, padding: 16, marginBottom: 12
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              {AlertTriangle ? <AlertTriangle size={18} color="#6366f1" style={{ flexShrink: 0, marginTop: 2 }} /> : null}
              <p style={{ fontSize: 14, color: "#1e293b", margin: 0, lineHeight: 1.5 }}>
                {currentStep?.question}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(currentStep?.options || []).map((opt, i) => (
              <button
                key={i}
                onClick={() => handleOption(opt.next)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: 10, padding: "12px 14px", color: "#334155",
                  cursor: "pointer", fontSize: 13, textAlign: "left", transition: "all 0.15s",
                  width: "100%"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#eef2ff";
                  e.currentTarget.style.borderColor = "#a5b4fc";
                  e.currentTarget.style.color = "#1e293b";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.color = "#334155";
                }}
              >
                <span>{opt.label}</span>
                {ChevronRight ? <ChevronRight size={16} style={{ opacity: 0.4, flexShrink: 0 }} /> : ">"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
`;
}
