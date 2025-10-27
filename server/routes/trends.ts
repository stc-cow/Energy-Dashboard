import { Router } from "express";
import { cities as serverCities } from "./data";

const router = Router();

function seededRandom(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildAccumulative(monthsArr: string[], cities: string[]) {
  return monthsArr.map((monthStr, monthIdx) => {
    const monthRow: any = { date: monthStr };
    cities.forEach((city, cityIdx) => {
      const seed = cityIdx + 17;
      const base = Math.round(seededRandom(seed) * 200000) + 50000;
      const noise = Math.round(
        seededRandom(cityIdx * 31 + monthIdx) * base * 0.05,
      );
      const value = Math.round(
        base * ((monthIdx + 1) / monthsArr.length) + noise,
      );
      monthRow[`fuel_consumption_L_${city}`] = value;
      monthRow[`co2_emissions_tons_${city}`] =
        Math.round(((value * 2.68) / 1000) * 100) / 100;
      monthRow[`power_consumption_kWh_${city}`] = Math.round(value * 0.9);
    });
    return monthRow;
  });
}

router.get("/api/trends/accumulative", (req, res) => {
  try {
    const { start = "2025-01", end } = req.query as {
      start?: string;
      end?: string;
    };

    const citiesParam = (req.query.cities as string) || "";
    const cities = citiesParam
      ? citiesParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : serverCities.map((c) => c.name).slice(0, 8);

    const parseMonth = (s: string) => {
      const parts = s.split("-").map(Number);
      return new Date(parts[0], (parts[1] || 1) - 1, 1);
    };

    const startDate = parseMonth(start);
    const endDate = end ? parseMonth(end) : new Date();

    const monthsArr: string[] = [];
    for (
      let m = new Date(startDate);
      m <= endDate;
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
    ) {
      monthsArr.push(
        `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    const accum = buildAccumulative(monthsArr, cities);
    return res.json(accum);
  } catch (err) {
    console.error("accumulative error", err);
    return res.status(500).json({ error: "error building accumulative" });
  }
});

export default router;
