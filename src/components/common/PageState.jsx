import { LoaderCircle, TriangleAlert } from "lucide-react";
import Button from "../Button";

// tampilan bersama untuk data yang sedang dimuat atau gagal dimuat
export default function PageState({ loading, error, onRetry, children }) {
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
        <TriangleAlert className="mx-auto text-red-600 mb-2" size={28} />
        <p className="text-brown-800 mb-4">{error.message}</p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Coba lagi
          </Button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-brown-600" role="status">
        <LoaderCircle className="animate-spin" size={20} />
        Memuat data...
      </div>
    );
  }
  return children;
}
