// Pointy-top hexagonal grid — even-r offset coordinates
// Hex (col, row) center in world space:
//   cx = col * W + (odd row ? W/2 : 0) + W/2
//   cy = row * R * 1.5 + R
// where R = circumradius (center to vertex), W = R * √3

const SQRT3 = Math.sqrt(3);

export function hexR(tileSize: number): number {
  return tileSize / 2;
}

export function hexW(tileSize: number): number {
  return hexR(tileSize) * SQRT3;
}

export function hexVertStep(tileSize: number): number {
  return hexR(tileSize) * 1.5;
}

// World-space center of hex (col, row)
export function hexCenter(col: number, row: number, tileSize: number): { x: number; y: number } {
  const R = hexR(tileSize);
  const W = R * SQRT3;
  return {
    x: col * W + (row % 2 !== 0 ? W / 2 : 0) + W / 2,
    y: row * R * 1.5 + R,
  };
}

// Total pixel bounds of the map
export function hexMapBounds(
  mapWidth: number,
  mapHeight: number,
  tileSize: number
): { w: number; h: number } {
  const R = hexR(tileSize);
  const W = R * SQRT3;
  return {
    w: mapWidth * W + W,
    h: (mapHeight - 1) * R * 1.5 + R * 2,
  };
}

// Pointy-top hex path centered at (cx, cy) with circumradius R
export function hexPathAt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + R * Math.cos(angle);
    const y = cy + R * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Vertex i of a hex centered at (cx, cy) — top vertex = i=0, clockwise
function hexVtx(i: number, cx: number, cy: number, R: number): [number, number] {
  const angle = (Math.PI / 3) * i - Math.PI / 2;
  return [cx + R * Math.cos(angle), cy + R * Math.sin(angle)];
}

// Bevel: highlight top-left edges, shadow bottom-right edges
export function hexBevel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  scale: number
): void {
  ctx.lineWidth = 1.2 / scale;

  const [v5x, v5y] = hexVtx(5, cx, cy, R);
  const [v0x, v0y] = hexVtx(0, cx, cy, R);
  const [v1x, v1y] = hexVtx(1, cx, cy, R);
  ctx.beginPath();
  ctx.moveTo(v5x, v5y);
  ctx.lineTo(v0x, v0y);
  ctx.lineTo(v1x, v1y);
  ctx.strokeStyle = "rgba(255,255,255,0.20)";
  ctx.stroke();

  const [v2x, v2y] = hexVtx(2, cx, cy, R);
  const [v3x, v3y] = hexVtx(3, cx, cy, R);
  const [v4x, v4y] = hexVtx(4, cx, cy, R);
  ctx.beginPath();
  ctx.moveTo(v2x, v2y);
  ctx.lineTo(v3x, v3y);
  ctx.lineTo(v4x, v4y);
  ctx.strokeStyle = "rgba(0,0,0,0.30)";
  ctx.stroke();
}

// Convert world coordinates (wx, wy) to tile (col, row) using cube-coordinate rounding.
// Returns null when outside the map.
export function worldToHex(
  wx: number,
  wy: number,
  tileSize: number,
  mapWidth: number,
  mapHeight: number
): { x: number; y: number } | null {
  const R  = hexR(tileSize);
  const W  = R * SQRT3;

  // Shift so that hex (col=0, row=0) center is at axial origin (0, 0)
  const dx = wx - W / 2;
  const dy = wy - R;

  // Fractional axial coordinates (pointy-top)
  const qf = (dx * (SQRT3 / 3) - dy / 3) / R;
  const rf = (dy * 2) / (3 * R);

  // Cube coordinates
  let cubeX = qf;
  let cubeZ = rf;
  let cubeY = -cubeX - cubeZ;

  // Cube rounding — reset the component with the largest error
  let rx = Math.round(cubeX);
  let ry = Math.round(cubeY);
  let rz = Math.round(cubeZ);

  const ex = Math.abs(rx - cubeX);
  const ey = Math.abs(ry - cubeY);
  const ez = Math.abs(rz - cubeZ);

  if (ex > ey && ex > ez)      rx = -ry - rz;
  else if (ey > ez)            ry = -rx - rz;
  else                         rz = -rx - ry;

  // Axial (q=rx, r=rz) → even-r offset
  const col = rx + (rz - (rz & 1)) / 2;
  const row = rz;

  if (col < 0 || row < 0 || col >= mapWidth || row >= mapHeight) return null;
  return { x: col, y: row };
}
