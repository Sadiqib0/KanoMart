import { getDashboardRoutesForRole, type DashboardRole } from "../../router/dashboard-routes";
import { escapeHtml, getCopy } from "../../utils";

export function renderRoleDashboardNav(role: DashboardRole, currentPath: string): string {
  const routes = getDashboardRoutesForRole(role);
  return `
    <nav class="dash-role-nav" aria-label="${escapeHtml(role)} dashboard sections">
      ${routes
        .map(
          (route) => `
            <a href="#${escapeHtml(route.path)}" data-route="${escapeHtml(route.path)}" class="${route.path === currentPath ? "is-active" : ""}">
              <strong>${escapeHtml(getCopy(route.label, route.labelHa))}</strong>
              <span>${escapeHtml(getCopy(route.description, route.descriptionHa))}</span>
            </a>
          `
        )
        .join("")}
    </nav>
  `;
}
