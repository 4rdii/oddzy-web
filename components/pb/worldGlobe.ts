import { geoArea, geoBounds, geoCentroid, geoDistance, geoEquirectangular, geoGraticule10, geoOrthographic, geoPath } from "d3";
import type { Feature, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { fa } from "@/lib/pb";
import { wVol, wVolS, type WC, type WM } from "@/lib/world";

/**
 * The «نقشهٔ جهان» globe, ported line for line from the design file
 * (PB World Map.html, "globe" + "interaction" sections; handoff §4).
 *
 * One canvas, orthographic projection, DPR ≤ 2. Land is a dot matrix whose
 * dots are NOT d3-projected: each carries cos/sin(lat) and lon, and draw()
 * rotates them by hand, batching every colour into one Path2D → one fill().
 * Countries are found through a 2048×1024 equirectangular raster with the
 * feature index encoded in RGB (+ checksum) — the same raster builds the dots
 * and answers pointer picks. This module is loaded with a dynamic import so
 * d3 never sits in front of the server-rendered page.
 *
 * React owns the state (metric, region, selection) and the panel; the engine
 * reads it through `getState` every frame and reports hover / taps back.
 */

export type GlobeState = { metric: "vol" | "risk"; region: string; sel: WC | null };

export type Region = { k: string; l: string; c?: [number, number]; z?: number; ids?: number[] };

export const REGIONS: Region[] = [
  { k: "all", l: "همهٔ جهان" },
  { k: "me", l: "خاورمیانه", c: [46, 29], z: 2.6, ids: [364, 376, 422, 760, 368, 682, 887, 792, 818, 634, 784, 512, 400] },
  { k: "eu", l: "اروپا و روسیه", c: [28, 50], z: 2, ids: [643, 804, 276, 250, 826, 616, 348, 642, 498, 112, 268, 51, 31] },
  { k: "am", l: "قارهٔ آمریکا", c: [-78, 18], z: 1.25, ids: [840, 124, 484, 862, 76, 32, 170, 192, 304] },
  { k: "as", l: "آسیا", c: [108, 28], z: 1.7, ids: [156, 158, 408, 410, 392, 586, 356, 4, 608] },
  { k: "af", l: "آفریقا", c: [22, 6], z: 1.6, ids: [729, 231, 706, 434, 566, 180, 818] },
];
const pad = (n: number) => String(n).padStart(3, "0");
const REG_SET: Record<string, Set<string> | null> = Object.fromEntries(
  REGIONS.map((r) => [r.k, r.ids ? new Set(r.ids.map(pad)) : null]),
);

/** Manual centroids for labels and fly-to (handoff §5: keep them). */
const CENT: Record<string, [number, number]> = { "840": [-98, 39], "643": [48, 56], "250": [2.5, 46.6], "124": [-100, 57], "304": [-41, 72], "376": [35, 31.3] };

export const PAL_D = ["243,181,58", "64,200,180", "110,168,255", "176,140,255", "255,132,100", "150,212,110", "240,122,190"];
export const PAL_L = ["214,146,0", "14,150,130", "45,106,208", "118,84,214", "214,84,52", "78,148,40", "196,62,140"];

type Colors = {
  gold: string; red: string; land: string; landDim: string; s0: string; s1: string; rim: string; grat: string;
  hi: string; label: string; halo: string; arc: string; pal: string[];
};

export function isLightTheme(): boolean {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "day") return true;
  if (t === "night") return false;
  return !window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readColors(): Colors {
  const light = isLightTheme();
  return light
    ? { gold: "232,162,10", red: "207,62,74", land: "rgba(23,21,15,.17)", landDim: "rgba(23,21,15,.08)", s0: "#ffffff", s1: "#ebe6db", rim: "rgba(232,162,10,.35)", grat: "rgba(23,21,15,.05)", hi: "#17150f", label: "#17150f", halo: "rgba(246,244,239,.85)", arc: "45,106,208", pal: PAL_L }
    : { gold: "243,181,58", red: "240,100,110", land: "rgba(255,255,255,.14)", landDim: "rgba(255,255,255,.06)", s0: "#1b2029", s1: "#0e1116", rim: "rgba(243,181,58,.28)", grat: "rgba(255,255,255,.035)", hi: "#ffffff", label: "#f1f2f4", halo: "rgba(13,15,19,.8)", arc: "110,168,255", pal: PAL_D };
}

/** A country slot per atlas feature: dots point at the slot, so a data refresh only repoints slots. */
type Slot = { c: WC | null };
type Dot = { l: number; cp: number; sp: number; s: Slot; fi: number; small?: number };
type Level = { dots: Dot[]; stepRad: number };
type Feat = Feature<Geometry, { name: string }> & { id?: string };

export type GlobeOptions = {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  tip: HTMLElement;
  getState: () => GlobeState;
  isPhone: () => boolean;
  onHover: (c: WC | null) => void;
  onTap: (c: WC | null, fly: boolean) => void;
};

export type Globe = {
  setData: (countries: WC[], markets: WM[]) => void;
  flyToCountry: (c: WC) => void;
  flyToRegion: (k: string) => void;
  zoomBy: (f: number) => void;
  resetIdle: () => void;
  readColors: () => void;
  destroy: () => void;
};

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Loads the self-hosted atlas and starts the globe; rejects if the geometry cannot load. */
export async function createGlobe(o: GlobeOptions, countries: WC[], markets: WM[]): Promise<Globe> {
  const res = await fetch("/geo/countries-110m.json");
  if (!res.ok) throw new Error(`atlas ${res.status}`);
  const topo = (await res.json()) as Topology<{ countries: GeometryCollection<{ name: string }> }>;

  const { wrap, canvas: cv, tip } = o;
  const ctx = cv.getContext("2d")!;
  let C = countries, M = markets;
  let byId: Record<string, WC> = {};
  let COL = readColors();
  let fontFamily = getComputedStyle(wrap).fontFamily || "Vazirmatn, sans-serif";

  const G = {
    rot: [-30, -22] as [number, number], zoom: 1, W: 0, H: 0, R: 0, cx: 0, cy: 0, dpr: 1,
    lod: [{ dots: [], stepRad: 1 }] as Level[],
    feats: [] as Feat[], fIdx: {} as Record<string, Feat>, fiOf: new Map<Feat, number>(),
    raster: null as null | { data: Uint8ClampedArray; W: number; H: number },
    lastInput: 0, dragging: false, visible: false,
    anim: null as null | { t0: number; d: number; from: [number, number]; to: [number, number]; fz: number; tz: number },
  };
  let hover: WC | null = null;
  const cent = new Map<WC, [number, number]>();
  const slots: Slot[] = [];

  const proj = geoOrthographic().clipAngle(90).precision(0.4);
  const path = geoPath(proj, ctx);
  const grat = geoGraticule10();

  const metricVal = (c: WC) => (o.getState().metric === "vol" ? c.v : c.r);
  const ranked = () => [...C].sort((a, b) => metricVal(b) - metricVal(a));
  let maxV = 1;
  const heat = (c: WC) => (o.getState().metric === "vol" ? Math.log(1 + c.v / 1000) / Math.log(1 + maxV / 1000) : c.r / 75);
  const cRGB = (c: WC) => (o.getState().metric === "vol" ? COL.pal[c.ci || 0] : COL.red);
  const centOf = (c: WC): [number, number] => cent.get(c) ?? [0, 0];

  G.feats = (feature(topo, topo.objects.countries).features as Feat[]).filter((f) => f.id !== "010");
  G.feats.forEach((f, i) => {
    if (f.id) G.fIdx[f.id] = f;
    G.fiOf.set(f, i);
    slots.push({ c: null });
  });

  function indexData() {
    byId = Object.fromEntries(C.filter((c) => c.geo).map((c) => [c.geo!, c]));
    maxV = Math.max(1, ...C.map((c) => c.v));
    cent.clear();
    C.forEach((c) => {
      if (!c.geo) return;
      cent.set(c, CENT[c.geo] || (G.fIdx[c.geo] ? (geoCentroid(G.fIdx[c.geo]) as [number, number]) : [0, 0]));
    });
    G.feats.forEach((f, i) => { slots[i].c = (f.id && byId[f.id]) || null; });
  }

  function resize() {
    const r = wrap.getBoundingClientRect();
    G.dpr = Math.min(devicePixelRatio || 1, 2);
    G.W = r.width; G.H = r.height; cv.width = G.W * G.dpr; cv.height = G.H * G.dpr;
  }
  function setProj() {
    G.R = Math.min(G.W, G.H) * (o.isPhone() ? 0.43 : 0.42) * G.zoom;
    G.cx = G.W / 2; G.cy = G.H / 2 + (o.isPhone() ? 14 : 18);
    proj.scale(G.R).translate([G.cx, G.cy]).rotate(G.rot);
  }
  function buildRaster() {
    const W = 2048, H = 1024, c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    const p = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]), gp = geoPath(p, x);
    G.feats.forEach((f, i) => { const n = i + 1; x.fillStyle = `rgb(${n},${(n * 37) & 255},${(n * 91) & 255})`; x.beginPath(); gp(f); x.fill(); });
    G.raster = { data: x.getImageData(0, 0, W, H).data, W, H };
  }
  function lookup(lon: number, lat: number): number {
    const { data, W, H } = G.raster!;
    const px = Math.min(W - 1, Math.max(0, Math.floor((lon + 180) / 360 * W))), py = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / 180 * H)));
    const off = (py * W + px) * 4, n = data[off];
    if (data[off + 3] < 255 || !n || data[off + 1] !== ((n * 37) & 255) || data[off + 2] !== ((n * 91) & 255)) return -1;
    return n - 1;
  }
  function gridDots(step: number, lat0: number, lat1: number, lon0: number, lon1: number, only?: number): Dot[] {
    const out: Dot[] = [], rad = Math.PI / 180;
    for (let lat = lat0; lat <= lat1; lat += step) {
      const dl = step / Math.max(0.18, Math.cos(lat * rad));
      const ls = lon0 === -180 ? -180 : Math.floor(lon0 / dl) * dl;
      for (let lon = ls; lon < lon1; lon += dl) {
        const fi = lookup(lon, lat); if (fi < 0 || (only != null && fi !== only)) continue;
        out.push({ l: lon * rad, cp: Math.cos(lat * rad), sp: Math.sin(lat * rad), s: slots[fi], fi });
      }
    }
    return out;
  }
  function buildLevel(step: number): Level {
    const dots = gridDots(step, -56, 83, -180, 180), cnt: Record<string, number> = {};
    dots.forEach((d) => { if (d.s.c) cnt[d.s.c.key] = (cnt[d.s.c.key] || 0) + 1; });
    C.forEach((c) => {
      const f = c.geo ? G.fIdx[c.geo] : undefined;
      if ((cnt[c.key] || 0) >= 10 || !f) return;
      const fi = G.fiOf.get(f)!, b = geoBounds(f);
      if (b[0][0] > b[1][0]) return;
      for (let s = step / 2; s >= 0.08; s /= 2) {
        const extra = gridDots(s, b[0][1], b[1][1], b[0][0], b[1][0], fi);
        if (extra.length + (cnt[c.key] || 0) >= 10 || s / 2 < 0.08) { extra.forEach((d) => { d.small = s / step; dots.push(d); }); break; }
      }
    });
    return { dots, stepRad: step * Math.PI / 180 };
  }
  let builtFor = "";
  function buildDots() {
    const ph = o.isPhone();
    G.lod = [buildLevel(ph ? 1.5 : 1.1), buildLevel(ph ? 0.6 : 0.45), buildLevel(ph ? 0.3 : 0.22)];
    builtFor = activeSig();
  }
  const activeSig = () => C.filter((c) => c.geo).map((c) => c.key).sort().join(",");

  function flyTo(ll: [number, number] | undefined, z?: number) {
    if (!ll) return;
    const from: [number, number] = [G.rot[0], G.rot[1]], fz = G.zoom;
    let tl = -ll[0];
    const tp = Math.max(-70, Math.min(70, -ll[1]));
    while (tl - from[0] > 180) tl -= 360; while (tl - from[0] < -180) tl += 360;
    G.anim = { t0: performance.now(), d: 900, from, to: [tl, tp], fz, tz: z ?? fz };
    G.lastInput = performance.now();
  }

  let raf = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (!G.raster || !G.visible) return;
    if (G.anim) {
      const a = G.anim, t = Math.min(1, (now - a.t0) / a.d), e = ease(t);
      G.rot = [a.from[0] + (a.to[0] - a.from[0]) * e, a.from[1] + (a.to[1] - a.from[1]) * e];
      G.zoom = a.fz + (a.tz - a.fz) * e; if (t >= 1) G.anim = null;
    } else if (!G.dragging && !o.getState().sel && now - G.lastInput > 5000) { G.rot[0] += 0.05; }
    draw(now);
  }

  function draw(now: number) {
    const S = o.getState();
    setProj();
    const { W, H, R, cx, cy, dpr } = G;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    // sphere + glow
    const glow = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.14);
    glow.addColorStop(0, `rgba(${COL.gold},.10)`); glow.addColorStop(1, `rgba(${COL.gold},0)`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.14, 0, 7); ctx.fill();
    const sg = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R);
    sg.addColorStop(0, COL.s0); sg.addColorStop(1, COL.s1);
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = COL.grat; ctx.lineWidth = 1; ctx.beginPath(); path(grat); ctx.stroke();
    // dots
    const rad = Math.PI / 180, lr = G.rot[0] * rad, pr = G.rot[1] * rad, cP = Math.cos(pr), sP = Math.sin(pr);
    const L = G.lod[G.zoom < 1.9 ? 0 : G.zoom < 4 ? 1 : 2];
    const sp = R * L.stepRad, base = Math.max(0.55, Math.min(sp * 0.34, 2.6));
    const reg = REG_SET[S.region] ?? null, focus = S.sel || hover;
    const inactive = new Path2D(), inactiveDim = new Path2D(), act = new Map<WC, Path2D>();
    for (const d of L.dots) {
      const l = d.l + lr, x0 = d.cp * Math.sin(l), y0 = d.sp, z0 = d.cp * Math.cos(l);
      const z = -y0 * sP + z0 * cP; if (z <= 0.02) continue;
      const y = y0 * cP + z0 * sP, X = cx + R * x0, Y = cy - R * y;
      if (X < -4 || X > W + 4 || Y < -4 || Y > H + 4) continue;
      const k = 0.45 + 0.55 * Math.sqrt(z);
      const dc = d.s.c;
      if (!dc) { const p = reg ? inactiveDim : inactive, r = base * k * 0.82; p.moveTo(X + r, Y); p.arc(X, Y, r, 0, 6.2832); continue; }
      let p = act.get(dc); if (!p) act.set(dc, p = new Path2D());
      const r = base * k * (dc === focus ? 1.25 : 1.08) * (d.small ? Math.max(0.45, d.small) : 1); p.moveTo(X + r, Y); p.arc(X, Y, r, 0, 6.2832);
    }
    ctx.fillStyle = COL.land; ctx.fill(inactive); ctx.fillStyle = COL.landDim; ctx.fill(inactiveDim);
    for (const [c, p] of act) {
      let a = 0.22 + 0.78 * Math.min(1, heat(c));
      if (reg && !reg.has(c.key)) a *= 0.28;
      if (focus && c !== focus && !focus.links.includes(c.key)) a *= 0.7;
      const crgb = cRGB(c);
      ctx.fillStyle = c === focus ? `rgb(${crgb})` : `rgba(${crgb},${a.toFixed(3)})`;
      ctx.fill(p);
    }
    // focus outline
    if (focus) {
      const f = focus.geo ? G.fIdx[focus.geo] : undefined;
      if (f) { ctx.lineJoin = "round"; ctx.strokeStyle = S.sel === focus ? `rgba(${cRGB(focus)},.95)` : COL.hi; ctx.globalAlpha = S.sel === focus ? 1 : .55; ctx.lineWidth = S.sel === focus ? 1.6 : 1; ctx.beginPath(); path(f); ctx.stroke(); ctx.globalAlpha = 1; }
      // arcs to linked countries
      if (focus.geo) {
        const a = centOf(focus); ctx.setLineDash([3, 5]); ctx.lineDashOffset = -(now / 40) % 8; ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(${COL.arc},.85)`;
        for (const id of focus.links) { const bc = byId[id]; if (!bc) continue; ctx.beginPath(); path({ type: "LineString", coordinates: [a, centOf(bc)] }); ctx.stroke(); }
        ctx.setLineDash([]);
      }
    }
    // pulses + labels for top 5 (+ focus)
    const center: [number, number] = [-G.rot[0], -G.rot[1]], top = ranked().slice(0, 5);
    const showL = new Set(top); if (focus) { showL.add(focus); focus.links.forEach((id) => byId[id] && showL.add(byId[id])); }
    ctx.font = `700 ${o.isPhone() ? 11 : 12}px ${fontFamily}`; ctx.textAlign = "center"; ctx.direction = "rtl";
    for (const c of showL) {
      if (!c.geo) continue;
      if (geoDistance(centOf(c), center) > 1.45) continue;
      if (reg && !reg.has(c.key) && c !== focus) continue;
      const [X, Y] = proj(centOf(c))!, isTop = top.includes(c);
      if (isTop) {
        const ph = ((now / 1800) + top.indexOf(c) * .21) % 1;
        ctx.strokeStyle = `rgba(${cRGB(c)},${(1 - ph) * .8})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X, Y, 4 + ph * 22, 0, 7); ctx.stroke();
      }
      ctx.fillStyle = c === focus ? COL.hi : `rgb(${cRGB(c)})`; ctx.beginPath(); ctx.arc(X, Y, 3, 0, 7); ctx.fill();
      const t = c.fa + "  " + (S.metric === "vol" ? wVolS(c.v) : fa(c.r) + "٪");
      ctx.lineWidth = 4; ctx.strokeStyle = COL.halo; ctx.strokeText(t, X, Y - 10); ctx.fillStyle = COL.label; ctx.fillText(t, X, Y - 10);
    }
    // rim
    ctx.strokeStyle = COL.rim; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  }

  /* ---------- interaction ---------- */
  function pick(x: number, y: number): WC | null {
    if (Math.hypot(x - G.cx, y - G.cy) > G.R) return null;
    const ll = proj.invert!([x, y]); if (!ll) return null;
    const fi = lookup(ll[0], ll[1]); if (fi < 0) return null;
    return slots[fi].c;
  }
  const ptrs = new Map<number, [number, number]>();
  let start: null | { x: number; y: number; rot: [number, number]; moved: boolean } = null;
  let pinch: null | { d: number; z: number } = null;

  const onDown = (e: PointerEvent) => {
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
    G.anim = null; G.lastInput = performance.now();
    if (ptrs.size === 1) start = { x: e.offsetX, y: e.offsetY, rot: [G.rot[0], G.rot[1]], moved: false };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: G.zoom }; start = null; }
  };
  const onMove = (e: PointerEvent) => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; G.zoom = Math.max(.85, Math.min(10, pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d)); return; }
    if (start) {
      const dx = e.offsetX - start.x, dy = e.offsetY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) { start.moved = true; G.dragging = true; cv.classList.add("drag"); }
      if (start.moved) { const k = 0.28 / G.zoom; G.rot = [start.rot[0] + dx * k, Math.max(-80, Math.min(80, start.rot[1] - dy * k))]; G.lastInput = performance.now(); }
      hideTip(); return;
    }
    if (e.pointerType === "mouse") {
      const c = pick(e.offsetX, e.offsetY);
      cv.classList.toggle("hit", !!c);
      if (c !== hover) { hover = c; o.onHover(c); }
      if (c) showTip(c, e.offsetX, e.offsetY); else hideTip();
    }
  };
  const onEnd = (e: PointerEvent) => {
    ptrs.delete(e.pointerId);
    if (start && !start.moved && e.type === "pointerup") { const c = pick(e.offsetX, e.offsetY); o.onTap(c || null, !!c && o.isPhone()); }
    if (ptrs.size < 2) pinch = null;
    if (!ptrs.size) { start = null; G.dragging = false; cv.classList.remove("drag"); }
  };
  const onLeave = () => { if (hover) { hover = null; o.onHover(null); } hideTip(); };
  const onWheel = (e: WheelEvent) => { e.preventDefault(); G.anim = null; G.lastInput = performance.now(); G.zoom = Math.max(.85, Math.min(10, G.zoom * Math.exp(-e.deltaY * 0.0015))); };

  function showTip(c: WC, x: number, y: number) {
    const S = o.getState();
    const m = c.mk.length ? M[c.mk[0]] : null;
    const pc = m && m.p !== null ? m.p : null;
    tip.innerHTML = `<b>${esc(c.fa)}</b><span>${S.metric === "vol" ? "حجم ۲۴س " + wVol(c.v) : "ریسک تنش " + fa(c.r) + "٪"} · ${fa(c.n)} بازار</span>${m ? `<div style="margin-top:6px;color:var(--text2);line-height:1.6">${esc(m.q)} <b style="display:inline;font-size:12px;color:${pc !== null && pc >= 50 ? "var(--gold)" : "var(--text)"}">${pc === null ? "—" : fa(pc) + "٪"}</b></div>` : ""}<div style="margin-top:6px;color:var(--gold);font-weight:700">برای سنجاق کردن کلیک کنید</div>`;
    const tw = 240; tip.style.left = Math.min(G.W - tw - 8, x + 16) + "px"; tip.style.top = Math.min(G.H - 130, y + 14) + "px"; tip.style.opacity = "1";
  }
  const hideTip = () => { tip.style.opacity = "0"; };

  cv.addEventListener("pointerdown", onDown);
  cv.addEventListener("pointermove", onMove);
  cv.addEventListener("pointerup", onEnd);
  cv.addEventListener("pointercancel", onEnd);
  cv.addEventListener("pointerleave", onLeave);
  cv.addEventListener("wheel", onWheel, { passive: false });
  const ro = new ResizeObserver(() => { resize(); if (G.raster) draw(performance.now()); });
  ro.observe(wrap);
  const io = new IntersectionObserver((es) => { G.visible = es[0].isIntersecting; });
  io.observe(wrap);

  /* ---------- boot ---------- */
  indexData();
  resize(); buildRaster(); buildDots();
  raf = requestAnimationFrame(frame);

  return {
    setData(countries, markets) {
      C = countries; M = markets;
      if (hover) hover = C.find((c) => c.key === hover!.key) ?? null;
      indexData();
      // A newly active small country needs its sub-grid; rebuild only then.
      if (activeSig() !== builtFor) buildDots();
    },
    flyToCountry(c) {
      if (!c.geo) return;
      const f = G.fIdx[c.geo];
      const big = c.v > 3_000_000 && c.geo !== "376" && c.geo !== "158";
      flyTo(CENT[c.geo] || centOf(c), Math.max(G.zoom, big ? 1.4 : f && geoArea(f) < 0.004 ? 5 : 2));
    },
    flyToRegion(k) {
      const r = REGIONS.find((x) => x.k === k);
      if (r?.c) flyTo(r.c, r.z); else flyTo([30, 22], 1);
    },
    zoomBy(f) {
      flyTo([-G.rot[0], -G.rot[1]], f > 1 ? Math.min(10, G.zoom * f) : Math.max(.85, G.zoom * f));
    },
    resetIdle() { G.lastInput = 0; },
    readColors() { COL = readColors(); fontFamily = getComputedStyle(wrap).fontFamily || fontFamily; },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onEnd);
      cv.removeEventListener("pointercancel", onEnd);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("wheel", onWheel);
    },
  };
}
