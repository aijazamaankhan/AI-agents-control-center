const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

export const formatTokens = (n: number) => compact.format(n);
export const formatCost = (n: number) => `$${n < 1 && n > 0 ? n.toFixed(3) : n.toFixed(2)}`;
export const formatClock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
