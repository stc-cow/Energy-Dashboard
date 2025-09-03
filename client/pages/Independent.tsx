import Layout from "@/components/layout/Layout";
import IndependentFiltersDashboard from "@/components/energy/IndependentFiltersDashboard";

const SHEET_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SHEET_URL) ||
  "https://docs.google.com/spreadsheets/d/1Y_GvVbzKWb_p1r-xYCjcb4l1EvLwsz47J-7dyyUqh-g/edit?usp=sharing";

export default function Independent() {
  return (
    <Layout>
      <IndependentFiltersDashboard apiUrl={SHEET_URL} />
    </Layout>
  );
}
