import { API_BASE_URL } from "../../api";

// mode pengembangan: email simulasi dibaca lewat endpoint /dev/mailbox milik backend
export default function MailboxHint({ email }) {
  if (!import.meta.env.DEV || !email) return null;
  const url = `${API_BASE_URL}/dev/mailbox?email=${encodeURIComponent(email)}`;
  return (
    <p className="text-xs text-brown-600 bg-cream-50 border border-cream-200 rounded-lg p-3 mt-3">
      Mode pengembangan: email tidak benar-benar dikirim. Isinya bisa dibaca di{" "}
      <a href={url} target="_blank" rel="noreferrer" className="text-brown-700 underline break-all">
        {url}
      </a>
    </p>
  );
}
