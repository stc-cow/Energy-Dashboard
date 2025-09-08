import type { Handler } from "@netlify/functions";
import { fetchLowFuelSites } from "../../client/lib/api";

const SUBJECT = "Generator Fuel Alert";

export const handler: Handler = async () => {
  try {
    const low = await fetchLowFuelSites(25);
    if (!low.length) {
      return { statusCode: 200, body: "no alerts" };
    }

    const webhook = process.env.ZAPIER_WEBHOOK_URL;
    if (!webhook) {
      console.warn("ZAPIER_WEBHOOK_URL not set; skipping email send");
      return { statusCode: 200, body: "webhook not configured" };
    }

    // Send one email per affected site with tailored body
    for (const s of low) {
      const body = `Dear Team,  This is an automated notification. The fuel level for Site ID: ${s.siteId} has dropped below 25%.  Please arrange for immediate refueling to avoid downtime.  Regards, Monitoring Dashboard ACES Co.`;
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: "bannaga.altieb@aces-co.com",
          subject: SUBJECT,
          body,
          site: s,
          generatedAt: new Date().toISOString(),
        }),
      });
    }

    return { statusCode: 200, body: `sent ${low.length} alerts` };
  } catch (err: any) {
    console.error("fuel-alert error", err);
    return { statusCode: 500, body: "error" };
  }
};
