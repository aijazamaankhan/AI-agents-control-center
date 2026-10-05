import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AdminHeader, Pill } from "@/features/admin/components/admin-ui";
import { PriceForm } from "@/features/usage/components/price-form";
import { listPrices, unpricedModels } from "@/features/usage/server/pricing-service";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const metadata = { title: "Pricing" };

const usd = (d: { toFixed(n: number): string }) => `$${d.toFixed(6).replace(/0{1,4}$/, "")}`;
const when = (d: Date) =>
  d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requirePlatformAdmin();
  const sp = await searchParams;
  const [prices, unpriced] = await Promise.all([listPrices(admin), unpricedModels(admin)]);
  const now = new Date();
  // The version in force now, exactly as costing picks it: latest effective_from ≤ now, then version.
  const current = new Map<string, (typeof prices)[number]>();
  for (const p of prices) {
    if (p.effectiveFrom > now) continue;
    const best = current.get(p.priceKey);
    if (
      !best ||
      p.effectiveFrom > best.effectiveFrom ||
      (+p.effectiveFrom === +best.effectiveFrom && p.version > best.version)
    )
      current.set(p.priceKey, p);
  }
  const isCurrent = (key: string, id: string) => current.get(key)?.id === id;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <AdminHeader
        title="Pricing"
        description="Model prices in USD per 1M tokens, used to cost every customer's LLM calls. Prices are versioned: adding one never changes costs already calculated."
      />

      {unpriced.length ? (
        <Card className="rounded-[18px] border-warning/40 p-4">
          <h2 className="text-sm font-semibold text-foreground">Models without a price</h2>
          <p className="mt-1 text-xs text-muted">
            These calls currently count as $0 for customers. Add a price and they are costed
            automatically.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Unpriced models">
            {unpriced.map((u) => (
              <li key={u.priceKey}>
                <Link
                  href={`/admin/pricing?${new URLSearchParams({ provider: u.provider, model: u.model })}#add-price`}
                  className="inline-flex items-center gap-2 rounded-full border border-warning/40 px-3 py-1 text-sm text-foreground hover:bg-warning/10"
                >
                  {u.provider} / {u.model}
                  <span className="text-xs text-muted">{u.calls} calls</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card id="add-price" className="scroll-mt-6 rounded-[18px] p-4 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Add a price version</h2>
        <PriceForm
          key={`${sp.provider ?? ""}/${sp.model ?? ""}`}
          provider={typeof sp.provider === "string" ? sp.provider : undefined}
          model={typeof sp.model === "string" ? sp.model : undefined}
        />
        <p className="mt-4 text-xs text-muted">
          Use the provider&apos;s current list prices. Model names are matched case-insensitively;
          spaces and underscores count as hyphens (“Claude Sonnet” = “claude-sonnet”).
        </p>
      </Card>

      <Card className="overflow-x-auto rounded-[18px]">
        <table className="w-full min-w-[760px] text-left text-sm" aria-label="Price list">
          <thead className="text-xs text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 text-right font-medium">Input</th>
              <th className="px-4 py-3 text-right font-medium">Output</th>
              <th className="px-4 py-3 text-right font-medium">Cached</th>
              <th className="px-4 py-3 font-medium">Effective from</th>
              <th className="px-4 py-3 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {prices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No prices yet — add the models your customers use.
                </td>
              </tr>
            ) : (
              prices.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <span className="text-foreground">{p.model}</span>
                    <span className="ml-2 text-xs text-muted">{p.provider}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="mr-2 tabular-nums">v{p.version}</span>
                    {isCurrent(p.priceKey, p.id) ? (
                      <Pill tone="ok">Current</Pill>
                    ) : p.effectiveFrom > now ? (
                      <Pill tone="warn">Scheduled</Pill>
                    ) : (
                      <Pill tone="muted">Superseded</Pill>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{usd(p.inputPerMtok)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{usd(p.outputPerMtok)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{usd(p.cachedPerMtok)}</td>
                  <td className="px-4 py-3 text-xs text-muted">{when(p.effectiveFrom)}</td>
                  <td className="max-w-56 truncate px-4 py-3 text-xs text-muted" title={p.note}>
                    {p.note || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
