import { exec } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const STATIC_IMPORT_REGEX = /from\s+["'](?<specifier>[^"']+)["']/gu;
const DYNAMIC_IMPORT_REGEX = /import\(\s*["'](?<specifier>[^"']+)["']\s*\)/gu;
const EXT_REGEX = /\.tsx?$/u;
const SKIP_REGEX = /node_modules|\.d\.ts|\.css/u;

const targets = ["frontend", "shared"];

function scanFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (SKIP_REGEX.test(full)) {
			continue;
		}
		if (entry.isDirectory()) {
			for (const f of scanFiles(full)) {
				results.push(f);
			}
		} else if (EXT_REGEX.test(entry.name)) {
			results.push(full);
		}
	}
	return results;
}

function resolveImport(
	from: string,
	specifier: string,
	allFiles: Set<string>,
): string | null {
	if (!specifier.startsWith(".")) {
		return null;
	}
	const dir = dirname(from);
	const base = resolve(dir, specifier);
	const candidates = [
		base,
		`${base}.ts`,
		`${base}.tsx`,
		join(base, "index.ts"),
		join(base, "index.tsx"),
	];
	for (const c of candidates) {
		if (allFiles.has(c)) {
			return c;
		}
	}
	return null;
}

function main(): void {
	const root = resolve(import.meta.dirname, "..");
	const files: string[] = [];
	for (const t of targets) {
		const dir = resolve(root, t);
		for (const f of scanFiles(dir)) {
			files.push(f);
		}
	}
	console.log(`Scanning ${targets.join(", ")}...`);
	const fileSet = new Set(files);
	const deps: Record<string, string[]> = {};

	for (const file of files) {
		const key = relative(root, file);
		const src = readFileSync(file, "utf8");
		const fileDeps: string[] = [];
		for (const match of src.matchAll(STATIC_IMPORT_REGEX)) {
			const specifier = match.groups?.specifier;
			if (!specifier) {
				continue;
			}
			const resolved = resolveImport(file, specifier, fileSet);
			if (resolved) {
				fileDeps.push(relative(root, resolved));
			}
		}
		for (const match of src.matchAll(DYNAMIC_IMPORT_REGEX)) {
			const specifier = match.groups?.specifier;
			if (!specifier) {
				continue;
			}
			const resolved = resolveImport(file, specifier, fileSet);
			if (resolved) {
				fileDeps.push(relative(root, resolved));
			}
		}
		deps[key] = fileDeps;
	}

	const fileCount = Object.keys(deps).length;
	const edgeCount = Object.values(deps).reduce((n, d) => n + d.length, 0);
	console.log(`${fileCount} files, ${edgeCount} edges`);

	// Count total connections (imports + imported by) per file
	const connections: Record<string, number> = {};
	for (const [file, fileDeps] of Object.entries(deps)) {
		connections[file] = (connections[file] ?? 0) + fileDeps.length;
		for (const dep of fileDeps) {
			connections[dep] = (connections[dep] ?? 0) + 1;
		}
	}
	const sorted = Object.entries(connections).sort((a, b) => b[1] - a[1]);
	console.log("\nMost connected files:");
	for (const [file, count] of sorted.slice(0, 15)) {
		console.log(`  ${count} connections  ${file}`);
	}

	const html = buildHTML(JSON.stringify(deps), targets.join(", "));
	const tmpFile = join(tmpdir(), "dep-graph.html");
	writeFileSync(tmpFile, html);
	console.log(`Opening ${tmpFile}`);
	exec(`xdg-open '${tmpFile}'`);
}

function buildHTML(graphJSON: string, title: string): string {
	return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>deps: ${title}</title>
<style>*{margin:0;padding:0}body{background:rgb(13,17,23);overflow:hidden}canvas{display:block}</style>
</head><body>
<canvas id="c"></canvas>
<script>
"use strict";
const deps = ${graphJSON};
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// ── Build graph ──
const allNames = new Set(Object.keys(deps));
for (const ds of Object.values(deps)) { for (const d of ds) { allNames.add(d); } }
const names = Array.from(allNames);
const id = {};
for (let i = 0; i < names.length; i += 1) { id[names[i]] = i; }
const N = names.length;

// adjacency
const imports = names.map(() => []);
const importedBy = names.map(() => []);
const edgeList = [];
for (const [from, tos] of Object.entries(deps)) {
  for (const to of tos) {
    if (id[from] !== undefined && id[to] !== undefined) {
      imports[id[from]].push(id[to]);
      importedBy[id[to]].push(id[from]);
      edgeList.push([id[from], id[to]]);
    }
  }
}

// ── Label + color ──
const RE_EXT = /\\.(?:ts|tsx)$/u;
const RE_INDEX = /\\/index$/u;
function short(n) {
  return n.replace(RE_EXT, '').replace(RE_INDEX, '/');
}

// Derive colors from directory structure
const PALETTE = [
  'rgb(88,166,255)', 'rgb(63,185,80)', 'rgb(210,153,34)',
  'rgb(163,113,247)', 'rgb(121,192,255)', 'rgb(56,139,253)',
  'rgb(219,109,40)', 'rgb(218,76,115)', 'rgb(110,198,156)',
];
const dirSet = new Set();
for (const name of names) {
  const parts = name.split('/');
  if (parts.length > 1) { dirSet.add(\`\${parts[0]}/\${parts[1]}\`); }
  else { dirSet.add(parts[0]); }
}
const dirs = Array.from(dirSet).sort();
const dirColorMap = {};
for (let i = 0; i < dirs.length; i += 1) {
  dirColorMap[dirs[i]] = PALETTE[i % PALETTE.length];
}
function nodeColor(name) {
  const parts = name.split('/');
  const key = parts.length > 1 ? \`\${parts[0]}/\${parts[1]}\` : parts[0];
  return dirColorMap[key] || 'rgb(139,148,158)';
}
const label = names.map(short);
const color = names.map(nodeColor);

// ── Force-directed layout ──

// Initialize positions spread in a circle
const x = new Float64Array(N);
const y = new Float64Array(N);
const initRadius = Math.sqrt(N) * 40;
for (let i = 0; i < N; i += 1) {
  const angle = (i / N) * Math.PI * 2;
  x[i] = Math.cos(angle) * initRadius;
  y[i] = Math.sin(angle) * initRadius;
}

// Force simulation (runs live in render loop)
const vx = new Float64Array(N);
const vy = new Float64Array(N);
const IDEAL_LEN = 300;
const REPULSION = 50_000;
const SPRING = 0.015;

function simStep() {

  // Repulsion between all pairs (1/dist, longer range than 1/dist²)
  for (let i = 0; i < N; i += 1) {
    for (let j = i + 1; j < N; j += 1) {
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = REPULSION / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      vx[i] += fx;
      vy[i] += fy;
      vx[j] -= fx;
      vy[j] -= fy;
    }
  }

  // Spring attraction along edges (toward ideal length)
  for (const [a, b] of edgeList) {
    const dx = x[b] - x[a];
    const dy = y[b] - y[a];
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const displacement = dist - IDEAL_LEN;
    const force = displacement * SPRING;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    vx[a] += fx;
    vy[a] += fy;
    vx[b] -= fx;
    vy[b] -= fy;
  }

  // Apply velocities with damping
  for (let i = 0; i < N; i += 1) {
    vx[i] *= 0.45;
    vy[i] *= 0.45;
    x[i] += vx[i];
    y[i] += vy[i];
  }
}

// ── Camera ──
let camX = 0;
let camY = 0;
let camZ = 1;
function fitView() {
  let minX = x[0];
  let maxX = x[0];
  let minY = y[0];
  let maxY = y[0];
  for (let i = 1; i < N; i += 1) {
    if (x[i] < minX) { minX = x[i]; }
    if (x[i] > maxX) { maxX = x[i]; }
    if (y[i] < minY) { minY = y[i]; }
    if (y[i] > maxY) { maxY = y[i]; }
  }
  const w = maxX - minX + 400;
  const h = maxY - minY + 200;
  const scx = innerWidth / w;
  const scy = innerHeight / h;
  camZ = Math.min(scx, scy) * 0.9;
  camX = (minX + maxX) / 2 - innerWidth / 2 / camZ;
  camY = (minY + maxY) / 2 - innerHeight / 2 / camZ;
}
fitView();

function sx(v) { return (v - camX) * camZ; }
function sy(v) { return (v - camY) * camZ; }
function wx(scx) { return scx / camZ + camX; }
function wy(scy) { return scy / camZ + camY; }

// ── Highlight ──
let hlNode = -1;
let hlConn = null;
let hlEdges = null;

function computeConn(ni) {
  const conn = new Set([ni]);
  const ce = new Set();
  function down(n) {
    for (let i = 0; i < edgeList.length; i += 1) {
      const [a, b] = edgeList[i];
      if (a === n && !conn.has(b)) { conn.add(b); ce.add(i); down(b); }
    }
  }
  function up(n) {
    for (let i = 0; i < edgeList.length; i += 1) {
      const [a, b] = edgeList[i];
      if (b === n && !conn.has(a)) { conn.add(a); ce.add(i); up(a); }
    }
  }
  for (let i = 0; i < edgeList.length; i += 1) {
    const [a, b] = edgeList[i];
    if (a === ni) { ce.add(i); conn.add(b); down(b); }
    if (b === ni) { ce.add(i); conn.add(a); up(a); }
  }
  return [conn, ce];
}

// ── Draw ──
function drawLine(ax, ay, bx, by) {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

const STEPS_PER_FRAME = 100;

function draw() {
  for (let s = 0; s < STEPS_PER_FRAME; s += 1) { simStep(); }
  fitView();
  canvas.width = innerWidth;
  canvas.height = innerHeight;

  const fs = Math.max(9, Math.min(14, 13 * camZ));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const dotR = Math.max(3, 4 * camZ);
  const active = hlNode >= 0;

  // ── Edges: base layer (all edges, thin) ──
  ctx.lineWidth = Math.max(0.5, 0.7 * camZ);
  for (let i = 0; i < edgeList.length; i += 1) {
    if (active && hlEdges && hlEdges.has(i)) { continue; }
    const [ai, bi] = edgeList[i];
    const dim = active && hlEdges && !hlEdges.has(i);
    ctx.strokeStyle = dim ? 'rgb(18,21,26)' : 'rgb(40,45,52)';
    const x1 = sx(x[ai]);
    const y1 = sy(y[ai]);
    const x2 = sx(x[bi]);
    const y2 = sy(y[bi]);
    drawLine(x1, y1, x2, y2);
  }

  // ── Edges: highlight (transitive, colored, thick) ──
  if (active && hlEdges) {
    ctx.lineWidth = Math.max(1.5, 2.2 * camZ);
    for (const i of hlEdges) {
      const [ai, bi] = edgeList[i];
      ctx.strokeStyle = color[ai];
      const x1 = sx(x[ai]);
      const y1 = sy(y[ai]);
      const x2 = sx(x[bi]);
      const y2 = sy(y[bi]);
      drawLine(x1, y1, x2, y2);
    }
  }

  // ── Nodes ──
  ctx.font = \`\${fs}px system-ui, sans-serif\`;
  for (let i = 0; i < N; i += 1) {
    const dim = active && hlConn && !hlConn.has(i);
    const isHl = i === hlNode;
    const nx = sx(x[i]);
    const ny = sy(y[i]);
    // dot
    ctx.fillStyle = dim ? 'rgb(18,21,26)' : color[i];
    ctx.beginPath();
    ctx.arc(nx, ny, isHl ? dotR * 1.6 : dotR, 0, 6.283);
    ctx.fill();
    // label (only on hover)
    if (isHl) {
      ctx.fillStyle = 'rgb(255,255,255)';
      ctx.fillText(label[i], nx + dotR + 5, ny);
    }
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// ── Interaction ──
function findNode(mx, my) {
  const worldMx = wx(mx);
  const worldMy = wy(my);
  let best = -1;
  let bestD = 25 / camZ;
  for (let i = 0; i < N; i += 1) {
    const d = Math.hypot(x[i] - worldMx, y[i] - worldMy);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

globalThis.addEventListener('mousemove', e => {
  const ni = findNode(e.clientX, e.clientY);
  if (ni !== hlNode) {
    hlNode = ni;
    if (ni >= 0) {
      const [c, ce] = computeConn(ni);
      hlConn = c;
      hlEdges = ce;
    } else {
      hlConn = null;
      hlEdges = null;
    }
  }
});
</script>
</body></html>`;
}

void main();
