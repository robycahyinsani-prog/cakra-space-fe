export default function Alert({ type = "info", message }) {
  if (!message) return null;

  const styles = {
    success: "bg-green-100 text-green-800 border-green-300",
    error: "bg-red-100 text-red-800 border-red-300",
    info: "bg-blue-100 text-blue-800 border-blue-300",
  };

  return (
    <div className={`px-4 py-3 rounded-lg border mb-4 ${styles[type]}`}>
      {message}
    </div>
  );
}