/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { WithMaintenanceCheck } from "./WithMaintenanceCheck";
import { ReactNode } from "react";

export function MaintenanceWrapper({ children }: { children: ReactNode }) {
  return <WithMaintenanceCheck>{children}</WithMaintenanceCheck>;
}