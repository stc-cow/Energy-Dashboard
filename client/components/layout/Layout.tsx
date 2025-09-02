import Header from "./Header";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <Header />
      <main className="container mx-auto px-4 py-6">{children}</main>
      <footer className="mt-10 mb-5 border-t py-6 text-xs text-muted-foreground" style={{ borderTop: "1px solid rgba(137, 14, 230, 1)" }}>
        <div className="container mx-auto px-8">
          © {new Date().getFullYear()} STC — COW Energy Analytics
        </div>
      </footer>
    </div>
  );
}
