export default function LoadingCard({ title = "Cargando..." }: { title?: string }) {
  return (
    <div className="container py-10">
      <div className="card max-w-lg mx-auto">
        <div className="card-h">
          <div className="text-lg font-extrabold">{title}</div>
        </div>
        <div className="card-b">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    </div>
  );
}