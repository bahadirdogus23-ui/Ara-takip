export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-3xl font-extrabold tracking-tight">
          Hafri<span className="text-brand">yol</span>
        </p>
        <p className="mt-1 text-sm text-muted">Şantiye imalat, sefer ve gider takibi</p>
      </div>
      <div className="card">{children}</div>
    </main>
  );
}
