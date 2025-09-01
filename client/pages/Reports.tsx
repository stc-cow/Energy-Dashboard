import Layout from "@/components/layout/Layout";

export default function Reports() {
  return (
    <Layout>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">Exportable management reports will appear here. Ask to customize KPIs, time ranges, and formats (PDF/XLSX/CSV).</p>
        <div className="mt-6 rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          This is a placeholder. Connect your SQL Server and define report templates to enable one-click exports.
        </div>
      </div>
    </Layout>
  );
}
