import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  getHierarchy,
  getKPIs,
  getTimeSeries,
  getBenchmark,
  getAlerts,
  getBreakdownByRegion,
  getBreakdownBySite,
} from "./routes/energy";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Energy Dashboard APIs
  app.get("/api/hierarchy", getHierarchy);
  app.get("/api/kpis", getKPIs);
  app.get("/api/timeseries", getTimeSeries);
  app.get("/api/breakdown/region", getBreakdownByRegion);
  app.get("/api/breakdown/site", getBreakdownBySite);
  app.get("/api/benchmark", getBenchmark);
  app.get("/api/alerts", getAlerts);

  // Manual trigger to send a test fuel alert email via Zapier
  app.post("/api/test-fuel-email", async (req, res) => {
    try {
      const webhook = process.env.ZAPIER_WEBHOOK_URL;
      if (!webhook) return res.status(200).json({ ok: true, note: "webhook not configured" });

      const to = (req.body?.to as string) || "bannaga.altieb@aces-co.com";
      const siteId = (req.body?.siteId as string) || "test-site";
      const subject = "Generator Fuel Alert";
      const body = `Dear Team,  This is an automated notification. The fuel level for Site ID: ${siteId} has dropped below 25%.  Please arrange for immediate refueling to avoid downtime.  Regards, Monitoring Dashboard ACES Co.`;

      const resp = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, site: { siteId }, generatedAt: new Date().toISOString() }),
      });

      return res.json({ ok: true, status: resp.status });
    } catch (e) {
      return res.status(500).json({ ok: false });
    }
  });

  return app;
}
