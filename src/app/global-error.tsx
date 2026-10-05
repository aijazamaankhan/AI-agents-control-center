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
        style={{ background: "#050607", color: "#EEF3F0", fontFamily: "system-ui, sans-serif" }}
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
            <p style={{ color: "#8B958F", fontSize: 14 }}>Please try again.</p>
            <button
              onClick={reset}
              style={{
                marginTop: 16,
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #2C3237",
                background: "#121518",
                color: "#EEF3F0",
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
