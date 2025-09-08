import type { Handler } from "@netlify/functions";
import { fetchLowFuelSites } from "../../client/lib/api";

const SUBJECT = "Generator Fuel Alert";
const BODY =
  "Attention: One of the generators has a fuel level below 25%. Please take action.";

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

    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "bannaga.altieb@aces-co.com",
        subject: SUBJECT,
        body: BODY,
        sites: low,
        generatedAt: new Date().toISOString(),
      }),
    });

    return { statusCode: 200, body: "alert sent" };
  } catch (err: any) {
    console.error("fuel-alert error", err);
    return { statusCode: 500, body: "error" };
  }
};
