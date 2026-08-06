import { listPositions } from "@/lib/position-store";
import { PositionsClient, type PositionRow } from "./positions-client";

export default async function PositionsPage() {
  const positions = (await listPositions()) as unknown as PositionRow[];
  return <PositionsClient initialPositions={positions} />;
}