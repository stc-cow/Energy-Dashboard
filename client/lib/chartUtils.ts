/**
 * Transform daily data to accumulative (running total)
 */
export function makeCumulative(
  data: Array<{ [key: string]: any }>,
  keys: string[],
): Array<{ [key: string]: any }> {
  return data.map((row, idx) => {
    const result = { ...row };
    keys.forEach((key) => {
      if (idx === 0) {
        result[key] = row[key] ?? 0;
      } else {
        const prevValue = data[idx - 1][key] ?? 0;
        result[key] = (prevValue ?? 0) + (row[key] ?? 0);
      }
    });
    return result;
  });
}

/**
 * Extract specific metric for all cities from raw data
 */
export function extractMetricByCities(
  data: Array<{ [key: string]: any }>,
  metricBase: string,
  cities: string[],
): Array<{ [key: string]: any }> {
  return data.map((row) => {
    const result: any = { date: row.date };
    cities.forEach((city) => {
      const key = `${metricBase}_${city}`;
      result[city] = row[key] ?? 0;
    });
    return result;
  });
}
