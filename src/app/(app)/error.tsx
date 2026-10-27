"use client";

export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="card mx-auto max-w-md text-center">
      <h1 className="text-lg font-bold">Bir şeyler ters gitti</h1>
      <p className="mt-1 text-sm text-muted">
        Sayfa yüklenemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.
      </p>
      <button onClick={reset} className="btn-primary mt-4">
        Tekrar dene
      </button>
    </div>
  );
}
