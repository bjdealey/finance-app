// Small numeric helpers. Inputs are plain numbers (pence); callers round money at their boundary.
export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

export const mean = (xs: number[]): number => (xs.length ? sum(xs) / xs.length : 0);

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export const clamp0 = (x: number): number => (x < 0 ? 0 : x);

// Ordinary least-squares fit of ys against x = 0,1,2,… Returns the slope (per step), intercept, R²,
// and the slope's t-statistic (slope / standard error). |t| ≳ 2 means the slope is distinguishable
// from noise at ~95% — a lone spike inflates the residual variance and drives t toward 0, so it does
// NOT read as a trend. ponytail: OLS is leverage-sensitive; swap in Theil–Sen if outliers dominate.
export function linearTrend(ys: number[]): { slope: number; intercept: number; r2: number; t: number } {
  const n = ys.length;
  if (n < 3) return { slope: 0, intercept: n ? ys[0] : 0, r2: 0, t: 0 };
  const xbar = (n - 1) / 2;
  const ybar = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xbar;
    const dy = ys[i] - ybar;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = ybar - slope * xbar;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  const ssRes = Math.max(0, syy - slope * sxy);
  const se = Math.sqrt(ssRes / (n - 2) / sxx);
  const t = se === 0 ? (slope === 0 ? 0 : Infinity) : slope / se; // perfect fit → maximally significant
  return { slope, intercept, r2, t };
}
