export function detectAnomalies(series: number[], threshold = 3) {
  const n = series.length;
  if (n === 0) return { mean: 0, std: 0, anomalies: [] };
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const variance = series.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  const std = Math.sqrt(variance);
  const anomalies: Array<{ index: number; value: number; z: number }> = [];
  series.forEach((v, i) => {
    const z = std === 0 ? 0 : (v - mean) / std;
    if (Math.abs(z) >= threshold) anomalies.push({ index: i, value: v, z });
  });
  return { mean, std, anomalies };
}
