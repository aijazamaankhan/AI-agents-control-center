"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{ background: "#070D1A", color: "#EEF4FF", fontFamily: "system-ui, sans-serif" }}
      >
        <main
          style={{
            display: "grid",
            placeItems: "center",
            minHeight: "100dvh",
            textAlign: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong.</h1>
            <p style={{ color: "#8D9BB3", fontSize: 14 }}>Please try again.</p>
            <button
              onClick={reset}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #24324A",
                background: "#111C2D",
                color: "#EEF4FF",
              }}
            >
              Try Again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
