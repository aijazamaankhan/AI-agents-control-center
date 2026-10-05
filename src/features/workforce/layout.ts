import type { WorkforceDepartment } from "./types";

/**
 * Lane layout for the workforce map. Departments are unbounded (each company
 * creates its own), so they flow horizontally as lanes off a shared bus from the
 * hub; the canvas grows sideways and scrolls. Agents stack inside their lane,
 * capped at MAX_VISIBLE_AGENTS with a "+N more" chip.
 */
export const LAYOUT = {
  hub: { x: 24, y: 96, width: 236, height: 196 },
  busY: 40,
  laneStart: 312,
  laneWidth: 236,
  cardWidth: 208,
  cardTop: 76,
  cardHeight: 88,
  agentTop: 200,
  agentGap: 70,
  agentHeight: 56,
  padding: 28,
} as const;

export const MAX_VISIBLE_AGENTS = 4;

export interface Point {
  x: number;
  y: number;
}

export interface LaneLayout {
  departmentId: string;
  x: number; // card left
  centerX: number;
  spineX: number;
  agents: { agentId: string; x: number; y: number; cy: number }[];
  overflow: number;
  overflowY: number | null;
  hubPath: string;
  agentPaths: Record<string, string>;
}

export interface MapLayout {
  width: number;
  height: number;
  hubOut: Point;
  lanes: LaneLayout[];
}

/** Path from a department card top, along the bus, into the hub (packets flow toward the hub). */
function hubPathFor(centerX: number, hubOut: Point): string {
  const { busY, laneStart } = LAYOUT;
  const r = 16;
  return [
    `M ${centerX} ${LAYOUT.cardTop}`,
    `L ${centerX} ${busY + r}`,
    `Q ${centerX} ${busY} ${centerX - r} ${busY}`,
    `L ${laneStart - 12} ${busY}`,
    `C ${hubOut.x + 26} ${busY} ${hubOut.x + 10} ${hubOut.y} ${hubOut.x} ${hubOut.y}`,
  ].join(" ");
}

/** Path from an agent chip, up the lane spine, into its department card. */
function agentPathFor(chipLeft: number, cy: number, spineX: number, centerX: number): string {
  const r = 10;
  const cardBottom = LAYOUT.cardTop + LAYOUT.cardHeight;
  return [
    `M ${chipLeft} ${cy}`,
    `L ${spineX + r} ${cy}`,
    `Q ${spineX} ${cy} ${spineX} ${cy - r}`,
    `L ${spineX} ${cardBottom + 22}`,
    `C ${spineX} ${cardBottom + 8} ${centerX} ${cardBottom + 14} ${centerX} ${cardBottom}`,
  ].join(" ");
}

export function computeLayout(departments: WorkforceDepartment[]): MapLayout {
  const { hub, laneStart, laneWidth, cardWidth, agentTop, agentGap, agentHeight, padding } = LAYOUT;
  const hubOut = { x: hub.x + hub.width, y: hub.y + 34 };

  let maxRows = 1;
  const lanes = departments.map((dep, i): LaneLayout => {
    const x = laneStart + i * laneWidth;
    const centerX = x + cardWidth / 2;
    const spineX = x + 10;
    const chipLeft = x + 26;
    const visible = dep.agents.slice(0, MAX_VISIBLE_AGENTS);
    const overflow = Math.max(0, dep.agents.length - visible.length);
    maxRows = Math.max(maxRows, visible.length + (overflow > 0 ? 1 : 0));

    const agents = visible.map((a, row) => {
      const y = agentTop + row * agentGap;
      return { agentId: a.id, x: chipLeft, y, cy: y + agentHeight / 2 };
    });
    const agentPaths = Object.fromEntries(
      agents.map((a) => [a.agentId, agentPathFor(chipLeft, a.cy, spineX, centerX)]),
    );

    return {
      departmentId: dep.id,
      x,
      centerX,
      spineX,
      agents,
      overflow,
      overflowY: overflow > 0 ? agentTop + visible.length * agentGap : null,
      hubPath: hubPathFor(centerX, hubOut),
      agentPaths,
    };
  });

  const width =
    Math.max(laneStart + departments.length * laneWidth, hub.x + hub.width + padding) + padding / 2;
  const height = Math.max(
    hub.y + hub.height + padding,
    agentTop + maxRows * agentGap + padding / 2,
  );
  return { width, height, hubOut, lanes };
}
