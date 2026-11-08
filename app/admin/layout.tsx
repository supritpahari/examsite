/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
import { AdminGate } from "@/app/providers/AdminGate";
import type { ReactNode } from "react";
import FormulaMarks from "../_components/FormulaMarks";
import "./admin.css";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <FormulaMarks />
      <AdminGate>{children}</AdminGate>
    </div>
  );
}