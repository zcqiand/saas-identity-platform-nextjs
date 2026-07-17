import { listPositions } from "@/lib/position-store";
import { PositionsClient, type PositionRow } from "./positions-client";

export default function PositionsPage() {
  const positions = listPositions() as unknown as PositionRow[];
  return <PositionsClient initialPositions={positions} />;
}