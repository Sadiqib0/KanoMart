import { renderRoleDashboardNav } from "./role-nav";
import type { DashboardRole } from "../../router/dashboard-routes";

/**
 * Two-column dashboard layout: sticky section sidebar on the left,
 * the currently routed section filling the rest of the page.
 * Collapses to a horizontal scrollable nav on small screens (CSS).
 */
export function renderDashShell(role: DashboardRole, currentPath: string, content: string): string {
  return `
    <div class="dash-shell dash-shell-${role}">
      <aside class="dash-sidebar">${renderRoleDashboardNav(role, currentPath)}</aside>
      <div class="dash-content">${content}</div>
    </div>
  `;
}
