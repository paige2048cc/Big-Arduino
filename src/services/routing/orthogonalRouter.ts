export type Point = { x: number; y: number };

export type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export interface RouteOrthogonalInput {
  start: Point; // pin position
  end: Point;   // pin position
  obstacles: Rect[];
  startRect?: Rect; // bounding rect for start component (optional)
  endRect?: Rect;   // bounding rect for end component (optional)
  gridSize?: number;    // px
  clearance?: number;   // px (obstacle inflation)
  margin?: number;      // px (search box padding)
  bendPenalty?: number; // relative to one grid step cost
  maxExpanded?: number; // safety limit
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function expandRect(r: Rect, by: number): Rect {
  return { left: r.left - by, top: r.top - by, right: r.right + by, bottom: r.bottom + by };
}

function rectIntersects(a: Rect, b: Rect): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function computeExitPoint(pin: Point, rect: Rect, clearance: number): Point {
  // Choose nearest side, then place a point just outside the rect on that side.
  const dLeft = Math.abs(pin.x - rect.left);
  const dRight = Math.abs(pin.x - rect.right);
  const dTop = Math.abs(pin.y - rect.top);
  const dBottom = Math.abs(pin.y - rect.bottom);

  const minD = Math.min(dLeft, dRight, dTop, dBottom);
  if (minD === dLeft) {
    return { x: rect.left - clearance, y: clamp(pin.y, rect.top, rect.bottom) };
  }
  if (minD === dRight) {
    return { x: rect.right + clearance, y: clamp(pin.y, rect.top, rect.bottom) };
  }
  if (minD === dTop) {
    return { x: clamp(pin.x, rect.left, rect.right), y: rect.top - clearance };
  }
  return { x: clamp(pin.x, rect.left, rect.right), y: rect.bottom + clearance };
}

function orthogonalConnect(a: Point, b: Point): Point[] {
  // Returns [a, ..., b] using 1 or 2 axis-aligned segments.
  if (a.x === b.x || a.y === b.y) return [a, b];
  // Prefer horizontal then vertical
  return [a, { x: b.x, y: a.y }, b];
}

function dedupeConsecutive(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

function simplifyCollinear(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!collinear) out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
}

type Dir = 0 | 1 | 2 | 3; // R, L, D, U
const DIRS: Array<{ dx: number; dy: number; dir: Dir }> = [
  { dx: 1, dy: 0, dir: 0 },
  { dx: -1, dy: 0, dir: 1 },
  { dx: 0, dy: 1, dir: 2 },
  { dx: 0, dy: -1, dir: 3 },
];

class MinHeap<T> {
  private arr: Array<{ k: number; v: T }> = [];
  push(k: number, v: T) {
    const a = this.arr;
    a.push({ k, v });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].k <= a[i].k) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.arr;
    if (a.length === 0) return undefined;
    const top = a[0].v;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].k < a[m].k) m = l;
        if (r < a.length && a[r].k < a[m].k) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.arr.length;
  }
}

function key(x: number, y: number, dir: Dir | 4): string {
  return `${x},${y},${dir}`;
}

function toRectFromXYWH(x: number, y: number, w: number, h: number): Rect {
  return { left: x, top: y, right: x + w, bottom: y + h };
}

function snapToGrid(p: Point, origin: Point, grid: number): { gx: number; gy: number } {
  return {
    gx: Math.round((p.x - origin.x) / grid),
    gy: Math.round((p.y - origin.y) / grid),
  };
}

function gridToWorld(gx: number, gy: number, origin: Point, grid: number): Point {
  return { x: origin.x + gx * grid, y: origin.y + gy * grid };
}

function buildBlockedSet(
  obstacles: Rect[],
  origin: Point,
  grid: number,
  cols: number,
  rows: number
): Set<string> {
  const blocked = new Set<string>();
  for (const o of obstacles) {
    // Convert obstacle extents to grid index range (inclusive)
    const gx0 = Math.floor((o.left - origin.x) / grid);
    const gx1 = Math.ceil((o.right - origin.x) / grid);
    const gy0 = Math.floor((o.top - origin.y) / grid);
    const gy1 = Math.ceil((o.bottom - origin.y) / grid);
    for (let gx = gx0; gx <= gx1; gx++) {
      if (gx < 0 || gx >= cols) continue;
      for (let gy = gy0; gy <= gy1; gy++) {
        if (gy < 0 || gy >= rows) continue;
        blocked.add(`${gx},${gy}`);
      }
    }
  }
  return blocked;
}

function nearestFreeCell(
  start: { gx: number; gy: number },
  blocked: Set<string>,
  cols: number,
  rows: number
): { gx: number; gy: number } | null {
  const startKey = `${start.gx},${start.gy}`;
  if (!blocked.has(startKey) && start.gx >= 0 && start.gx < cols && start.gy >= 0 && start.gy < rows) return start;

  const q: Array<{ gx: number; gy: number }> = [start];
  const seen = new Set<string>([startKey]);
  let qi = 0;

  while (qi < q.length && q.length < 2000) {
    const cur = q[qi++];
    for (const d of DIRS) {
      const nx = cur.gx + d.dx;
      const ny = cur.gy + d.dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      if (!blocked.has(k)) return { gx: nx, gy: ny };
      seen.add(k);
      q.push({ gx: nx, gy: ny });
    }
  }
  return null;
}

function astarGrid(
  start: { gx: number; gy: number },
  goal: { gx: number; gy: number },
  blocked: Set<string>,
  cols: number,
  rows: number,
  bendPenalty: number,
  maxExpanded: number
): Array<{ gx: number; gy: number }> | null {
  const open = new MinHeap<{ gx: number; gy: number; dir: Dir | 4 }>();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();

  const startState = { gx: start.gx, gy: start.gy, dir: 4 as const }; // 4 = no dir
  const startK = key(startState.gx, startState.gy, startState.dir);
  gScore.set(startK, 0);
  open.push(0, startState);

  let expanded = 0;
  while (open.size > 0) {
    const cur = open.pop()!;
    expanded++;
    if (expanded > maxExpanded) return null;

    if (cur.gx === goal.gx && cur.gy === goal.gy) {
      // Reconstruct: pick the best dir variant at goal (we're already at one)
      const path: Array<{ gx: number; gy: number }> = [];
      let ck = key(cur.gx, cur.gy, cur.dir);
      path.push({ gx: cur.gx, gy: cur.gy });
      while (cameFrom.has(ck)) {
        const pk = cameFrom.get(ck)!;
        const [x, y] = pk.split(',', 3).map((s) => parseInt(s, 10));
        path.push({ gx: x, gy: y });
        ck = pk;
      }
      path.reverse();
      return path;
    }

    const curKey = key(cur.gx, cur.gy, cur.dir);
    const curG = gScore.get(curKey);
    if (curG === undefined) continue;

    for (const d of DIRS) {
      const nx = cur.gx + d.dx;
      const ny = cur.gy + d.dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (blocked.has(`${nx},${ny}`) && !(nx === goal.gx && ny === goal.gy)) continue;

      const ndir = d.dir;
      const turnPenalty = cur.dir === 4 || cur.dir === ndir ? 0 : bendPenalty;
      const tentativeG = curG + 1 + turnPenalty;
      const nk = key(nx, ny, ndir);
      const prevBest = gScore.get(nk);
      if (prevBest !== undefined && tentativeG >= prevBest) continue;

      cameFrom.set(nk, curKey);
      gScore.set(nk, tentativeG);
      const h = Math.abs(goal.gx - nx) + Math.abs(goal.gy - ny);
      const f = tentativeG + h;
      open.push(f, { gx: nx, gy: ny, dir: ndir });
    }
  }

  return null;
}

export function routeOrthogonalManhattan(input: RouteOrthogonalInput): Point[] | null {
  const grid = input.gridSize ?? 12;
  const clearance = input.clearance ?? 18;
  const margin = input.margin ?? 180;
  const bendPenalty = input.bendPenalty ?? 6; // grid steps
  const maxExpanded = input.maxExpanded ?? 200_000;

  // Short-circuit: when start and end are very close, use a direct connection
  // instead of running the full A* router (avoids detours caused by inflated obstacles).
  const dx = Math.abs(input.end.x - input.start.x);
  const dy = Math.abs(input.end.y - input.start.y);
  if (dx + dy < clearance * 3) {
    return simplifyCollinear(dedupeConsecutive(orthogonalConnect(input.start, input.end)));
  }

  // Create exit points outside the start/end component bodies (if available).
  // Important: we offset by (clearance + grid) so exits are outside the inflated obstacles,
  // which avoids tiny "micro bends" right at the endpoints.
  const exitOffset = clearance + grid;
  const startExit = input.startRect ? computeExitPoint(input.start, input.startRect, exitOffset) : input.start;
  const endExit = input.endRect ? computeExitPoint(input.end, input.endRect, exitOffset) : input.end;

  // Search bounds: start/end exits plus a margin, and any obstacles intersecting that expanded box
  const baseBounds = expandRect(
    toRectFromXYWH(
      Math.min(startExit.x, endExit.x),
      Math.min(startExit.y, endExit.y),
      Math.abs(startExit.x - endExit.x),
      Math.abs(startExit.y - endExit.y)
    ),
    margin
  );

  const expandedObstacles = input.obstacles
    .map((o) => expandRect(o, clearance))
    .filter((o) => rectIntersects(o, baseBounds));

  // Grid origin aligned, but also "phase shift" it so startExit falls exactly on a grid point.
  // This removes the tiny initial jog that can appear from snapping.
  const baseOriginX = Math.floor(baseBounds.left / grid) * grid;
  const baseOriginY = Math.floor(baseBounds.top / grid) * grid;
  const remX = ((startExit.x - baseOriginX) % grid + grid) % grid;
  const remY = ((startExit.y - baseOriginY) % grid + grid) % grid;
  const origin: Point = {
    x: baseOriginX + remX,
    y: baseOriginY + remY,
  };
  const cols = Math.max(10, Math.ceil((baseBounds.right - origin.x) / grid) + 1);
  const rows = Math.max(10, Math.ceil((baseBounds.bottom - origin.y) / grid) + 1);

  // Safety: avoid gigantic grids (shouldn't happen if bounds are tight)
  if (cols * rows > 250_000) return null;

  const blocked = buildBlockedSet(expandedObstacles, origin, grid, cols, rows);

  const startCell0 = snapToGrid(startExit, origin, grid);
  const goalCell0 = snapToGrid(endExit, origin, grid);

  const startCell = nearestFreeCell(startCell0, blocked, cols, rows);
  const goalCell = nearestFreeCell(goalCell0, blocked, cols, rows);
  if (!startCell || !goalCell) return null;

  // Ensure start/goal cells are usable
  blocked.delete(`${startCell.gx},${startCell.gy}`);
  blocked.delete(`${goalCell.gx},${goalCell.gy}`);

  const gridPath = astarGrid(
    startCell,
    goalCell,
    blocked,
    cols,
    rows,
    bendPenalty,
    maxExpanded
  );
  if (!gridPath) return null;

  const startGridWorld = gridToWorld(startCell.gx, startCell.gy, origin, grid);
  const endGridWorld = gridToWorld(goalCell.gx, goalCell.gy, origin, grid);
  const gridPointsWorld = gridPath.map((p) => gridToWorld(p.gx, p.gy, origin, grid));

  // Connectors + grid path
  // Start: always straight out of the component body
  const p0 = orthogonalConnect(input.start, startExit);
  // Note: startGridWorld is typically == startExit (due to origin alignment), but we keep this robust.
  const p1 = orthogonalConnect(startExit, startGridWorld);
  const p3 = gridPointsWorld;
  // End: route to an exit point, then straight into the pin
  const p4 = orthogonalConnect(endGridWorld, endExit);
  const p5 = orthogonalConnect(endExit, input.end);

  const all = dedupeConsecutive([
    ...p0,
    ...p1.slice(1),
    ...p3.slice(1),
    ...p4.slice(1),
    ...p5.slice(1),
  ]);
  return simplifyCollinear(all);
}

