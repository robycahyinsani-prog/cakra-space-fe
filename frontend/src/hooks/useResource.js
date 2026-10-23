import { useCallback, useEffect, useState } from "react";

// memuat data dari API; dimuat ulang saat deps berubah atau reload() dipanggil
export default function useResource(loader, deps) {
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([...deps, version]);
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    let aktif = true;
    loader().then(
      (data) => aktif && setResult({ key, data, error: null }),
      (error) => aktif && setResult({ key, data: null, error })
    );
    return () => {
      aktif = false;
    };
    // loader dibuat ulang tiap render, perubahan cukup dilacak lewat key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((data) => setResult((prev) => ({ ...prev, data })), []);

  return {
    data: result.data,
    error: result.error,
    loading: result.key !== key,
    reload,
    setData,
  };
}
