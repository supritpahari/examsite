"use client";

import { WithMaintenanceCheck } from "./WithMaintenanceCheck";
import { ReactNode } from "react";

export function MaintenanceWrapper({ children }: { children: ReactNode }) {
  return <WithMaintenanceCheck>{children}</WithMaintenanceCheck>;
}