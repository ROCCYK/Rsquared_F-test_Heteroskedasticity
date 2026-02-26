import { useState, useEffect, useRef, useCallback } from 'react';

// ── Scatter chart dims ──────────────────────────────────────────────
const W = 540,
  H = 300;
const PAD = { top: 18, right: 28, bottom: 46, left: 48 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;
const X_MIN = 0,
  X_MAX = 100,
  Y_MIN = 0,
  Y_MAX = 110;

// ── Residual plot dims ──────────────────────────────────────────────
const RW = 540,
  RH = 200;
const RPAD = { top: 18, right: 28, bottom: 42, left: 48 };
const RPW = RW - RPAD.left - RPAD.right;
const RPH = RH - RPAD.top - RPAD.bottom;

const tx = (x) => PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * PW;
const ty = (y) => PAD.top + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * PH;
const fx = (sx) => X_MIN + ((sx - PAD.left) / PW) * (X_MAX - X_MIN);
const fy = (sy) => Y_MAX - ((sy - PAD.top) / PH) * (Y_MAX - Y_MIN);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Data generation ─────────────────────────────────────────────────
const generateData = (mode) => {
  const n = 18;
  return Array.from({ length: n }, (_, i) => {
    const x = 5 + i * 5.2;
    const trueY = 15 + x * 0.75;
    let noise;
    if (mode === 'hetero') {
      // Fan shape: spread grows with x
      noise = (x / 100) * 55 * (Math.random() - 0.5) * 2;
    } else {
      const noiseScale = mode === 'weak' ? 38 : mode === 'strong' ? 8 : 22;
      noise = (Math.random() - 0.5) * noiseScale * 2;
    }
    const y = clamp(trueY + noise, 2, 108);
    return { id: i, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });
};

// ── Stats ────────────────────────────────────────────────────────────
const computeStats = (data) => {
  const n = data.length;
  if (n < 2) return null;
  const meanX = data.reduce((s, d) => s + d.x, 0) / n;
  const meanY = data.reduce((s, d) => s + d.y, 0) / n;
  const ssXX = data.reduce((s, d) => s + (d.x - meanX) ** 2, 0);
  if (ssXX === 0) return null;
  const slope =
    data.reduce((s, d) => s + (d.x - meanX) * (d.y - meanY), 0) / ssXX;
  const intercept = meanY - slope * meanX;
  const residuals = data.map((d) => ({
    fitted: slope * d.x + intercept,
    resid: d.y - (slope * d.x + intercept),
    x: d.x,
  }));
  const ssRes = residuals.reduce((s, r) => s + r.resid ** 2, 0);
  const ssTot = data.reduce((s, d) => s + (d.y - meanY) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);
  const k = 1;
  const fStat = 1 - r2 === 0 ? Infinity : r2 / k / ((1 - r2) / (n - k - 1));
  const pValue = fStat === Infinity ? 0 : fPValue(k, n - k - 1, fStat);

  // Breusch-Pagan style: correlate |resid| with fitted values
  const absResids = residuals.map((r) => Math.abs(r.resid));
  const meanAR = absResids.reduce((s, v) => s + v, 0) / n;
  const fitteds = residuals.map((r) => r.fitted);
  const meanF = fitteds.reduce((s, v) => s + v, 0) / n;
  const corr =
    absResids.reduce((s, v, i) => s + (v - meanAR) * (fitteds[i] - meanF), 0) /
    Math.sqrt(
      absResids.reduce((s, v) => s + (v - meanAR) ** 2, 0) *
        fitteds.reduce((s, v) => s + (v - meanF) ** 2, 1e-9)
    );

  return {
    slope,
    intercept,
    meanY,
    r2,
    fStat,
    pValue,
    residuals,
    heteroScore: corr,
  };
};

// ── F p-value ────────────────────────────────────────────────────────
function fPValue(d1, d2, f) {
  const x = d2 / (d2 + d1 * f);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return regIncBeta(d2 / 2, d1 / 2, x);
}
function lgamma(z) {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = z,
    x = z,
    tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let i = 0; i < 6; i++) ser += c[i] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
function regIncBeta(a, b, x) {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;
  let f = 1,
    C = 1,
    D = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(D) < 1e-30) D = 1e-30;
  D = 1 / D;
  f = D;
  for (let m = 1; m <= 100; m++) {
    let num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    D = 1 + num * D;
    if (Math.abs(D) < 1e-30) D = 1e-30;
    D = 1 / D;
    C = 1 + num / C;
    if (Math.abs(C) < 1e-30) C = 1e-30;
    f *= D * C;
    num = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    D = 1 + num * D;
    if (Math.abs(D) < 1e-30) D = 1e-30;
    D = 1 / D;
    C = 1 + num / C;
    if (Math.abs(C) < 1e-30) C = 1e-30;
    const delta = D * C;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-7) break;
  }
  return front * f;
}

// ── Colour helpers ───────────────────────────────────────────────────
const r2Color = (r) => (r < 0.3 ? '#ef4444' : r < 0.6 ? '#f59e0b' : '#22c55e');
const pColor = (p) =>
  p < 0.001
    ? '#22c55e'
    : p < 0.05
    ? '#86efac'
    : p < 0.1
    ? '#f59e0b'
    : '#ef4444';
const pLabel = (p) =>
  p < 0.001
    ? 'p < 0.001 — highly significant'
    : p < 0.05
    ? `p = ${p.toFixed(3)} — significant`
    : p < 0.1
    ? `p = ${p.toFixed(3)} — marginal`
    : `p = ${p.toFixed(3)} — not significant`;
const heteroColor = (h) =>
  Math.abs(h) > 0.5 ? '#ef4444' : Math.abs(h) > 0.25 ? '#f59e0b' : '#22c55e';
const heteroLabel = (h) =>
  Math.abs(h) > 0.5
    ? 'Strong heteroskedasticity detected'
    : Math.abs(h) > 0.25
    ? 'Mild heteroskedasticity'
    : 'Errors look homoskedastic ✓';

const PRESETS = [
  { label: 'Weak fit', mode: 'weak', color: '#ef4444' },
  { label: 'Moderate fit', mode: 'moderate', color: '#f59e0b' },
  { label: 'Strong fit', mode: 'strong', color: '#22c55e' },
  { label: 'Fan / Hetero', mode: 'hetero', color: '#a78bfa' },
];

// ── Reusable SVG chart helpers ───────────────────────────────────────
function Grid({ xTicks, yTicks, toX, toY, pw, ph, padL, padT }) {
  return (
    <>
      {xTicks.map((t) => (
        <line
          key={`gx${t}`}
          x1={toX(t)}
          y1={padT}
          x2={toX(t)}
          y2={padT + ph}
          stroke="#1e3a5f"
          strokeDasharray="4 3"
        />
      ))}
      {yTicks.map((t) => (
        <line
          key={`gy${t}`}
          x1={padL}
          y1={toY(t)}
          x2={padL + pw}
          y2={toY(t)}
          stroke="#1e3a5f"
          strokeDasharray="4 3"
        />
      ))}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function App() {
  const [selected, setSelected] = useState(1);
  const [data, setData] = useState(() => generateData('moderate'));
  const dragging = useRef(null);
  const svgRef = useRef(null);

  const stats = computeStats(data);
  const r2 = stats?.r2 ?? 0;
  const fStat = stats?.fStat ?? 0;
  const pVal = stats?.pValue ?? 1;
  const hScore = stats?.heteroScore ?? 0;

  const rc = r2Color(r2);
  const pc = pColor(pVal);
  const hc = heteroColor(hScore);

  const regenerate = (idx) => {
    setSelected(idx);
    setData(generateData(PRESETS[idx].mode));
  };

  // Scatter line endpoints
  const ly1 = stats ? stats.slope * X_MIN + stats.intercept : 0;
  const ly2 = stats ? stats.slope * X_MAX + stats.intercept : 0;

  // Residual plot y-range
  const residVals = stats ? stats.residuals.map((r) => r.resid) : [0];
  const rMax = Math.max(40, ...residVals.map(Math.abs)) * 1.2;
  const rMin = -rMax;
  const rToY = (r) => RPAD.top + ((rMax - r) / (rMax - rMin)) * RPH;
  const rToX = (x) => RPAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * RPW;

  // Drag
  const getSvgPt = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((cx - rect.left) / rect.width) * W,
      y: ((cy - rect.top) / rect.height) * H,
    };
  };
  const onDown = (id) => (e) => {
    e.preventDefault();
    dragging.current = id;
  };
  const onMove = useCallback((e) => {
    if (dragging.current === null) return;
    e.preventDefault();
    const pt = getSvgPt(e);
    if (!pt) return;
    const nx = clamp(fx(pt.x), X_MIN + 1, X_MAX - 1);
    const ny = clamp(fy(pt.y), Y_MIN + 1, Y_MAX - 1);
    setData((prev) =>
      prev.map((d) =>
        d.id === dragging.current
          ? { ...d, x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 }
          : d
      )
    );
  }, []);
  const onUp = useCallback(() => {
    dragging.current = null;
  }, []);
  useEffect(() => {
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [onUp]);

  const xTicks = [0, 20, 40, 60, 80, 100];
  const yTicks = [0, 25, 50, 75, 100];

  const card = (label, value, color, sub, barPct) => (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '1rem',
        padding: '0.9rem 1.1rem',
        border: `1px solid ${color}44`,
      }}
    >
      <div
        style={{
          fontSize: '0.63rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#64748b',
          marginBottom: '0.15rem',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '2rem',
          fontWeight: '800',
          color,
          lineHeight: 1.1,
          transition: 'color 0.3s',
        }}
      >
        {value}
      </div>
      {barPct !== undefined && (
        <div
          style={{
            marginTop: '0.4rem',
            background: '#0f172a',
            borderRadius: '999px',
            height: 5,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${barPct}%`,
              height: '100%',
              background: `linear-gradient(90deg,#334155,${color})`,
              borderRadius: '999px',
              transition: 'width 0.05s',
            }}
          />
        </div>
      )}
      <div
        style={{
          fontSize: '0.72rem',
          color: '#94a3b8',
          marginTop: '0.35rem',
          transition: 'color 0.3s',
        }}
      >
        {sub}
      </div>
    </div>
  );

  return (
    <div
      style={{
        fontFamily: "'Georgia',serif",
        background: '#0f172a',
        minHeight: '100vh',
        padding: '1.75rem 1rem',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <h1
        style={{
          fontSize: '1.9rem',
          fontWeight: '700',
          letterSpacing: '-0.03em',
          marginBottom: '0.15rem',
          color: '#f8fafc',
        }}
      >
        Regression Diagnostics
      </h1>
      <p
        style={{
          color: '#94a3b8',
          marginBottom: '1.5rem',
          fontStyle: 'italic',
          fontSize: '0.9rem',
        }}
      >
        Drag dots · watch all stats update live
      </p>

      {/* Preset buttons */}
      <div
        style={{
          display: 'flex',
          gap: '0.55rem',
          marginBottom: '1.4rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {PRESETS.map((p, i) => (
          <button
            key={i}
            onClick={() => regenerate(i)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '999px',
              border: `2px solid ${selected === i ? p.color : '#334155'}`,
              background: selected === i ? p.color + '22' : 'transparent',
              color: selected === i ? p.color : '#94a3b8',
              fontFamily: 'inherit',
              fontSize: '0.84rem',
              cursor: 'pointer',
              fontWeight: selected === i ? '700' : '400',
              transition: 'all 0.2s',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0.65rem',
          width: '100%',
          maxWidth: '600px',
          marginBottom: '1.1rem',
        }}
      >
        {card(
          'R² — Effect Size',
          r2.toFixed(3),
          rc,
          `${Math.round(r2 * 100)}% of variance explained`,
          Math.round(r2 * 100)
        )}
        {card(
          'F-statistic',
          fStat > 9999 ? '>9999' : fStat.toFixed(1),
          pc,
          pLabel(pVal),
          Math.min(100, (fStat / 50) * 100)
        )}
        {card(
          'Heteroskedasticity',
          Math.abs(hScore).toFixed(2),
          hc,
          heteroLabel(hScore),
          undefined
        )}
      </div>

      {/* Insight banner */}
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          marginBottom: '1.1rem',
          background: '#1e293b',
          borderRadius: '0.75rem',
          padding: '0.65rem 1.1rem',
          border: '1px solid #334155',
          fontSize: '0.8rem',
          color: '#94a3b8',
          lineHeight: 1.55,
        }}
      >
        💡 <strong style={{ color: '#cbd5e1' }}>R²</strong> = how much is
        explained.&ensp;
        <strong style={{ color: '#cbd5e1' }}>F-test</strong> = can we trust
        it?&ensp;
        <strong style={{ color: '#cbd5e1' }}>Heteroskedasticity</strong> = do
        errors fan out? (If yes, p-values become unreliable.)
        {Math.abs(hScore) > 0.4 && (
          <span style={{ color: '#fca5a5' }}>
            {' '}
            ⚠ Fan shape detected — consider robust standard errors or
            log-transforming Y.
          </span>
        )}
      </div>

      {/* ── Scatter chart ── */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: '1rem',
          padding: '0.9rem',
          width: '100%',
          maxWidth: '620px',
          border: '1px solid #334155',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            color: '#64748b',
            marginBottom: '0.4rem',
            textAlign: 'center',
          }}
        >
          Hours Studied → Exam Score &nbsp;·&nbsp;{' '}
          <span style={{ color: '#60a5fa' }}>drag any dot</span>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', userSelect: 'none', touchAction: 'none' }}
          onMouseMove={onMove}
          onTouchMove={onMove}
        >
          <Grid
            xTicks={xTicks}
            yTicks={yTicks}
            toX={tx}
            toY={ty}
            pw={PW}
            ph={PH}
            padL={PAD.left}
            padT={PAD.top}
          />
          <line
            x1={PAD.left}
            y1={PAD.top + PH}
            x2={PAD.left + PW}
            y2={PAD.top + PH}
            stroke="#334155"
          />
          <line
            x1={PAD.left}
            y1={PAD.top}
            x2={PAD.left}
            y2={PAD.top + PH}
            stroke="#334155"
          />
          {xTicks.map((t) => (
            <text
              key={`tx${t}`}
              x={tx(t)}
              y={PAD.top + PH + 16}
              textAnchor="middle"
              fill="#475569"
              fontSize={10}
            >
              {t}
            </text>
          ))}
          {yTicks.map((t) => (
            <text
              key={`ty${t}`}
              x={PAD.left - 7}
              y={ty(t) + 4}
              textAnchor="end"
              fill="#475569"
              fontSize={10}
            >
              {t}
            </text>
          ))}
          <text
            x={PAD.left + PW / 2}
            y={H - 3}
            textAnchor="middle"
            fill="#64748b"
            fontSize={11}
          >
            Hours Studied
          </text>
          <text
            x={13}
            y={PAD.top + PH / 2}
            transform={`rotate(-90,13,${PAD.top + PH / 2})`}
            textAnchor="middle"
            fill="#64748b"
            fontSize={11}
          >
            Score
          </text>
          {/* mean line */}
          {stats && (
            <>
              <line
                x1={PAD.left}
                y1={ty(stats.meanY)}
                x2={PAD.left + PW}
                y2={ty(stats.meanY)}
                stroke="#334155"
                strokeDasharray="5 3"
              />
              <text
                x={PAD.left + PW - 2}
                y={ty(stats.meanY) - 3}
                textAnchor="end"
                fill="#475569"
                fontSize={9}
              >
                mean
              </text>
            </>
          )}
          {/* residual sticks */}
          {stats &&
            data.map((d) => {
              const py = stats.slope * d.x + stats.intercept;
              return (
                <line
                  key={`rs${d.id}`}
                  x1={tx(d.x)}
                  y1={ty(d.y)}
                  x2={tx(d.x)}
                  y2={ty(py)}
                  stroke="#60a5fa"
                  strokeOpacity={0.2}
                  strokeWidth={1.5}
                />
              );
            })}
          {/* regression line */}
          {stats && (
            <line
              x1={tx(X_MIN)}
              y1={ty(ly1)}
              x2={tx(X_MAX)}
              y2={ty(ly2)}
              stroke={rc}
              strokeWidth={2.5}
            />
          )}
          {/* dots */}
          {data.map((d) => (
            <circle
              key={d.id}
              cx={tx(d.x)}
              cy={ty(d.y)}
              r={7}
              fill="#60a5fa"
              stroke="#0f172a"
              strokeWidth={1.5}
              style={{ cursor: 'grab' }}
              onMouseDown={onDown(d.id)}
              onTouchStart={onDown(d.id)}
            />
          ))}
        </svg>
      </div>

      {/* ── Residual plot ── */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: '1rem',
          padding: '0.9rem',
          width: '100%',
          maxWidth: '620px',
          border: `1px solid ${hc}44`,
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            color: '#64748b',
            marginBottom: '0.4rem',
            textAlign: 'center',
          }}
        >
          Residual Plot &nbsp;·&nbsp;{' '}
          <span style={{ color: hc, transition: 'color 0.3s' }}>
            {heteroLabel(hScore)}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${RW} ${RH}`}
          style={{ width: '100%', userSelect: 'none' }}
        >
          {/* grid */}
          {xTicks.map((t) => (
            <line
              key={`rgx${t}`}
              x1={rToX(t)}
              y1={RPAD.top}
              x2={rToX(t)}
              y2={RPAD.top + RPH}
              stroke="#1e3a5f"
              strokeDasharray="4 3"
            />
          ))}
          {[-rMax * 0.6, -rMax * 0.3, 0, rMax * 0.3, rMax * 0.6].map((t) => (
            <line
              key={`rgy${t}`}
              x1={RPAD.left}
              y1={rToY(t)}
              x2={RPAD.left + RPW}
              y2={rToY(t)}
              stroke="#1e3a5f"
              strokeDasharray="4 3"
            />
          ))}
          {/* axes */}
          <line
            x1={RPAD.left}
            y1={RPAD.top + RPH}
            x2={RPAD.left + RPW}
            y2={RPAD.top + RPH}
            stroke="#334155"
          />
          <line
            x1={RPAD.left}
            y1={RPAD.top}
            x2={RPAD.left}
            y2={RPAD.top + RPH}
            stroke="#334155"
          />
          {/* zero line */}
          <line
            x1={RPAD.left}
            y1={rToY(0)}
            x2={RPAD.left + RPW}
            y2={rToY(0)}
            stroke="#475569"
            strokeDasharray="6 3"
          />
          <text
            x={RPAD.left + RPW - 2}
            y={rToY(0) - 3}
            textAnchor="end"
            fill="#475569"
            fontSize={9}
          >
            0
          </text>
          {/* axis labels */}
          {xTicks.map((t) => (
            <text
              key={`rtx${t}`}
              x={rToX(t)}
              y={RPAD.top + RPH + 14}
              textAnchor="middle"
              fill="#475569"
              fontSize={10}
            >
              {t}
            </text>
          ))}
          <text
            x={RPAD.left + RPW / 2}
            y={RH - 2}
            textAnchor="middle"
            fill="#64748b"
            fontSize={11}
          >
            Fitted Values
          </text>
          <text
            x={12}
            y={RPAD.top + RPH / 2}
            transform={`rotate(-90,12,${RPAD.top + RPH / 2})`}
            textAnchor="middle"
            fill="#64748b"
            fontSize={11}
          >
            Residual
          </text>
          {/* envelope lines to show spread — draw light fan guide */}
          {stats &&
            (() => {
              // fit a simple line through |resid| vs fitted to show the trend
              const abs = stats.residuals.map((r) => ({
                x: r.fitted,
                y: Math.abs(r.resid),
              }));
              const n = abs.length;
              const mx = abs.reduce((s, a) => s + a.x, 0) / n,
                my = abs.reduce((s, a) => s + a.y, 0) / n;
              const sl =
                abs.reduce((s, a) => s + (a.x - mx) * (a.y - my), 0) /
                (abs.reduce((s, a) => s + (a.x - mx) ** 2, 0) || 1);
              const ic = my - sl * mx;
              const ex1 = Math.max(...abs.map((a) => a.x)),
                ex0 = Math.min(...abs.map((a) => a.x));
              const ey1 = sl * ex1 + ic,
                ey0 = sl * ex0 + ic;
              return (
                <g opacity={0.35}>
                  <line
                    x1={rToX(ex0)}
                    y1={rToY(ey0)}
                    x2={rToX(ex1)}
                    y2={rToY(ey1)}
                    stroke={hc}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <line
                    x1={rToX(ex0)}
                    y1={rToY(-ey0)}
                    x2={rToX(ex1)}
                    y2={rToY(-ey1)}
                    stroke={hc}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                </g>
              );
            })()}
          {/* residual dots */}
          {stats &&
            stats.residuals.map((r, i) => (
              <circle
                key={i}
                cx={rToX(r.fitted)}
                cy={rToY(r.resid)}
                r={5.5}
                fill={Math.abs(r.resid) > rMax * 0.55 ? '#f87171' : '#60a5fa'}
                stroke="#0f172a"
                strokeWidth={1.2}
                opacity={0.9}
              />
            ))}
        </svg>
      </div>

      <button
        onClick={() => regenerate(selected)}
        style={{
          marginTop: '1.1rem',
          padding: '0.4rem 1.3rem',
          background: 'transparent',
          border: '1px solid #334155',
          borderRadius: '999px',
          color: '#64748b',
          fontFamily: 'inherit',
          fontSize: '0.82rem',
          cursor: 'pointer',
        }}
      >
        ↻ Regenerate
      </button>
    </div>
  );
}
