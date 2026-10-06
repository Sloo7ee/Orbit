"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Couldn’t load this page.</h1>
      <p>
        Your saved data hasn’t been changed. Check your connection and try
        again.
      </p>
      <button className="button button--primary" onClick={reset}>
        Try again
      </button>
      <Link className="auth-link" href="/sign-in">
        Go to sign in
      </Link>
    </main>
  );
}
