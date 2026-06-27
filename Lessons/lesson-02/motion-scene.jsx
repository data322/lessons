// motion-scene.jsx — "Motion along a straight line" explainer.
// Reads the timeline engine globals from animations.jsx (loaded first).
const { Stage, Sprite, useSprite, useTime, Easing, interpolate, animate, clamp } = window;

// ── Palette (Physics Lessons design system) ──────────────────────────────────
const RED   = '#1a5276';   // --color-primary       (structural accent)
const BRT   = '#d4ac0d';   // --color-accent         (positive emphasis)
const INK   = '#2c2c2c';   // --color-text
const INK2  = '#6b7280';   // --color-muted
const GRAY  = '#9ca3af';   // mid-grey
const LIGHT = '#d1d5db';   // --color-border
const FAINT = '#e5e7eb';   // grid lines
const CREAM = '#f9f9f7';   // --color-bg
const BLUE  = '#2471a3';   // --color-primary-light  (negative direction)
const SANS  = "'Source Sans 3', system-ui, sans-serif";
const SERIF = "'Playfair Display', Georgia, serif";

// ── Tiny timing helpers ──────────────────────────────────────────────────────
const E = Easing, IO = Easing.easeInOutCubic, OUT = Easing.easeOutCubic;
function win(lt, from, to, fin = 0.4, fout = 0.4) {
  if (lt < from || lt > to) return 0;
  if (lt < from + fin) return clamp((lt - from) / fin, 0, 1);
  if (lt > to - fout) return clamp((to - lt) / fout, 0, 1);
  return 1;
}
function reveal(lt, from, dur = 0.5, ease = OUT) {
  const t = ease(clamp((lt - from) / dur, 0, 1));
  return { o: t, ty: (1 - t) * 14 };
}
function frameOpacity(lt, dur, fin = 0.5, fout = 0.55) {
  if (lt < fin) return clamp(lt / fin, 0, 1);
  if (lt > dur - fout) return clamp((dur - lt) / fout, 0, 1);
  return 1;
}
const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

// ── SVG arrow (vector) ───────────────────────────────────────────────────────
function Arrow({ x1, y1, x2, y2, color = INK, w = 3, head = 12, dash, opacity = 1 }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const hh = Math.min(head, len);
  const bx = x2 - hh * Math.cos(ang), by = y2 - hh * Math.sin(ang);
  const lx = bx - hh * 0.62 * Math.cos(ang - Math.PI / 2), ly = by - hh * 0.62 * Math.sin(ang - Math.PI / 2);
  const rx = bx - hh * 0.62 * Math.cos(ang + Math.PI / 2), ry = by - hh * 0.62 * Math.sin(ang + Math.PI / 2);
  return (
    <g opacity={opacity}>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} />
      <polygon points={`${x2},${y2} ${lx},${ly} ${rx},${ry}`} fill={color} />
    </g>
  );
}

// ── Eyebrow / section label ──────────────────────────────────────────────────
function Eyebrow({ n, label, o = 1 }) {
  return (
    <div style={{ position: 'absolute', left: 80, top: 52, opacity: o, display: 'flex', alignItems: 'center', gap: 14, willChange: 'opacity' }}>
      <span style={{ font: `800 15px ${SANS}`, letterSpacing: '.18em', color: RED }}>{n}</span>
      <span style={{ width: 26, height: 2, background: RED }} />
      <span style={{ font: `800 15px ${SANS}`, letterSpacing: '.18em', color: INK }}>{label}</span>
    </div>
  );
}

// ── Caption band ─────────────────────────────────────────────────────────────
function Captions({ lt, items, y = 632 }) {
  return (
    <React.Fragment>
      {items.map((it, i) => {
        const o = win(lt, it.from, it.to, 0.42, 0.4);
        if (o <= 0.001) return null;
        return (
          <div key={i} style={{
            position: 'absolute', left: 80, right: 80, top: y, opacity: o,
            display: 'flex', alignItems: 'flex-start', gap: 16, willChange: 'opacity',
          }}>
            <span style={{ flex: 'none', width: 13, height: 13, background: RED, marginTop: 8 }} />
            <span style={{ font: `400 26px/1.34 ${SANS}`, color: INK, letterSpacing: '-0.011em' }}>
              {it.text}
            </span>
          </div>
        );
      })}
    </React.Fragment>
  );
}

// ── Equation panel (serif, red side-bar) ─────────────────────────────────────
function EqPanel({ x, y, lt, from, children, align = 'left', bg = '#FFFFFF' }) {
  const { o, ty } = reveal(lt, from, 0.5);
  const fade = typeof arguments[0].fadeAt === 'number' ? win(lt, from, arguments[0].fadeAt, 0.5, 0.4) : o;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, opacity: fade, transform: `translateY(${ty}px)`,
      transformOrigin: align === 'center' ? 'top center' : 'top left',
      ...(align === 'center' ? { translate: '-50% 0' } : null),
      borderLeft: `4px solid ${RED}`, padding: '14px 26px', background: bg, willChange: 'opacity, transform',
    }}>
      {children}
    </div>
  );
}

// Math bits
const I = ({ children }) => <span style={{ fontStyle: 'italic' }}>{children}</span>;
function Frac({ n, d, color = INK, size }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', verticalAlign: 'middle', margin: '0 .32em', fontSize: size }}>
      <span style={{ padding: '0 .45em .06em' }}>{n}</span>
      <span style={{ borderTop: `2px solid ${color}`, padding: '.08em .45em 0', width: '100%', textAlign: 'center' }}>{d}</span>
    </span>
  );
}

// curve sampling
function sample(fn, t0, t1, n) {
  const p = [];
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; p.push([t, fn(t)]); }
  return p;
}
function ptsStr(arr, xf, yf, frac = 1) {
  const n = Math.max(1, Math.floor((arr.length - 1) * clamp(frac, 0, 1)));
  let s = '';
  for (let i = 0; i <= n; i++) s += `${xf(arr[i][0]).toFixed(1)},${yf(arr[i][1]).toFixed(1)} `;
  return s.trim();
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 0 — TITLE
// ═════════════════════════════════════════════════════════════════════════════
function SceneTitle() {
  const { localTime: lt, duration } = useSprite();
  const fo = frameOpacity(lt, duration, 0.6, 0.6);
  const baseY = 432;
  const lineFrac = E.easeInOutQuart(clamp((lt - 0.2) / 1.3, 0, 1));
  const x0 = 150, x1 = 1130;
  const lineX = x0 + (x1 - x0) * lineFrac;
  const dotT = E.easeInOutCubic(clamp((lt - 0.5) / 2.4, 0, 1));
  const dotX = x0 + (640 - x0) * dotT + (dotT) * 0; // travels to center-ish
  const dotXFinal = x0 + (x1 - x0) * 0.5;
  const dx = x0 + (dotXFinal - x0) * dotT;
  const tEyebrow = reveal(lt, 0.9, 0.6);
  const tTitle = reveal(lt, 1.3, 0.7);
  const tSub = reveal(lt, 2.0, 0.7);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fo }}>
      <svg width="1280" height="720" style={{ position: 'absolute', inset: 0 }}>
        <line x1={x0} y1={baseY} x2={lineX} y2={baseY} stroke={LIGHT} strokeWidth="2" />
        {/* origin tick */}
        {lineFrac > 0.45 && <line x1={dotXFinal} y1={baseY - 9} x2={dotXFinal} y2={baseY + 9} stroke={GRAY} strokeWidth="2" opacity={clamp((lineFrac - 0.45) * 4, 0, 1)} />}
        {lt > 0.5 && <circle cx={dx} cy={baseY} r="11" fill={RED} />}
        {lt > 0.5 && <circle cx={dx} cy={baseY} r="11" fill="none" stroke={RED} strokeWidth="2" opacity="0.25" />}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 226, textAlign: 'center', opacity: tEyebrow.o, transform: `translateY(${tEyebrow.ty}px)` }}>
        <span style={{ font: `800 16px ${SANS}`, letterSpacing: '.26em', color: RED }}>INTRODUCTORY&nbsp;&nbsp;MECHANICS · KINEMATICS</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 262, textAlign: 'center', opacity: tTitle.o, transform: `translateY(${tTitle.ty}px)` }}>
        <span style={{ font: `700 92px ${SANS}`, letterSpacing: '-0.035em', color: INK }}>Motion in a straight line</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, textAlign: 'center', opacity: tSub.o, transform: `translateY(${tSub.ty}px)` }}>
        <span style={{ font: `400 25px ${SERIF}`, color: INK2, letterSpacing: '0' }}>
          Position &nbsp;·&nbsp; Displacement &nbsp;·&nbsp; Velocity &nbsp;·&nbsp; the calculus of the <I>x</I>–<I>t</I> graph
        </span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 1 — POSITION
// ═════════════════════════════════════════════════════════════════════════════
function ScenePosition() {
  const { localTime: lt, duration } = useSprite();
  const fo = frameOpacity(lt, duration);
  const vmin = -4, vmax = 9, x0 = 120, x1 = 1160, axisY = 348;
  const xToPx = (v) => x0 + (v - vmin) / (vmax - vmin) * (x1 - x0);
  const ticks = []; for (let v = vmin; v <= vmax; v++) ticks.push(v);
  const drawFrac = E.easeInOutQuart(clamp(lt / 1.1, 0, 1));
  const lineX = x0 + (x1 - x0) * drawFrac;

  // dot position: 5 (appear) -> hold -> move to -3 -> hold
  const pos = interpolate([1.3, 8.5, 10.5, 21], [5, 5, -3, -3], [IO, IO, IO])(lt);
  const dotPx = xToPx(pos);
  const dotIn = clamp((lt - 1.3) / 0.5, 0, 1);
  const showCoord = win(lt, 3.0, 21, 0.5, 0.0);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fo }}>
      <Eyebrow n="01" label="POSITION" />
      <svg width="1280" height="720" style={{ position: 'absolute', inset: 0 }}>
        {/* axis */}
        <line x1={x0} y1={axisY} x2={lineX} y2={axisY} stroke={INK} strokeWidth="2.5" />
        {drawFrac > 0.97 && <Arrow x1={x1 - 40} y1={axisY} x2={x1 + 6} y2={axisY} color={INK} w={2.5} head={13} />}
        {/* ticks */}
        {ticks.map((v) => {
          const px = xToPx(v); const o = clamp((drawFrac - (px - x0) / (x1 - x0)) * 6, 0, 1);
          const isO = v === 0;
          return (
            <g key={v} opacity={o}>
              <line x1={px} y1={axisY - (isO ? 13 : 8)} x2={px} y2={axisY + (isO ? 13 : 8)} stroke={isO ? RED : GRAY} strokeWidth={isO ? 2.5 : 1.5} />
              <text x={px} y={axisY + 34} textAnchor="middle" fontFamily={SANS} fontSize="16" fontWeight={isO ? 800 : 500} fill={isO ? RED : INK2}>{v}</text>
            </g>
          );
        })}
        <text x={xToPx(0)} y={axisY - 24} textAnchor="middle" fontFamily={SANS} fontSize="15" fontWeight="800" fill={RED} opacity={clamp(drawFrac * 2 - 0.6, 0, 1)}>O</text>
        <text x={x1 + 2} y={axisY - 18} textAnchor="end" fontFamily={SERIF} fontStyle="italic" fontSize="22" fill={INK2} opacity={clamp(drawFrac * 2 - 1, 0, 1)}>x (m)</text>

        {/* coordinate vector from origin to dot */}
        {showCoord > 0.01 && (
          <g opacity={showCoord}>
            <Arrow x1={xToPx(0)} y1={axisY - 46} x2={dotPx} y2={axisY - 46} color={pos >= 0 ? RED : BLUE} w={3} head={12} />
          </g>
        )}

        {/* particle */}
        {dotIn > 0 && (
          <g>
            <line x1={dotPx} y1={axisY} x2={dotPx} y2={axisY - 46} stroke={LIGHT} strokeWidth="1.5" strokeDasharray="4 4" opacity={dotIn * 0.9} />
            <circle cx={dotPx} cy={axisY} r={12 * (0.4 + 0.6 * E.easeOutBack(dotIn))} fill={RED} />
            <circle cx={dotPx} cy={axisY} r="12" fill="none" stroke={RED} strokeWidth="2" opacity={0.22 * dotIn} />
          </g>
        )}
      </svg>

      {/* live coordinate label above the dot */}
      {dotIn > 0.4 && (
        <div style={{ position: 'absolute', left: dotPx, top: axisY - 116, transform: 'translateX(-50%)', opacity: clamp((lt - 1.6) / 0.5, 0, 1) * frameOpacity(lt, duration) }}>
          <div style={{ font: `600 27px ${SERIF}`, color: INK, whiteSpace: 'nowrap', textAlign: 'center' }}>
            <I>x</I> = {pos >= 0 ? '+' : '−'}{Math.abs(Math.round(pos))} m
          </div>
        </div>
      )}

      <Captions lt={lt} items={[
        { from: 0.8, to: 6.6, text: 'Position x is simply where an object sits along the line.' },
        { from: 6.6, to: 12.6, text: 'It is measured from a chosen origin O — and it carries a sign for direction.' },
        { from: 12.6, to: 21, text: 'Left of the origin, position is negative. But where it is doesn’t yet tell us how it moves.' },
      ]} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 2 — DISPLACEMENT
// ═════════════════════════════════════════════════════════════════════════════
function SceneDisplacement() {
  const { localTime: lt, duration } = useSprite();
  const fo = frameOpacity(lt, duration);
  const vmin = -1, vmax = 10, x0 = 120, x1 = 1160, axisY = 360;
  const xToPx = (v) => x0 + (v - vmin) / (vmax - vmin) * (x1 - x0);
  const ticks = []; for (let v = vmin; v <= vmax; v++) ticks.push(v);

  // motion: start 2 -> 7 (fwd) -> 4 (back)
  const pos = interpolate([0, 2.6, 5.0, 11.5, 14.5, 28], [2, 2, 7, 7, 4, 4], [IO, IO, IO, IO, IO])(lt);
  const dotPx = xToPx(pos);
  const xi = 2, xf_first = 7, xf_final = 4;

  // displacement arrow head follows the dot during first move; settles
  const arrowHead = interpolate([2.6, 5.0, 11.5, 14.5, 28], [2, 7, 7, 4, 4], [IO, IO, IO, IO])(lt);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fo }}>
      <Eyebrow n="02" label="DISPLACEMENT" />
      <svg width="1280" height="720" style={{ position: 'absolute', inset: 0 }}>
        <line x1={x0} y1={axisY} x2={x1} y2={axisY} stroke={INK} strokeWidth="2.5" />
        <Arrow x1={x1 - 40} y1={axisY} x2={x1 + 6} y2={axisY} color={INK} w={2.5} head={13} />
        {ticks.map((v) => {
          const px = xToPx(v); const isO = v === 0;
          return (
            <g key={v}>
              <line x1={px} y1={axisY - (isO ? 12 : 8)} x2={px} y2={axisY + (isO ? 12 : 8)} stroke={isO ? RED : GRAY} strokeWidth={isO ? 2.5 : 1.5} />
              <text x={px} y={axisY + 34} textAnchor="middle" fontFamily={SANS} fontSize="16" fontWeight={isO ? 800 : 500} fill={isO ? RED : INK2}>{v}</text>
            </g>
          );
        })}
        <text x={xToPx(0)} y={axisY - 22} textAnchor="middle" fontFamily={SANS} fontSize="14" fontWeight="800" fill={RED}>O</text>
        <text x={x1 + 2} y={axisY - 18} textAnchor="end" fontFamily={SERIF} fontStyle="italic" fontSize="22" fill={INK2}>x (m)</text>

        {/* start ghost marker at x_i */}
        <g opacity={win(lt, 0.5, 28, 0.5, 0)}>
          <circle cx={xToPx(xi)} cy={axisY} r="6" fill="none" stroke={GRAY} strokeWidth="2" />
          <text x={xToPx(xi)} y={axisY + 60} textAnchor="middle" fontFamily={SERIF} fontSize="20" fontStyle="italic" fill={INK2}>x</text>
          <text x={xToPx(xi) + 9} y={axisY + 65} textAnchor="middle" fontFamily={SERIF} fontSize="13" fill={INK2}>i</text>
        </g>

        {/* displacement arrow (start -> head) */}
        {lt > 2.6 && Math.abs(arrowHead - xi) > 0.05 && (
          <Arrow x1={xToPx(xi)} y1={axisY - 52} x2={xToPx(arrowHead)} y2={axisY - 52} color={arrowHead >= xi ? RED : BLUE} w={3.5} head={13} opacity={win(lt, 2.6, 28, 0.4, 0)} />
        )}

        {/* particle */}
        <circle cx={dotPx} cy={axisY} r="12" fill={RED} />
        <circle cx={dotPx} cy={axisY} r="12" fill="none" stroke={RED} strokeWidth="2" opacity="0.22" />
      </svg>

      {/* equation: first move */}
      <EqPanel x={364} y={150} lt={lt} from={5.3} fadeAt={11.0}>
        <div style={{ font: `400 36px ${SERIF}`, color: INK, whiteSpace: 'nowrap' }}>
          Δ<I>x</I> = <I>x</I><sub>f</sub> − <I>x</I><sub>i</sub> = 7 − 2 = <span style={{ color: RED, fontWeight: 600 }}>+5 m</span>
        </div>
      </EqPanel>

      {/* equation: round-trip distinction */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 150, opacity: win(lt, 15.5, 28, 0.5, 0.5) }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
          <div style={{ borderLeft: `4px solid ${RED}`, padding: '14px 26px', background: '#FFFFFF' }}>
            <div style={{ font: `700 13px ${SANS}`, letterSpacing: '.16em', color: RED, marginBottom: 6 }}>DISPLACEMENT</div>
            <div style={{ font: `400 32px ${SERIF}`, color: INK, whiteSpace: 'nowrap' }}>Δ<I>x</I> = 4 − 2 = <span style={{ color: RED, fontWeight: 600 }}>+2 m</span></div>
          </div>
          <div style={{ borderLeft: `4px solid ${GRAY}`, padding: '14px 26px', background: '#FFFFFF' }}>
            <div style={{ font: `700 13px ${SANS}`, letterSpacing: '.16em', color: GRAY, marginBottom: 6 }}>DISTANCE TRAVELLED</div>
            <div style={{ font: `400 32px ${SERIF}`, color: INK, whiteSpace: 'nowrap' }}>5 + 3 = <span style={{ color: INK, fontWeight: 600 }}>8 m</span></div>
          </div>
        </div>
      </div>

      <Captions lt={lt} items={[
        { from: 1.0, to: 5.2, text: 'Displacement Δx is the signed change in position: where you ended up minus where you started.' },
        { from: 5.4, to: 10.6, text: 'It is a vector: the sign points the way. Here, +5 m to the right.' },
        { from: 11.2, to: 15.4, text: 'Now send it forward, then partway back.' },
        { from: 15.6, to: 28, text: 'Displacement counts only start → finish. Distance counts the whole path.' },
      ]} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 3 — THE POSITION-TIME GRAPH  (bridge: number line → x-t graph)
// ═════════════════════════════════════════════════════════════════════════════
function SceneXtGraph() {
  const { localTime: lt, duration } = useSprite();
  const fo = frameOpacity(lt, duration);

  // Left panel — physical number line
  const LP_L = 90, LP_R = 570, LP_Y = 400, LP_XMAX = 9;
  const lpX = (x) => LP_L + x / LP_XMAX * (LP_R - LP_L);

  // Right panel — x-t graph
  const RP_L = 690, RP_R = 1190, RP_T = 130, RP_B = 570;
  const RP_TMAX = 6, RP_XMAX = 9;
  const rpT = (t) => RP_L + t / RP_TMAX * (RP_R - RP_L);
  const rpX = (x) => RP_B - x / RP_XMAX * (RP_B - RP_T);

  const fA = (t) => 1.5 * t;          // constant v = 1.5 m/s
  const fB = (t) => 0.25 * t * t;     // accelerating (same as later scenes)
  const aPts = sample(fA, 0, RP_TMAX, 80);
  const bPts = sample(fB, 0, RP_TMAX, 80);

  const axO  = clamp((lt - 0.2) / 0.8, 0, 1);
  const tA   = interpolate([1.5, 6.5], [0, RP_TMAX], [E.linear])(lt);
  const tB   = interpolate([12.5, 18.5], [0, RP_TMAX], [E.linear])(lt);
  const alphaA = win(lt, 1.2, 13.0, 0.5, 1.5);
  const alphaB = win(lt, 12.0, 27.5, 1.5, 0.5);
  const triO   = win(lt, 7.0, 12.5, 0.5, 0.8);
  const nowO   = win(lt, 1.5, 7.5, 0.3, 1.0);
  const annotB = win(lt, 17.0, 27.5, 0.5, 0.5);

  const gticks = [0,1,2,3,4,5,6];
  const gxs    = [0,3,6,9];

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fo }}>
      <Eyebrow n="03" label="THE POSITION-TIME GRAPH" />
      <svg width="1280" height="720" style={{ position: 'absolute', inset: 0 }}>

        {/* panel divider */}
        <line x1={630} y1={70} x2={630} y2={650} stroke={LIGHT} strokeWidth="1.5" strokeDasharray="6 5" opacity={axO} />

        {/* ── LEFT: physical number line ── */}
        <line x1={LP_L} y1={LP_Y} x2={LP_L + (LP_R - LP_L) * axO} y2={LP_Y} stroke={INK} strokeWidth="2.5" />
        {axO > 0.95 && <Arrow x1={LP_R - 30} y1={LP_Y} x2={LP_R + 10} y2={LP_Y} color={INK} w={2.5} head={12} />}
        {[0,2,4,6,8].map((v) => (
          <g key={v} opacity={axO}>
            <line x1={lpX(v)} y1={LP_Y - 8} x2={lpX(v)} y2={LP_Y + 8} stroke={v === 0 ? RED : GRAY} strokeWidth={v === 0 ? 2.5 : 1.5} />
            <text x={lpX(v)} y={LP_Y + 28} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={INK2}>{v}</text>
          </g>
        ))}
        <text x={LP_R + 8} y={LP_Y + 6} fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={INK2} opacity={axO}>x (m)</text>

        {/* Part A dot */}
        {alphaA > 0.001 && (
          <circle cx={lpX(Math.min(fA(tA), LP_XMAX))} cy={LP_Y} r="12" fill={RED} opacity={alphaA} />
        )}
        {/* Part B dot */}
        {alphaB > 0.001 && (
          <circle cx={lpX(Math.min(fB(tB), LP_XMAX))} cy={LP_Y} r="12" fill={RED} opacity={alphaB} />
        )}

        {/* ── RIGHT: x-t graph ── */}
        {gticks.map((t) => <line key={'gt'+t} x1={rpT(t)} y1={RP_T} x2={rpT(t)} y2={RP_B} stroke={FAINT} strokeWidth="1" opacity={axO} />)}
        {gxs.map((x)   => <line key={'gx'+x} x1={RP_L} y1={rpX(x)} x2={RP_R} y2={rpX(x)} stroke={FAINT} strokeWidth="1" opacity={axO} />)}
        <line x1={RP_L} y1={RP_B} x2={RP_L + (RP_R - RP_L) * axO} y2={RP_B} stroke={INK} strokeWidth="2.5" />
        <line x1={RP_L} y1={RP_B} x2={RP_L} y2={RP_B - (RP_B - RP_T) * axO} stroke={INK} strokeWidth="2.5" />
        {axO > 0.95 && <Arrow x1={RP_R - 30} y1={RP_B} x2={RP_R + 14} y2={RP_B} color={INK} w={2.5} head={12} />}
        {axO > 0.95 && <Arrow x1={RP_L} y1={RP_T + 30} x2={RP_L} y2={RP_T - 14} color={INK} w={2.5} head={12} />}
        {gticks.map((t) => <text key={'lt'+t} x={rpT(t)} y={RP_B + 24} textAnchor="middle" fontFamily={SANS} fontSize="14" fill={INK2} opacity={axO}>{t}</text>)}
        {gxs.filter(x => x > 0).map((x) => <text key={'lx'+x} x={RP_L - 10} y={rpX(x) + 5} textAnchor="end" fontFamily={SANS} fontSize="14" fill={INK2} opacity={axO}>{x}</text>)}
        <text x={RP_R + 8} y={RP_B + 6} fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={INK2} opacity={axO}>t (s)</text>
        <text x={RP_L - 8} y={RP_T - 18} textAnchor="end" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={INK2} opacity={axO}>x (m)</text>

        {/* Part A — straight line */}
        {alphaA > 0.001 && tA > 0 && (
          <polyline points={ptsStr(aPts, rpT, rpX, tA / RP_TMAX)} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" opacity={alphaA} />
        )}
        {/* "now" cursor while Part A is drawing */}
        {nowO > 0.001 && tA > 0.05 && (
          <line x1={rpT(tA)} y1={RP_T} x2={rpT(tA)} y2={RP_B} stroke={RED} strokeWidth="1.5" strokeDasharray="4 4" opacity={nowO * 0.45} />
        )}

        {/* slope triangle (after Part A is drawn) */}
        {triO > 0.001 && (
          <g opacity={triO}>
            <line x1={rpT(2)} y1={rpX(fA(2))} x2={rpT(4)} y2={rpX(fA(2))} stroke={GRAY} strokeWidth="2" strokeDasharray="5 4" />
            <line x1={rpT(4)} y1={rpX(fA(2))} x2={rpT(4)} y2={rpX(fA(4))} stroke={GRAY} strokeWidth="2" strokeDasharray="5 4" />
            <text x={(rpT(2)+rpT(4))/2} y={rpX(fA(2))+22} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="18" fill={INK2}>Δt = 2 s</text>
            <text x={rpT(4)+14} y={(rpX(fA(2))+rpX(fA(4)))/2+6} fontFamily={SERIF} fontStyle="italic" fontSize="18" fill={INK2}>Δx = 3 m</text>
            <text x={rpT(3)} y={rpX(fA(3))-24} textAnchor="middle" fontFamily={SERIF} fontSize="20" fill={RED} fontWeight="600">slope = 1.5 m/s</text>
          </g>
        )}

        {/* Part B — parabola */}
        {alphaB > 0.001 && tB > 0 && (
          <polyline points={ptsStr(bPts, rpT, rpX, tB / RP_TMAX)} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" opacity={alphaB} />
        )}
        {/* tracer dot while Part B is drawing */}
        {alphaB > 0.001 && tB > 0 && tB < RP_TMAX - 0.1 && (
          <circle cx={rpT(tB)} cy={rpX(fB(tB))} r="8" fill={RED} opacity={alphaB} />
        )}

        {/* slow / steep callouts (Part B) */}
        {annotB > 0.001 && (
          <g opacity={annotB}>
            <line x1={rpT(1)} y1={rpX(fB(1))-14} x2={rpT(1)} y2={rpX(fB(1))-54} stroke={INK2} strokeWidth="1.5" />
            <text x={rpT(1)} y={rpX(fB(1))-62} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={INK2}>shallow → slow</text>
            <line x1={rpT(5)} y1={rpX(fB(5))-14} x2={rpT(5)} y2={rpX(fB(5))-54} stroke={INK2} strokeWidth="1.5" />
            <text x={rpT(5)} y={rpX(fB(5))-62} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={INK2}>steep → fast</text>
          </g>
        )}

      </svg>

      <Captions lt={lt} items={[
        { from: 0.8, to: 6.4, text: 'This graph is a record: each point says where the object was at each moment.' },
        { from: 7.0, to: 12.0, text: 'Constant speed draws a straight line. Its slope is the velocity: 1.5 m/s.' },
        { from: 12.5, to: 17.5, text: 'When speed changes, the line curves — steeper means the object is moving faster.' },
        { from: 17.8, to: 27.5, text: 'What is the velocity at a single instant — not over an interval, but right now?' },
      ]} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Shared x–t curve for velocity scenes:  x(t) = 0.25 t²   (so v = dx/dt = 0.5 t)
// ═════════════════════════════════════════════════════════════════════════════
const PX = { l: 250, r: 1075, t: 140, b: 500 };
const TMAX = 6, XMAX = 9;
const tPx = (t) => PX.l + t / TMAX * (PX.r - PX.l);
const xPy = (v) => PX.b - v / XMAX * (PX.b - PX.t);
const fx = (t) => 0.25 * t * t;
const curvePts = sample(fx, 0, TMAX, 120);

function GraphAxes({ lt, drawFrom = 0 }) {
  const a = clamp((lt - drawFrom) / 0.8, 0, 1);
  const gt = []; for (let t = 0; t <= TMAX; t++) gt.push(t);
  const gx = []; for (let v = 0; v <= XMAX; v += 1.5) gx.push(v);
  return (
    <g>
      {/* gridlines */}
      {gt.map((t) => <line key={'gt' + t} x1={tPx(t)} y1={PX.t} x2={tPx(t)} y2={PX.b} stroke={FAINT} strokeWidth="1" opacity={a} />)}
      {gx.map((v) => <line key={'gx' + v} x1={PX.l} y1={xPy(v)} x2={PX.r} y2={xPy(v)} stroke={FAINT} strokeWidth="1" opacity={a} />)}
      {/* axes */}
      <line x1={PX.l} y1={PX.b} x2={PX.l + (PX.r - PX.l) * a} y2={PX.b} stroke={INK} strokeWidth="2.5" />
      <line x1={PX.l} y1={PX.b} x2={PX.l} y2={PX.b - (PX.b - PX.t) * a} stroke={INK} strokeWidth="2.5" />
      {a > 0.95 && <Arrow x1={PX.r - 30} y1={PX.b} x2={PX.r + 14} y2={PX.b} color={INK} w={2.5} head={12} />}
      {a > 0.95 && <Arrow x1={PX.l} y1={PX.t + 30} x2={PX.l} y2={PX.t - 14} color={INK} w={2.5} head={12} />}
      {gt.map((t) => <text key={'lt' + t} x={tPx(t)} y={PX.b + 28} textAnchor="middle" fontFamily={SANS} fontSize="15" fill={INK2} opacity={a}>{t}</text>)}
      {gx.map((v) => <text key={'lx' + v} x={PX.l - 14} y={xPy(v) + 5} textAnchor="end" fontFamily={SANS} fontSize="15" fill={INK2} opacity={a}>{v}</text>)}
      <text x={PX.r + 6} y={PX.b + 6} fontFamily={SERIF} fontStyle="italic" fontSize="22" fill={INK2} opacity={a}>t (s)</text>
      <text x={PX.l - 6} y={PX.t - 22} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="22" fill={INK2} opacity={a}>x (m)</text>
    </g>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 3 — AVERAGE VELOCITY
// ═════════════════════════════════════════════════════════════════════════════
function SceneAvgVel() {
  const { localTime: lt, duration } = useSprite();
  const fo = frameOpacity(lt, duration);
  const curveFrac = E.easeInOutCubic(clamp((lt - 1.6) / 2.6, 0, 1));
  const tracerT = curveFrac * TMAX;

  // P1 fixed at t=1; P2 moves: 5 (appear) -> later slides to 3
  const t1 = 1;
  const t2 = interpolate([4.4, 14.5, 16.5, 30], [5, 5, 3, 3], [IO, IO, IO])(lt);
  const x1 = fx(t1), x2 = fx(t2);
  const slope = (x2 - x1) / (t2 - t1);
  const showPts = clamp((lt - 4.4) / 0.5, 0, 1);
  const showSec = clamp((lt - 5.4) / 0.6, 0, 1);
  const showTri = win(lt, 6.6, 30, 0.5, 0);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fo }}>
      <Eyebrow n="03" label="AVERAGE VELOCITY" />
      <svg width="1280" height="720" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <clipPath id="clip3"><rect x={PX.l} y={PX.t - 20} width={PX.r - PX.l} height={PX.b - PX.t + 20} /></clipPath>
        </defs>
        <GraphAxes lt={lt} drawFrom={0.2} />

        {/* curve */}
        {curveFrac > 0 && <polyline points={ptsStr(curvePts, tPx, xPy, curveFrac)} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
        {curveFrac > 0 && curveFrac < 1 && <circle cx={tPx(tracerT)} cy={xPy(fx(tracerT))} r="8" fill={RED} />}

        {/* rise/run triangle */}
        {showTri > 0.01 && (
          <g opacity={showTri}>
            <line x1={tPx(t1)} y1={xPy(x1)} x2={tPx(t2)} y2={xPy(x1)} stroke={GRAY} strokeWidth="2" strokeDasharray="6 5" />
            <line x1={tPx(t2)} y1={xPy(x1)} x2={tPx(t2)} y2={xPy(x2)} stroke={GRAY} strokeWidth="2" strokeDasharray="6 5" />
            <text x={(tPx(t1) + tPx(t2)) / 2} y={xPy(x1) + 26} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={INK2}>Δt</text>
            <text x={tPx(t2) + 16} y={(xPy(x1) + xPy(x2)) / 2 + 6} fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={INK2}>Δx</text>
          </g>
        )}

        {/* secant line (clipped) */}
        {showSec > 0.01 && (() => {
          const dpx = tPx(t2) - tPx(t1), dpy = xPy(x2) - xPy(x1);
          const ext = 1.6;
          const ax = tPx(t1) - dpx * ext, ay = xPy(x1) - dpy * ext;
          const bx = tPx(t2) + dpx * ext, by = xPy(x2) + dpy * ext;
          return <line x1={ax} y1={ay} x2={bx} y2={by} stroke={RED} strokeWidth="3" opacity={showSec} clipPath="url(#clip3)" />;
        })()}

        {/* points */}
        {showPts > 0 && (
          <g opacity={showPts}>
            <circle cx={tPx(t1)} cy={xPy(x1)} r="8" fill="#fff" stroke={INK} strokeWidth="3" />
            <circle cx={tPx(t2)} cy={xPy(x2)} r="8" fill={RED} />
            <text x={tPx(t1) - 14} y={xPy(x1) + 28} textAnchor="end" fontFamily={SERIF} fontSize="18" fill={INK2}>(t₁, x₁)</text>
            <text x={tPx(t2) - 14} y={xPy(x2) - 18} textAnchor="end" fontFamily={SERIF} fontSize="18" fill={RED}>(t₂, x₂)</text>
          </g>
        )}
      </svg>

      {/* equation panel */}
      <div style={{ position: 'absolute', left: 250, top: 560, opacity: win(lt, 8.0, 30, 0.5, 0.4) }}>
        <div style={{ borderLeft: `4px solid ${RED}`, padding: '12px 26px', background: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ font: `400 32px ${SERIF}`, color: INK }}>
            <I>v</I><sub>avg</sub> =
          </span>
          <Frac n={<span style={{ fontStyle: 'italic' }}>Δx</span>} d={<span style={{ fontStyle: 'italic' }}>Δt</span>} color={INK} />
          <span style={{ font: `400 32px ${SERIF}`, color: INK }}>=</span>
          <Frac n={<span>{f2(x2 - x1)}</span>} d={<span>{f1(t2 - t1)}</span>} color={INK} />
          <span style={{ font: `400 32px ${SERIF}`, color: INK }}>=&nbsp;</span>
          <span style={{ font: `600 27px ${SERIF}`, color: RED }}>{f2(slope)} m/s</span>
        </div>
      </div>

      <Captions lt={lt} items={[
        { from: 0.7, to: 4.2, text: 'Plot position against time. The slope of this graph is what we’re after.' },
        { from: 4.4, to: 8.0, text: 'Pick two instants. Average velocity is their displacement over their elapsed time.' },
        { from: 8.2, to: 13.8, text: 'Geometrically, that’s the slope of the straight line joining the two points — the secant.' },
        { from: 14.0, to: 30, text: 'Shrink the interval and the average changes. So what is the velocity at a single instant?' },
      ]} y={668} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 4 — INSTANTANEOUS VELOCITY
// ═════════════════════════════════════════════════════════════════════════════
function SceneInstVel() {
  const { localTime: lt, duration } = useSprite();
  const fo = frameOpacity(lt, duration);
  const tP = 3; const xP = fx(tP); // fixed point
  // Q slides from t=6 toward t=3 (Δt: 3 -> ~0.05) during lt 2.5 -> 9
  const dt = interpolate([2.2, 9.0], [3, 0.05], [E.easeInOutQuart])(lt);
  const tQ = tP + dt, xQ = fx(tQ);
  const secantSlope = (xQ - xP) / (tQ - tP); // = 1.5 + 0.25 dt
  const isTangentPhase = lt > 9.2;

  // After tangent established, sweep the tangent point along whole curve (lt 18->27)
  const sweepT = isTangentPhase && lt > 18 ? interpolate([18, 27], [3, 5.6], [IO])(lt) : tP;
  const tipT = lt > 18 ? sweepT : tP;
  const tipX = fx(tipT);
  const tangentSlope = 0.5 * tipT;

  const renderTangentAt = (t0) => {
    const x0v = fx(t0), m = 0.5 * t0; // data slope
    const dpxdt = (PX.r - PX.l) / TMAX, dpydx = -(PX.b - PX.t) / XMAX;
    const px0 = tPx(t0), py0 = xPy(x0v);
    const dirx = dpxdt, diry = m * dpydx;
    const L = 520;
    const nrm = Math.hypot(dirx, diry);
    const ux = dirx / nrm, uy = diry / nrm;
    return { x1: px0 - ux * L, y1: py0 - uy * L, x2: px0 + ux * L, y2: py0 + uy * L, px0, py0 };
  };

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fo }}>
      <Eyebrow n="04" label="INSTANTANEOUS VELOCITY" />
      <svg width="1280" height="720" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <clipPath id="clip4"><rect x={PX.l} y={PX.t - 20} width={PX.r - PX.l} height={PX.b - PX.t + 20} /></clipPath>
        </defs>
        <GraphAxes lt={lt} drawFrom={0.0} />
        <polyline points={ptsStr(curvePts, tPx, xPy, clamp(lt / 1.0, 0, 1))} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* secant shrinking */}
        {!isTangentPhase && lt > 2.2 && (() => {
          const dpx = tPx(tQ) - tPx(tP), dpy = xPy(xQ) - xPy(xP);
          const ext = 2.2; const ax = tPx(tP) - dpx * ext, ay = xPy(xP) - dpy * ext;
          const bx = tPx(tQ) + dpx * ext, by = xPy(xQ) + dpy * ext;
          return <line x1={ax} y1={ay} x2={bx} y2={by} stroke={RED} strokeWidth="2.5" opacity="0.85" clipPath="url(#clip4)" />;
        })()}

        {/* tangent line */}
        {isTangentPhase && (() => {
          const T = renderTangentAt(tipT);
          const o = clamp((lt - 9.2) / 0.5, 0, 1);
          return <line x1={T.x1} y1={T.y1} x2={T.x2} y2={T.y2} stroke={RED} strokeWidth="3.5" opacity={o} clipPath="url(#clip4)" />;
        })()}

        {/* dt bracket while shrinking */}
        {!isTangentPhase && lt > 2.2 && (
          <g opacity="0.9">
            <line x1={tPx(tP)} y1={PX.b + 8} x2={tPx(tQ)} y2={PX.b + 8} stroke={GRAY} strokeWidth="2" />
            <line x1={tPx(tP)} y1={PX.b + 4} x2={tPx(tP)} y2={PX.b + 12} stroke={GRAY} strokeWidth="2" />
            <line x1={tPx(tQ)} y1={PX.b + 4} x2={tPx(tQ)} y2={PX.b + 12} stroke={GRAY} strokeWidth="2" />
          </g>
        )}

        {/* fixed point P */}
        <circle cx={tPx(tipT)} cy={xPy(tipX)} r="9" fill={RED} />
        <text x={tPx(tP) - 16} y={xPy(xP) - 14} textAnchor="end" fontFamily={SERIF} fontSize="18" fill={INK} opacity={lt < 18 ? 1 : 0}>P (t = 3 s)</text>

        {/* Q point */}
        {!isTangentPhase && lt > 2.2 && (
          <circle cx={tPx(tQ)} cy={xPy(xQ)} r="8" fill="#fff" stroke={INK} strokeWidth="3" />
        )}
      </svg>

      {/* live Δt / slope readout (shrinking phase) */}
      {!isTangentPhase && lt > 2.4 && (
        <div style={{ position: 'absolute', left: 250, top: 556, opacity: win(lt, 2.4, 9.2, 0.4, 0.25), display: 'flex', gap: 26, alignItems: 'center' }}>
          <div style={{ borderLeft: `4px solid ${GRAY}`, padding: '10px 22px', background: '#fff' }}>
            <span style={{ font: `400 27px ${SERIF}`, color: INK }}>Δ<I>t</I> = {f2(dt)} s</span>
          </div>
          <div style={{ borderLeft: `4px solid ${RED}`, padding: '10px 22px', background: '#fff' }}>
            <span style={{ font: `400 27px ${SERIF}`, color: INK }}>slope = </span>
            <span style={{ font: `600 28px ${SERIF}`, color: RED }}>{f2(secantSlope)} m/s</span>
          </div>
        </div>
      )}

      {/* limit equation (tangent phase) */}
      {isTangentPhase && (
        <div style={{ position: 'absolute', left: 250, top: 556, opacity: clamp((lt - 9.4) / 0.6, 0, 1), display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ borderLeft: `4px solid ${RED}`, padding: '12px 26px', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: `400 30px ${SERIF}`, color: INK }}><I>v</I> =</span>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', font: `400 17px ${SERIF}`, color: INK2 }}>
              <span>lim</span><span style={{ fontSize: 15 }}>Δt → 0</span>
            </span>
            <Frac n={<span style={{ fontStyle: 'italic' }}>Δx</span>} d={<span style={{ fontStyle: 'italic' }}>Δt</span>} color={INK} />
            <span style={{ font: `400 30px ${SERIF}`, color: INK }}>=</span>
            <Frac n={<span style={{ fontStyle: 'italic' }}>dx</span>} d={<span style={{ fontStyle: 'italic' }}>dt</span>} color={INK} />
            {lt > 18 && <span style={{ font: `400 27px ${SERIF}`, color: INK }}>= 0.5<I>t</I></span>}
            <span style={{ font: `400 30px ${SERIF}`, color: INK }}>=&nbsp;</span>
            <span style={{ font: `600 27px ${SERIF}`, color: RED }}>{f2(tangentSlope)} m/s</span>
          </div>
        </div>
      )}

      <Captions lt={lt} items={[
        { from: 0.6, to: 2.4, text: 'Fix one instant — say t = 3 s — and bring the second point toward it.' },
        { from: 2.6, to: 9.1, text: 'As Δt shrinks, the secant pivots and its slope homes in on a single value.' },
        { from: 9.3, to: 17.6, text: 'In the limit Δt → 0 the secant becomes the tangent: v = dx/dt, the instantaneous velocity.' },
        { from: 17.8, to: 30, text: 'Slide along the curve and the tangent rotates: v = 0.5t, a different velocity at every instant.' },
      ]} y={668} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 5 — VELOCITY FROM A GRAPH    x(t) = 8 sin(πt/10),  v = 0.8π cos(πt/10)
// ═════════════════════════════════════════════════════════════════════════════
function SceneGraphRead() {
  const { localTime: lt, duration } = useSprite();
  const fo = frameOpacity(lt, duration);
  const L = 250, R = 1075;
  const TM = 10;
  const tpx = (t) => L + t / TM * (R - L);
  // top: position
  const Tt = 110, Tb = 300; const xmin = -1, xmax = 9;
  const xpy = (v) => Tb - (v - xmin) / (xmax - xmin) * (Tb - Tt);
  // bottom: velocity
  const Vt = 372, Vb = 552; const vmin = -3, vmax = 3;
  const vpy = (v) => (Vt + Vb) / 2 - v / vmax * ((Vb - Vt) / 2);
  const X = (t) => 8 * Math.sin(Math.PI * t / TM);
  const V = (t) => 0.8 * Math.PI * Math.cos(Math.PI * t / TM);
  const xPts = sample(X, 0, TM, 160);
  const vPts = sample(V, 0, TM, 160);

  const axA = clamp((lt - 0.2) / 0.8, 0, 1);
  const topDraw = clamp((lt - 0.6) / 1.0, 0, 1);
  // sweep builds v-t
  const sweep = interpolate([2.0, 6.5, 11.0], [0, TM / 2, TM], [E.easeOutSine, E.easeInSine])(lt);
  const sweepFrac = sweep / TM;
  const curT = sweep;
  const curV = V(curT), curX = X(curT);

  // tangent on top curve at sweep
  const tanSeg = (() => {
    const m = V(curT); const dpxdt = (R - L) / TM, dpydx = -(Tb - Tt) / (xmax - xmin);
    const dirx = dpxdt, diry = m * dpydx; const nrm = Math.hypot(dirx, diry);
    const ux = dirx / nrm, uy = diry / nrm; const len = 70;
    const px0 = tpx(curT), py0 = xpy(curX);
    return { x1: px0 - ux * len, y1: py0 - uy * len, x2: px0 + ux * len, y2: py0 + uy * len, px0, py0 };
  })();

  const ann = (from, to) => win(lt, from, to, 0.4, 0.4);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fo }}>
      <Eyebrow n="05" label="READING VELOCITY OFF THE GRAPH" />
      <svg width="1280" height="720" style={{ position: 'absolute', inset: 0 }}>
        {/* TOP plot: position */}
        <line x1={L} y1={Tb} x2={R} y2={Tb} stroke={INK} strokeWidth="2.5" opacity={axA} />
        <line x1={L} y1={Tt} x2={L} y2={Tb} stroke={INK} strokeWidth="2.5" opacity={axA} />
        <line x1={L} y1={xpy(0)} x2={R} y2={xpy(0)} stroke={LIGHT} strokeWidth="1.5" opacity={axA} />
        <text x={L - 12} y={Tt + 4} textAnchor="end" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={INK2} opacity={axA}>x</text>
        <text x={R + 8} y={Tb + 6} fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={INK2} opacity={axA}>t</text>
        {topDraw > 0 && <polyline points={ptsStr(xPts, tpx, xpy, 1)} fill="none" stroke={LIGHT} strokeWidth="2.5" />}
        {topDraw > 0 && <polyline points={ptsStr(xPts, tpx, xpy, sweepFrac)} fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />}

        {/* BOTTOM plot: velocity */}
        <line x1={L} y1={vpy(0)} x2={R} y2={vpy(0)} stroke={INK} strokeWidth="2.5" opacity={axA} />
        <line x1={L} y1={Vt} x2={L} y2={Vb} stroke={INK} strokeWidth="2.5" opacity={axA} />
        <text x={L - 12} y={Vt + 4} textAnchor="end" fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={INK2} opacity={axA}>v</text>
        <text x={R + 8} y={vpy(0) + 6} fontFamily={SERIF} fontStyle="italic" fontSize="20" fill={INK2} opacity={axA}>t</text>
        {/* shade pos/neg as it builds */}
        {sweepFrac > 0.001 && <polyline points={ptsStr(vPts, tpx, vpy, sweepFrac)} fill="none" stroke="#c0392b" strokeWidth="3.5" strokeLinecap="round" />}

        {/* sweep line */}
        {lt > 1.8 && lt < 11.4 && (
          <line x1={tpx(curT)} y1={Tt - 6} x2={tpx(curT)} y2={Vb + 6} stroke={GRAY} strokeWidth="1.5" strokeDasharray="5 5" />
        )}
        {/* tangent on top */}
        {lt > 1.8 && (
          <g>
            <line x1={tanSeg.x1} y1={tanSeg.y1} x2={tanSeg.x2} y2={tanSeg.y2} stroke={BLUE} strokeWidth="3" />
            <circle cx={tanSeg.px0} cy={tanSeg.py0} r="7" fill={INK} />
          </g>
        )}
        {/* moving dot on velocity curve */}
        {sweepFrac > 0.001 && lt < 11.4 && <circle cx={tpx(curT)} cy={vpy(curV)} r="7" fill="#c0392b" />}

        {/* t ticks */}
        {[0, 2, 4, 6, 8, 10].map((t) => (
          <g key={t} opacity={axA}>
            <text x={tpx(t)} y={Vb + 26} textAnchor="middle" fontFamily={SANS} fontSize="14" fill={INK2}>{t}</text>
          </g>
        ))}
      </svg>

      {/* annotations near the sweep */}
      <div style={{ position: 'absolute', left: tpx(1.5), top: 90, transform: 'translateX(-50%)', opacity: ann(2.6, 5.4), textAlign: 'center' }}>
        <span style={{ font: `700 18px ${SANS}`, color: RED }}>steep ↑ — moving forward, fast</span>
      </div>
      <div style={{ position: 'absolute', left: tpx(5), top: 90, transform: 'translateX(-50%)', opacity: ann(5.6, 8.0), textAlign: 'center' }}>
        <span style={{ font: `700 18px ${SANS}`, color: INK }}>flat — momentarily at rest, v = 0</span>
      </div>
      <div style={{ position: 'absolute', left: tpx(8.5), top: 90, transform: 'translateX(-50%)', opacity: ann(8.2, 11.2), textAlign: 'center' }}>
        <span style={{ font: `700 18px ${SANS}`, color: BLUE }}>↓ — moving backward, v &lt; 0</span>
      </div>

      {/* equation */}
      <div style={{ position: 'absolute', left: 250, top: 600, opacity: win(lt, 12.0, 23.5, 0.5, 0.45), display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ borderLeft: `4px solid ${RED}`, padding: '10px 24px', background: '#fff', display: 'flex', alignItems: 'center' }}>
          <span style={{ font: `400 28px ${SERIF}`, color: INK }}><I>v</I>(<I>t</I>) =</span>
          <Frac n={<span style={{ fontStyle: 'italic' }}>dx</span>} d={<span style={{ fontStyle: 'italic' }}>dt</span>} color={INK} />
          <span style={{ font: `400 24px ${SERIF}`, color: INK2 }}>: the slope of the position graph, instant by instant.</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 250, top: 600, opacity: win(lt, 24.0, 32, 0.5, 0.4) }}>
        <div style={{ borderLeft: `4px solid ${GRAY}`, padding: '10px 24px', background: '#fff' }}>
          <span style={{ font: `400 26px ${SERIF}`, color: INK }}>Over the full trip: displacement: <b style={{ color: RED }}>0</b>, distance travelled: <b>16 m</b>.</span>
        </div>
      </div>

      <Captions lt={lt} items={[
        { from: 0.6, to: 2.4, text: 'One last idea: read velocity straight off the position graph.' },
        { from: 8.5, to: 11.5, text: 'Below zero means moving in the opposite direction — velocity\'s sign is its direction.' },
      ]} y={636} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENE 6 — RECAP
// ═════════════════════════════════════════════════════════════════════════════
function SceneRecap() {
  const { localTime: lt, duration } = useSprite();
  const fo = frameOpacity(lt, duration, 0.6, 0.8);
  const rows = [
    { from: 0.6, sym: <span><I>x</I></span>, label: 'POSITION', desc: 'where it is, measured from an origin' },
    { from: 1.4, sym: <span>Δ<I>x</I> = <I>x</I><sub>f</sub> − <I>x</I><sub>i</sub></span>, label: 'DISPLACEMENT', desc: 'how the position changed — a signed vector' },
    { from: 2.2, sym: <span><I>v</I><sub>avg</sub> = <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Frac n={<span>Δ<I>x</I></span>} d={<span>Δ<I>t</I></span>} /></span></span>, label: 'AVERAGE VELOCITY', desc: 'displacement per unit time over an interval' },
    { from: 3.0, sym: <span><I>v</I> = <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Frac n={<span style={{ fontStyle: 'italic' }}>dx</span>} d={<span style={{ fontStyle: 'italic' }}>dt</span>} /></span></span>, label: 'INSTANTANEOUS VELOCITY', desc: 'the slope of the x–t graph, right now' },
  ];
  const tHead = reveal(lt, 0.2, 0.6);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: fo, background: '#f9f9f7' }}>
      <div style={{ position: 'absolute', left: 110, top: 96, opacity: tHead.o, transform: `translateY(${tHead.ty}px)`, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 40, height: 3, background: RED }} />
        <span style={{ font: `800 15px ${SANS}`, letterSpacing: '.2em', color: RED }}>THE WHOLE LANGUAGE OF MOTION</span>
      </div>
      <div style={{ position: 'absolute', left: 110, top: 150 }}>
        {rows.map((r, i) => {
          const rv = reveal(lt, r.from, 0.6);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 36, padding: '10px 0', borderBottom: i < 3 ? `1px solid ${FAINT}` : 'none', opacity: rv.o, transform: `translateY(${rv.ty}px)` }}>
              <div style={{ width: 300, font: `400 32px ${SERIF}`, color: INK }}>{r.sym}</div>
              <div>
                <div style={{ font: `800 13px ${SANS}`, letterSpacing: '.16em', color: RED, marginBottom: 4 }}>{r.label}</div>
                <div style={{ font: `400 19px ${SERIF}`, color: INK2 }}>{r.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', left: 110, right: 110, top: 638, opacity: reveal(lt, 4.4, 0.7).o }}>
        <span style={{ font: `300 30px ${SANS}`, color: INK, letterSpacing: '-0.02em' }}>
          Position, its change, and its rate of change — <span style={{ fontWeight: 700, color: RED }}>three ideas, one straight line.</span>
        </span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
function MotionScene() {
  return (
    <Stage width={1280} height={720} duration={201} background="#f9f9f7" persistKey="motion-line">
      <Sprite start={0}    end={8.2}>   <SceneTitle /></Sprite>
      <Sprite start={8.0}  end={30.3}>  <ScenePosition /></Sprite>
      <Sprite start={30.0} end={58.3}>  <SceneDisplacement /></Sprite>
      <Sprite start={58.0} end={87.0}>  <SceneXtGraph /></Sprite>
      <Sprite start={87.0} end={121.3}> <SceneAvgVel /></Sprite>
      <Sprite start={121.0} end={157.3}><SceneInstVel /></Sprite>
      <Sprite start={157.0} end={189.3}><SceneGraphRead /></Sprite>
      <Sprite start={189.0} end={201.0}><SceneRecap /></Sprite>
    </Stage>
  );
}
window.MotionScene = MotionScene;
