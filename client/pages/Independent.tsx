import Layout from "@/components/layout/Layout";
import IndependentFilters from "@/components/energy/IndependentFilters";

const SHEET_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_SHEET_URL) ||
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vS0GkXnQMdKYZITuuMsAzeWDtGUqEJ3lWwqNdA67NewOsDOgqsZHKHECEEkea4nrukx4-DqxKmf62nC/pub?gid=1149576218&single=true&output=csv";

export default function Independent() {
  return (
    <Layout>
      <IndependentFilters apiUrl={SHEET_URL} />
    </Layout>
  );
}
