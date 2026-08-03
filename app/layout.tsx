/**
 * Pass-through root layout.
 *
 * `<html>`/`<body>` live in `app/[lang]/layout.tsx` because they carry the
 * locale's `lang` and `dir`, which are only known once the proxy has resolved
 * the hostname to a locale segment. Next requires a root layout to exist, but
 * allows it to delegate the document shell to a nested one.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
