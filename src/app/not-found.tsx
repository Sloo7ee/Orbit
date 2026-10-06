import Link from "next/link";
export default function NotFound() {
  return (
    <div className="not-found">
      <p className="eyebrow">A SMALL DETOUR</p>
      <h1>This space doesn’t exist.</h1>
      <p>Let’s get you back to familiar ground.</p>
      <Link href="/" className="button button--primary">
        Back to Home
      </Link>
    </div>
  );
}
