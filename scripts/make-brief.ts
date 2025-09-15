import PptxGenJS from "pptxgenjs";

async function fetchScreenshot(url: string) {
  const thum = `https://image.thum.io/get/width/1600/${encodeURIComponent(url)}`;
  const res = await fetch(thum, { cache: "no-store" });
  if (!res.ok) throw new Error(`screenshot fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function makeBrief() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";

  const slide = pptx.addSlide();
  // Title
  slide.addText("COW Predictive Energy Dashboard", {
    x: 0.4, y: 0.3, w: 12.6, h: 0.6,
    fontSize: 28, bold: true, color: "#5C0BA2",
  });
  // Subtitle bullets
  slide.addText([
    { text: "Live KPIs: Diesel, Elec. Power, CO₂", options: { bullet: true } },
    { text: "Filters: Region, District, City, Site", options: { bullet: true } },
    { text: "Status ticker and regional breakdown", options: { bullet: true } },
    { text: "Accumulated metrics from 01/01/2025", options: { bullet: true } },
  ], { x: 0.4, y: 0.9, w: 12.2, fontSize: 16, color: "#333" });

  // Screenshot
  const url = process.env.DASHBOARD_URL || "https://dbadbf7db6cb4fc790d7fec680240bb0-b7787409c20e41169bf893bf6.fly.dev/";
  const img = await fetchScreenshot(url);
  const data = `image/png;base64,${img.toString("base64")}`;
  slide.addImage({ data, x: 0.3, y: 1.6, w: 12.8 });

  const outPath = "../docs/cow-dashboard-brief.pptx";
  await pptx.writeFile({ fileName: outPath });
  // eslint-disable-next-line no-console
  console.log(`Saved ${outPath}`);
}

makeBrief().catch((e) => {
  console.error(e);
  process.exit(1);
});
