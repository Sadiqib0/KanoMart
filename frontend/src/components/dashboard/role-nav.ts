import { getDashboardRoutesForRole, type DashboardRole } from "../../router/dashboard-routes";
import { escapeHtml } from "../../utils";

export function renderRoleDashboardNav(role: DashboardRole, currentPath: string): string {
  const routes = getDashboardRoutesForRole(role);
  return `
    <nav class="dash-role-nav" aria-label="${escapeHtml(role)} dashboard sections">
      ${routes
        .map(
          (route) => `
            <a href="#${escapeHtml(route.path)}" data-route="${escapeHtml(route.path)}" class="${route.path === currentPath ? "is-active" : ""}">
              <strong>${escapeHtml(route.label)}</strong>
              <span>${escapeHtml(route.description)}</span>
            </a>
          `
        )
        .join("")}
    </nav>
  `;
}
