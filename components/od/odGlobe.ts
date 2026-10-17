import { geoBounds, geoCentroid, geoDistance, geoEquirectangular, geoGraticule10, geoOrthographic, geoPath, type GeoProjection } from "d3";
import type { Feature, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { REGIONS } from "@/lib/world";

/**
 * The redesign's dotted globe (od-globe.js), ported to a class driven by
 * OdGlobe.tsx. Same engine as PolyBaaz's map (worldGlobe.ts): a hand-rotated
 * dot matrix and an RGB-encoded country raster for picking, with the Oddzy
 * look — one brand colour (green for money, red for risk), a "mini" mode
 * for the section and subtopic maps, and a `focus` list (first = primary,
 * the rest joined to it by dashed arcs).
 *
 * Loaded with a dynamic import so d3 never sits in front of the page.
 */

export type GlobeCountry = {
  /** ISO numeric, zero-padded ("364"). */
  id: string;
  name: string;
  /** 24h volume, USD. */
  v: number;
  /** Risk 0–100. */
  r: number;
  /** Countries sharing markets with this one (ids). */
  links: string[];
  /** Filled in here: centroid and region. */
  cent?: [number, number];
  reg?: string;
};

export type GlobeProps = {
  metric: "vol" | "risk";
  region: string;
  focus: string[];
  mini: boolean;
  zoom: number;
};

type Dot = { l: number; cp: number; sp: number; c: GlobeCountry | null; small?: number };
type Feat = Feature<Geometry, { name: string }> & { id?: string };
type World = { feats: Feat[]; fIdx: Record<string, Feat>; lookup: (lon: number, lat: number) => number };

const CENT: Record<string, [number, number]> = { "840": [-98, 39], "643": [48, 56], "250": [2.5, 46.6], "124": [-100, 57], "304": [-41, 72], "376": [35, 31.3] };
const REG: Record<string, { c: [number, number]; z: number } | null> = Object.fromEntries(
  REGIONS.map((r) => [r.k, r.c && r.z ? { c: r.c, z: r.z } : null]),
);
const REG_IDS: Record<string, string> = {};
for (const r of REGIONS) for (const id of r.ids ?? []) REG_IDS[String(id).padStart(3, "0")] ??= r.k;

/** A country's region: the curated lists first, then by where it sits. */
function regionOf(id: string, [lon, lat]: [number, number]): string {
  if (REG_IDS[id]) return REG_IDS[id];
  if (lon < -30) return "am";
  if (lon >= 25 && lon <= 63 && lat >= 12 && lat <= 42) return "me";
  if (lat > 35 && lon >= -25 && lon <= 60) return "eu";
  if (lat <= 35 && lon >= -20 && lon <= 52) return "af";
  return "as";
}

let worldP: Promise<World> | null = null;
function loadWorld(): Promise<World> {
  return (worldP ??= (async () => {
    const topo = (await (await fetch("/geo/countries-110m.json")).json()) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    const fc = feature(topo, topo.objects.countries) as unknown as { features: Feat[] };
    const feats = fc.features.filter((f) => f.id !== "010");
    const fIdx: Record<string, Feat> = {};
    feats.forEach((f) => {
      if (f.id) fIdx[String(f.id)] = f;
    });
    const W = 2048, H = 1024;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    const p = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
    const gp = geoPath(p, x);
    feats.forEach((f, i) => {
      const n = i + 1;
      x.fillStyle = `rgb(${n},${(n * 37) & 255},${(n * 91) & 255})`;
      x.beginPath();
      gp(f);
      x.fill();
    });
    const data = x.getImageData(0, 0, W, H).data;
    const lookup = (lon: number, lat: number) => {
      const px = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
      const py = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
      const o = (py * W + px) * 4, n = data[o];
      if (data[o + 3] < 255 || !n || data[o + 1] !== ((n * 37) & 255) || data[o + 2] !== ((n * 91) & 255)) return -1;
      return n - 1;
    };
    return { feats, fIdx, lookup };
  })());
}

type Colors = { vol: string; risk: string; land: string; landDim: string; s0: string; s1: string; rim: string; grat: string; hi: string; label: string; halo: string; arc: string };
function colors(): Colors {
  const light = document.documentElement.getAttribute("data-theme") === "day";
  return light
    ? { vol: "9,140,96", risk: "200,50,63", land: "rgba(18,22,20,.16)", landDim: "rgba(18,22,20,.07)", s0: "#fdfcf8", s1: "#e6e3d8", rim: "rgba(18,22,20,.18)", grat: "rgba(18,22,20,.05)", hi: "#121614", label: "#121614", halo: "rgba(243,241,234,.9)", arc: "183,121,31" }
    : { vol: "61,220,151", risk: "255,107,107", land: "rgba(233,239,235,.13)", landDim: "rgba(233,239,235,.05)", s0: "#16201c", s1: "#0a0f0d", rim: "rgba(61,220,151,.22)", grat: "rgba(233,239,235,.035)", hi: "#ffffff", label: "#e9efeb", halo: "rgba(10,13,12,.82)", arc: "245,184,74" };
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const fmtV = (usd: number) => (usd >= 1e6 ? `$${(usd / 1e6).toFixed(1).replace(/\.0$/, "")}M` : `$${Math.round(usd / 1e3)}K`);

export class OdGlobeEngine {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w: World | null = null;
  private byId: Record<string, GlobeCountry> = {};
  private list: GlobeCountry[] = [];
  private maxV = 1;
  private levels: Record<number, { dots: Dot[]; stepRad: number }> = {};
  private G = { rot: [-40, -28] as [number, number], zoom: 1, z0: 1, W: 0, H: 0, R: 0, cx: 0, cy: 0, dpr: 1, lastInput: 0, dragging: false, anim: null as null | { t0: number; d: number; from: [number, number]; to: [number, number]; fz: number; tz: number } };
  private proj: GeoProjection | null = null;
  private hover: GlobeCountry | null = null;
  private raf = 0;
  private visible = true;
  private fc = 0;
  private regionSet = false;
  private ro: ResizeObserver;
  private off: (() => void)[] = [];
  private col = colors();

  constructor(
    private host: HTMLElement,
    private props: GlobeProps,
    countries: GlobeCountry[],
    private onEvent: (type: "hover" | "select", id: string | null) => void,
  ) {
    const cv = (this.cv = document.createElement("canvas"));
    Object.assign(cv.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "pan-y", cursor: "grab" });
    host.appendChild(cv);
    this.ctx = cv.getContext("2d")!;
    this.G.zoom = this.G.z0 = props.zoom;
    this.setCountries(countries);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    const onTheme = () => (this.col = colors());
    window.addEventListener("od-theme", onTheme);
    this.off.push(() => window.removeEventListener("od-theme", onTheme));
    this.bind();
    loadWorld().then((w) => {
      this.w = w;
      this.placeCountries();
      this.resize();
      this.applyFocus(true);
      this.applyRegion();
      const f = (now: number) => {
        this.raf = requestAnimationFrame(f);
        if (++this.fc % 30 === 0) {
          const r = this.host.getBoundingClientRect();
          this.visible = r.bottom > -50 && r.top < innerHeight + 50;
        }
        if (this.visible) this.frame(now);
      };
      this.raf = requestAnimationFrame(f);
    });
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.off.forEach((f) => f());
    this.cv.remove();
  }

  setCountries(list: GlobeCountry[]) {
    this.list = list;
    this.byId = Object.fromEntries(list.map((c) => [c.id, c]));
    this.maxV = Math.max(1, ...list.map((c) => c.v));
    this.levels = {};
    if (this.w) this.placeCountries();
  }

  private placeCountries() {
    const w = this.w!;
    for (const c of this.list) {
      c.cent = CENT[c.id] ?? (w.fIdx[c.id] ? (geoCentroid(w.fIdx[c.id]) as [number, number]) : [0, 0]);
      c.reg = regionOf(c.id, c.cent);
    }
  }

  update(next: GlobeProps) {
    const prev = this.props;
    this.props = next;
    if (!this.w) return;
    if (prev.region !== next.region) this.applyRegion();
    if (prev.focus.join() !== next.focus.join()) this.applyFocus(false);
  }

  zoomBy(k: number) {
    const G = this.G;
    this.flyTo([-G.rot[0], -G.rot[1]], Math.max(0.85, Math.min(10, G.zoom * k)));
  }

  private get focusIds() {
    return this.props.focus.filter((id) => this.byId[id]);
  }

  private applyRegion() {
    const r = REG[this.props.region || "all"];
    if (r) this.flyTo(r.c, r.z);
    else if (this.regionSet) this.flyTo([40, 28], this.G.z0);
    this.regionSet = true;
  }

  private applyFocus(instant: boolean) {
    const ids = this.focusIds;
    if (!ids.length) return;
    const cs = ids.map((i) => this.byId[i].cent!);
    const c = ids.length > 1 ? (geoCentroid({ type: "MultiPoint", coordinates: cs }) as [number, number]) : cs[0];
    const spread = Math.max(0, ...cs.map((p) => geoDistance(p, c)));
    const G = this.G;
    const z = this.props.mini ? (spread > 0.9 ? 1.05 : spread > 0.5 ? Math.min(1.5, G.z0) : G.z0) : Math.max(G.zoom, spread > 0.9 ? 1 : 1.6);
    if (instant) {
      G.rot = [-c[0], -Math.max(-70, Math.min(70, c[1]))];
      G.zoom = z;
    } else this.flyTo(c, z);
  }

  private resize() {
    const r = this.host.getBoundingClientRect(), G = this.G;
    G.dpr = Math.min(devicePixelRatio || 1, 2);
    G.W = r.width;
    G.H = r.height;
    this.cv.width = G.W * G.dpr;
    this.cv.height = G.H * G.dpr;
  }

  private flyTo(ll: [number, number], z?: number) {
    const G = this.G, from: [number, number] = [G.rot[0], G.rot[1]], fz = G.zoom;
    let tl = -ll[0];
    const tp = Math.max(-70, Math.min(70, -ll[1]));
    while (tl - from[0] > 180) tl -= 360;
    while (tl - from[0] < -180) tl += 360;
    G.anim = { t0: performance.now(), d: 900, from, to: [tl, tp], fz, tz: z ?? fz };
    G.lastInput = performance.now();
  }

  private heat(c: GlobeCountry) {
    return this.props.metric === "vol" ? Math.log(1 + c.v / 1000) / Math.log(1 + this.maxV / 1000) : c.r / 75;
  }

  private level(step: number) {
    if (this.levels[step]) return this.levels[step];
    const w = this.w!, rad = Math.PI / 180;
    const gridDots = (st: number, lat0: number, lat1: number, lon0: number, lon1: number, only?: number) => {
      const out: Dot[] = [];
      for (let lat = lat0; lat <= lat1; lat += st) {
        const dl = st / Math.max(0.18, Math.cos(lat * rad)), ls = lon0 === -180 ? -180 : Math.floor(lon0 / dl) * dl;
        for (let lon = ls; lon < lon1; lon += dl) {
          const fi = w.lookup(lon, lat);
          if (fi < 0 || (only !== undefined && fi !== only)) continue;
          out.push({ l: lon * rad, cp: Math.cos(lat * rad), sp: Math.sin(lat * rad), c: this.byId[String(w.feats[fi].id)] ?? null });
        }
      }
      return out;
    };
    const dots = gridDots(step, -56, 83, -180, 180);
    const cnt: Record<string, number> = {};
    dots.forEach((d) => {
      if (d.c) cnt[d.c.id] = (cnt[d.c.id] || 0) + 1;
    });
    // Small countries (Israel, Lebanon, Qatar…) get a finer sub-grid so they always show.
    for (const c of this.list) {
      const f = w.fIdx[c.id];
      if ((cnt[c.id] || 0) >= 10 || !f) continue;
      const fi = w.feats.indexOf(f), b = geoBounds(f);
      if (b[0][0] > b[1][0]) continue;
      for (let s = step / 2; s >= 0.08; s /= 2) {
        const extra = gridDots(s, b[0][1], b[1][1], b[0][0], b[1][0], fi);
        if (extra.length + (cnt[c.id] || 0) >= 10 || s / 2 < 0.08) {
          extra.forEach((d) => {
            d.small = s / step;
            dots.push(d);
          });
          break;
        }
      }
    }
    return (this.levels[step] = { dots, stepRad: step * rad });
  }

  private frame(now: number) {
    const G = this.G;
    if (G.anim) {
      const a = G.anim, t = Math.min(1, (now - a.t0) / a.d), e = ease(t);
      G.rot = [a.from[0] + (a.to[0] - a.from[0]) * e, a.from[1] + (a.to[1] - a.from[1]) * e];
      G.zoom = a.fz + (a.tz - a.fz) * e;
      if (t >= 1) G.anim = null;
    } else if (!G.dragging && !this.focusIds.length && now - G.lastInput > 5000) G.rot[0] += 0.04;
    this.draw(now);
  }

  private draw(now: number) {
    const G = this.G, ctx = this.ctx, COL = this.col, w = this.w!, metric = this.props.metric;
    const rgb = metric === "vol" ? COL.vol : COL.risk;
    const { W, H, dpr } = G;
    if (!W) return;
    const R = (G.R = Math.min(W, H) * (this.props.mini ? 0.46 : 0.43) * G.zoom), cx = (G.cx = W / 2), cy = (G.cy = H / 2);
    const proj = (this.proj ??= geoOrthographic().clipAngle(90).precision(0.4));
    const path = geoPath(proj, ctx);
    proj.scale(R).translate([cx, cy]).rotate([G.rot[0], G.rot[1]]);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.12);
    glow.addColorStop(0, `rgba(${rgb},.10)`);
    glow.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.12, 0, 7);
    ctx.fill();
    const sg = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    sg.addColorStop(0, COL.s0);
    sg.addColorStop(1, COL.s1);
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.fill();
    ctx.strokeStyle = COL.grat;
    ctx.lineWidth = 1;
    ctx.beginPath();
    path(geoGraticule10());
    ctx.stroke();

    const rad = Math.PI / 180, lr = G.rot[0] * rad, pr = G.rot[1] * rad, cP = Math.cos(pr), sP = Math.sin(pr);
    const small = Math.min(W, H) < 500;
    const L = this.level(G.zoom < 1.9 ? (small ? 1.5 : 1.1) : G.zoom < 4 ? (small ? 0.6 : 0.45) : small ? 0.3 : 0.22);
    const sp = R * L.stepRad, base = Math.max(0.55, Math.min(sp * 0.34, 2.6));
    const reg = this.props.region, regOn = !!reg && reg !== "all";
    const F = this.focusIds, FS = new Set(F);
    const focus = this.hover && !F.length ? this.hover : F.length ? this.byId[F[0]] : null;
    const linkSet = F.length ? FS : focus ? new Set([focus.id, ...focus.links]) : null;
    const inactive = new Path2D(), act = new Map<GlobeCountry, Path2D>();
    for (const d of L.dots) {
      const l = d.l + lr, x0 = d.cp * Math.sin(l), y0 = d.sp, z0 = d.cp * Math.cos(l);
      const z = -y0 * sP + z0 * cP;
      if (z <= 0.02) continue;
      const y = y0 * cP + z0 * sP, X = cx + R * x0, Y = cy - R * y;
      if (X < -4 || X > W + 4 || Y < -4 || Y > H + 4) continue;
      const k = 0.45 + 0.55 * Math.sqrt(z);
      if (!d.c) {
        const r = base * k * 0.8;
        inactive.moveTo(X + r, Y);
        inactive.arc(X, Y, r, 0, 6.2832);
        continue;
      }
      let p = act.get(d.c);
      if (!p) act.set(d.c, (p = new Path2D()));
      const r = base * k * (FS.has(d.c.id) || d.c === focus ? 1.25 : 1.08) * (d.small ? Math.max(0.45, d.small) : 1);
      p.moveTo(X + r, Y);
      p.arc(X, Y, r, 0, 6.2832);
    }
    ctx.fillStyle = regOn ? COL.landDim : COL.land;
    ctx.fill(inactive);
    for (const [c, p] of act) {
      let a = 0.2 + 0.8 * Math.min(1, this.heat(c));
      if (regOn && c.reg !== reg) a *= 0.25;
      if (linkSet && !linkSet.has(c.id)) a *= F.length ? 0.3 : 0.6;
      ctx.fillStyle = `rgba(${rgb},${(c === focus ? 1 : a).toFixed(3)})`;
      ctx.fill(p);
    }
    ctx.lineJoin = "round";
    const outline = (id: string, strong: boolean) => {
      const f = w.fIdx[id];
      if (!f) return;
      ctx.strokeStyle = strong ? `rgba(${rgb},.95)` : COL.hi;
      ctx.globalAlpha = strong ? 1 : 0.5;
      ctx.lineWidth = strong ? 1.5 : 1;
      ctx.beginPath();
      path(f);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (F.length) F.forEach((id) => outline(id, true));
    else if (focus) outline(focus.id, false);
    const arcs = F.length > 1 ? F.slice(1) : focus && !F.length ? focus.links : [];
    if (focus && arcs.length) {
      const a = focus.cent!;
      ctx.setLineDash([3, 5]);
      ctx.lineDashOffset = -(now / 40) % 8;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = `rgba(${COL.arc},.9)`;
      for (const id of arcs) {
        const b = this.byId[id]?.cent;
        if (!b) continue;
        ctx.beginPath();
        path({ type: "LineString", coordinates: [a, b] });
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    const center: [number, number] = [-G.rot[0], -G.rot[1]];
    const mv = (c: GlobeCountry) => (metric === "vol" ? c.v : c.r);
    const top = this.props.mini ? [] : [...this.list].sort((a, b) => mv(b) - mv(a)).slice(0, 5);
    const show = new Set(top);
    F.forEach((id) => show.add(this.byId[id]));
    if (focus) show.add(focus);
    ctx.font = `600 ${small ? 11 : 12}px ${getComputedStyle(this.host).getPropertyValue("--od-sans") || "system-ui"}`;
    ctx.textAlign = "center";
    for (const c of show) {
      if (!c.cent || geoDistance(c.cent, center) > 1.45) continue;
      if (regOn && c.reg !== reg && c !== focus) continue;
      const pt = proj(c.cent);
      if (!pt) continue;
      const [X, Y] = pt, ti = top.indexOf(c);
      if (ti >= 0 || FS.has(c.id)) {
        const ph = (now / 1800 + Math.max(0, ti) * 0.21) % 1;
        ctx.strokeStyle = `rgba(${rgb},${(1 - ph) * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(X, Y, 4 + ph * 20, 0, 7);
        ctx.stroke();
      }
      ctx.fillStyle = c === focus ? COL.hi : `rgb(${rgb})`;
      ctx.beginPath();
      ctx.arc(X, Y, 3, 0, 7);
      ctx.fill();
      const t = `${c.name}  ${metric === "vol" ? fmtV(c.v) : `${c.r}%`}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = COL.halo;
      ctx.strokeText(t, X, Y - 10);
      ctx.fillStyle = COL.label;
      ctx.fillText(t, X, Y - 10);
    }
    ctx.strokeStyle = COL.rim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.stroke();
  }

  private pick(x: number, y: number): GlobeCountry | null {
    const G = this.G;
    if (!this.w || !this.proj || Math.hypot(x - G.cx, y - G.cy) > G.R) return null;
    const ll = this.proj.invert?.([x, y]);
    if (!ll) return null;
    const fi = this.w.lookup(ll[0], ll[1]);
    return fi < 0 ? null : (this.byId[String(this.w.feats[fi].id)] ?? null);
  }

  private bind() {
    const cv = this.cv, G = this.G;
    let start: { x: number; y: number; rot: [number, number]; moved: boolean; id: number } | null = null;
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      cv.addEventListener(t, f as EventListener, o);
      this.off.push(() => cv.removeEventListener(t, f as EventListener));
    };
    on("pointerdown", (e) => {
      start = { x: e.offsetX, y: e.offsetY, rot: [G.rot[0], G.rot[1]], moved: false, id: e.pointerId };
      G.anim = null;
      G.lastInput = performance.now();
    });
    on("pointermove", (e) => {
      if (start) {
        const dx = e.offsetX - start.x, dy = e.offsetY - start.y;
        if (!start.moved && Math.abs(dx) + Math.abs(dy) > 6) {
          start.moved = true;
          G.dragging = true;
          cv.setPointerCapture(start.id);
          cv.style.cursor = "grabbing";
        }
        if (start.moved) {
          const k = 0.28 / G.zoom;
          G.rot = [start.rot[0] + dx * k, Math.max(-80, Math.min(80, start.rot[1] - dy * k))];
          G.lastInput = performance.now();
        }
        return;
      }
      if (e.pointerType === "mouse") {
        const c = this.pick(e.offsetX, e.offsetY);
        cv.style.cursor = c ? "pointer" : "grab";
        if (c !== this.hover) {
          this.hover = c;
          this.onEvent("hover", c ? c.id : null);
        }
      }
    });
    const end = (e: PointerEvent) => {
      if (start && !start.moved && e.type === "pointerup") {
        const c = this.pick(e.offsetX, e.offsetY);
        this.onEvent("select", c ? c.id : null);
      }
      start = null;
      G.dragging = false;
      cv.style.cursor = "grab";
    };
    on("pointerup", end);
    on("pointercancel", end);
    on("pointerleave", () => {
      if (this.hover) {
        this.hover = null;
        this.onEvent("hover", null);
      }
    });
    if (!this.props.mini)
      on(
        "wheel",
        (e) => {
          e.preventDefault();
          G.anim = null;
          G.lastInput = performance.now();
          G.zoom = Math.max(0.85, Math.min(10, G.zoom * Math.exp(-e.deltaY * 0.0015)));
        },
        { passive: false },
      );
  }
}
