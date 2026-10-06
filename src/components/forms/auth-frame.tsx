import Link from "next/link";
import { Orbit } from "lucide-react";
import { ThemeControl } from "@/components/shell/theme-control";
export function AuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-layout">
      <header className="auth-top">
        <Link href="/" className="brand" aria-label="Orbit home">
          <span className="brand-mark">
            <Orbit size={27} strokeWidth={1.5} />
          </span>
          <span>
            orbit<span className="brand-dot">.</span>
          </span>
        </Link>
        <ThemeControl />
      </header>
      <main className="auth-main">
        <section className="auth-card page-enter">
          <span className="auth-emblem" aria-hidden="true">
            <Orbit size={30} strokeWidth={1.3} />
          </span>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </section>
      </main>
      <footer className="auth-footer">Your private academic workspace</footer>
    </div>
  );
}
