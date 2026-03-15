export type BoundaryDecision =
  | { type: "respond" }
  | { type: "pause"; message?: string }
  | { type: "close"; message: string }
  | { type: "block"; message: string };
