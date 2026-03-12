/**
 * MazeGame — Pure Function Unit Tests
 *
 * MazeGame's 3-D scene uses @react-three/fiber Canvas which cannot render in
 * Jest. We test the four pure helpers that contain all the interesting logic:
 *  1. generateMaze()  — recursive backtracker, produces a perfect maze
 *  2. findDeadEnds()  — locates cells with exactly one open passage
 *  3. bfs()           — shortest path through the maze graph
 *  4. buildNumbers()  — produces 4 unique non-negative distractor numbers
 */

// ─── Inline copies of pure helpers (no RN/R3F imports needed) ─────────────────

const COLS = 7;
const ROWS = 7;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateMaze() {
  const cells = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ n: false, s: false, e: false, w: false }))
  );
  const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  function carve(r, c) {
    visited[r][c] = true;
    for (const [dr, dc, d1, d2] of shuffle([
      [-1, 0, 'n', 's'], [1, 0, 's', 'n'], [0, -1, 'w', 'e'], [0, 1, 'e', 'w'],
    ])) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc]) {
        cells[r][c][d1] = true;
        cells[nr][nc][d2] = true;
        carve(nr, nc);
      }
    }
  }
  carve(0, 0);
  return cells;
}

function findDeadEnds(cells, skipR, skipC) {
  const ends = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === skipR && c === skipC) continue;
      const { n, s, e, w } = cells[r][c];
      if ([n, s, e, w].filter(Boolean).length === 1) ends.push([r, c]);
    }
  }
  return ends;
}

function bfs(cells, fromR, fromC, toR, toC) {
  if (fromR === toR && fromC === toC) return [];
  const queue   = [[fromR, fromC, []]];
  const visited = new Set([`${fromR},${fromC}`]);
  while (queue.length) {
    const [r, c, path] = queue.shift();
    for (const [dr, dc, dir] of [[-1,0,'n'],[1,0,'s'],[0,-1,'w'],[0,1,'e']]) {
      if (!cells[r][c][dir]) continue;
      const nr = r + dr, nc = c + dc;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      const newPath = [...path, [nr, nc]];
      if (nr === toR && nc === toC) return newPath;
      visited.add(key);
      queue.push([nr, nc, newPath]);
    }
  }
  return [];
}

function buildNumbers(answer) {
  const set = new Set([answer]);
  let tries = 0;
  while (set.size < 4 && tries < 60) {
    const v = answer + ((Math.floor(Math.random() * 8) - 4) || 1);
    if (v >= 0) set.add(v);
    tries++;
  }
  for (let i = 1; set.size < 4; i++) {
    if (!set.has(answer + i))                          set.add(answer + i);
    else if (answer - i >= 0 && !set.has(answer - i)) set.add(answer - i);
  }
  return shuffle([...set]);
}

// ─── 1. generateMaze() ────────────────────────────────────────────────────────

describe('generateMaze()', () => {
  let maze;
  beforeAll(() => { maze = generateMaze(); });

  test('produces a ROWS×COLS grid', () => {
    expect(maze).toHaveLength(ROWS);
    maze.forEach(row => expect(row).toHaveLength(COLS));
  });

  test('every cell has the four direction keys', () => {
    maze.forEach(row =>
      row.forEach(cell => {
        expect(cell).toHaveProperty('n');
        expect(cell).toHaveProperty('s');
        expect(cell).toHaveProperty('e');
        expect(cell).toHaveProperty('w');
      })
    );
  });

  test('passages are symmetric (if cell A opens to B, B opens back to A)', () => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (maze[r][c].s && r + 1 < ROWS) expect(maze[r + 1][c].n).toBe(true);
        if (maze[r][c].n && r - 1 >= 0)   expect(maze[r - 1][c].s).toBe(true);
        if (maze[r][c].e && c + 1 < COLS) expect(maze[r][c + 1].w).toBe(true);
        if (maze[r][c].w && c - 1 >= 0)   expect(maze[r][c - 1].e).toBe(true);
      }
    }
  });

  test('maze is fully connected (every cell reachable from [0,0])', () => {
    const reached = new Set(['0,0']);
    const queue = [[0, 0]];
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [dr, dc, dir] of [[-1,0,'n'],[1,0,'s'],[0,-1,'w'],[0,1,'e']]) {
        if (!maze[r][c][dir]) continue;
        const key = `${r + dr},${c + dc}`;
        if (!reached.has(key)) { reached.add(key); queue.push([r + dr, c + dc]); }
      }
    }
    expect(reached.size).toBe(ROWS * COLS);
  });

  test('no passage crosses the outer boundary', () => {
    // Top row has no north passage, bottom row has no south, etc.
    for (let c = 0; c < COLS; c++) {
      expect(maze[0][c].n).toBe(false);
      expect(maze[ROWS - 1][c].s).toBe(false);
    }
    for (let r = 0; r < ROWS; r++) {
      expect(maze[r][0].w).toBe(false);
      expect(maze[r][COLS - 1].e).toBe(false);
    }
  });
});

// ─── 2. findDeadEnds() ────────────────────────────────────────────────────────

describe('findDeadEnds()', () => {
  let maze;
  beforeAll(() => { maze = generateMaze(); });

  test('returns an array', () => {
    expect(Array.isArray(findDeadEnds(maze, 0, 0))).toBe(true);
  });

  test('every returned cell has exactly one open passage', () => {
    findDeadEnds(maze, 0, 0).forEach(([r, c]) => {
      const { n, s, e, w } = maze[r][c];
      expect([n, s, e, w].filter(Boolean).length).toBe(1);
    });
  });

  test('does not include the skipped cell', () => {
    const skipR = 0, skipC = 0;
    const ends = findDeadEnds(maze, skipR, skipC);
    expect(ends.every(([r, c]) => !(r === skipR && c === skipC))).toBe(true);
  });

  test('a perfect 7×7 maze has at least one dead end', () => {
    // A perfect maze always has dead ends (leaves of the spanning tree).
    expect(findDeadEnds(maze, -1, -1).length).toBeGreaterThan(0);
  });
});

// ─── 3. bfs() ─────────────────────────────────────────────────────────────────

describe('bfs()', () => {
  // Build a simple 3×1 corridor: [0,0]—[0,1]—[0,2]
  const corridor = [
    [
      { n: false, s: false, e: true,  w: false },
      { n: false, s: false, e: true,  w: true  },
      { n: false, s: false, e: false, w: true  },
    ]
  ];

  test('returns [] when source equals destination', () => {
    const maze = generateMaze();
    expect(bfs(maze, 2, 3, 2, 3)).toEqual([]);
  });

  test('finds the correct path in a simple corridor', () => {
    const path = bfs(corridor, 0, 0, 0, 2);
    // Must pass through [0,1] then [0,2]
    expect(path).toEqual([[0, 1], [0, 2]]);
  });

  test('path length matches grid distance in open corridor', () => {
    const path = bfs(corridor, 0, 0, 0, 2);
    expect(path).toHaveLength(2);
  });

  test('finds path in a real maze (from [0,0] to any dead end)', () => {
    const maze = generateMaze();
    const deadEnds = findDeadEnds(maze, 0, 0);
    if (deadEnds.length > 0) {
      const [toR, toC] = deadEnds[0];
      const path = bfs(maze, 0, 0, toR, toC);
      expect(path.length).toBeGreaterThan(0);
      // Last step must be the destination
      expect(path[path.length - 1]).toEqual([toR, toC]);
    }
  });

  test('returns [] when destination is unreachable', () => {
    // A fully walled cell — no passages out of [0,0]
    const walled = [[
      { n: false, s: false, e: false, w: false },
      { n: false, s: false, e: false, w: false },
    ]];
    expect(bfs(walled, 0, 0, 0, 1)).toEqual([]);
  });
});

// ─── 4. buildNumbers() ───────────────────────────────────────────────────────

const ANSWERS = [0, 1, 5, 10, 18, 20, 100];

describe('buildNumbers(answer)', () => {
  test.each(ANSWERS)('returns exactly 4 numbers for answer=%i', (answer) => {
    expect(buildNumbers(answer)).toHaveLength(4);
  });

  test.each(ANSWERS)('always includes the correct answer for answer=%i', (answer) => {
    expect(buildNumbers(answer)).toContain(answer);
  });

  test.each(ANSWERS)('all values are non-negative for answer=%i', (answer) => {
    buildNumbers(answer).forEach(n => expect(n).toBeGreaterThanOrEqual(0));
  });

  test.each(ANSWERS)('all values are unique for answer=%i', (answer) => {
    const nums = buildNumbers(answer);
    expect(new Set(nums).size).toBe(4);
  });

  test('works for answer=0 — no negatives across many runs', () => {
    for (let i = 0; i < 20; i++) {
      buildNumbers(0).forEach(n => expect(n).toBeGreaterThanOrEqual(0));
    }
  });

  test('output is shuffled (not always answer-first)', () => {
    const positions = Array.from({ length: 20 }, () => buildNumbers(5).indexOf(5));
    expect(positions.every(p => p === 0)).toBe(false);
  });
});
