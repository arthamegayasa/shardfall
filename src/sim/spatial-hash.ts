// Uniform grid over the arena bounds plus margin, rebuilt every tick with a counting sort
// (architecture.md 8.3). Items inside a cell are in ascending slot order. Queries write into a
// caller-owned scratch array and return the count: no callbacks, no allocation.

export interface SpatialHash {
  readonly cellU: number;
  readonly cols: number;
  readonly rows: number;
  /** Rebuild from a pool: items are slots with alive[i] !== 0, i < highWater. */
  build(
    highWater: number,
    alive: ArrayLike<number>,
    x: ArrayLike<number>,
    y: ArrayLike<number>,
  ): void;
  /**
   * Slots whose cell overlaps the circle (x, y, r), in ascending slot order per cell scan.
   * Caller filters by exact distance. Returns how many were written to out (capped at out.length).
   */
  query(x: number, y: number, r: number, out: Int32Array): number;
}

export interface SpatialHashOptions {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly cellU: number;
  readonly capacity: number;
}

export function createSpatialHash(o: SpatialHashOptions): SpatialHash {
  const cols = Math.max(1, Math.ceil((o.maxX - o.minX) / o.cellU));
  const rows = Math.max(1, Math.ceil((o.maxY - o.minY) / o.cellU));
  const cells = cols * rows;
  const cellStart = new Int32Array(cells + 1);
  const cellOf = new Int32Array(o.capacity);
  const items = new Int32Array(o.capacity);
  const fill = new Int32Array(cells);
  const inv = 1 / o.cellU;

  const cellX = (x: number): number => {
    const c = Math.floor((x - o.minX) * inv);
    return c < 0 ? 0 : c >= cols ? cols - 1 : c;
  };
  const cellY = (y: number): number => {
    const r = Math.floor((y - o.minY) * inv);
    return r < 0 ? 0 : r >= rows ? rows - 1 : r;
  };

  return {
    cellU: o.cellU,
    cols,
    rows,
    build(highWater, alive, x, y) {
      cellStart.fill(0);
      for (let i = 0; i < highWater; i++) {
        if (alive[i] === 0) {
          cellOf[i] = -1;
          continue;
        }
        const c = cellY(y[i] ?? 0) * cols + cellX(x[i] ?? 0);
        cellOf[i] = c;
        cellStart[c + 1] = (cellStart[c + 1] ?? 0) + 1;
      }
      for (let c = 0; c < cells; c++)
        cellStart[c + 1] = (cellStart[c + 1] ?? 0) + (cellStart[c] ?? 0);
      for (let c = 0; c < cells; c++) fill[c] = cellStart[c] ?? 0;
      for (let i = 0; i < highWater; i++) {
        const c = cellOf[i] ?? -1;
        if (c < 0) continue;
        const at = fill[c] ?? 0;
        items[at] = i;
        fill[c] = at + 1;
      }
    },
    query(x, y, r, out) {
      const c0 = cellX(x - r);
      const c1 = cellX(x + r);
      const r0 = cellY(y - r);
      const r1 = cellY(y + r);
      let n = 0;
      const max = out.length;
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const c = row * cols + col;
          const end = cellStart[c + 1] ?? 0;
          for (let k = cellStart[c] ?? 0; k < end; k++) {
            if (n >= max) return n;
            out[n++] = items[k] ?? 0;
          }
        }
      }
      return n;
    },
  };
}
