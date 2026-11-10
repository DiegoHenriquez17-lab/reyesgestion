export default function LayoutAcceso({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-marca-900 via-marca-800 to-marca-600 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black ring-1 ring-white/30">R</div>
          <h1 className="text-2xl font-bold">Reyes Gestión</h1>
          <p className="text-sm text-marca-100">Transportes y Turismo Reyes</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">{children}</div>
      </div>
    </main>
  );
}
