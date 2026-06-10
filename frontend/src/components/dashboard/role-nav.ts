import { getDashboardRoutesForRole, type DashboardRole } from "../../router/dashboard-routes";
import { escapeHtml, getCopy } from "../../utils";

export function renderRoleDashboardNav(role: DashboardRole, currentPath: string): string {
  const routes = getDashboardRoutesForRole(role);
  return `
    <nav class="dash-role-nav" data-role="${escapeHtml(role)}" aria-label="${escapeHtml(getCopy("Dashboard sections", "Sassan dashboard"))}">
      ${routes
        .map((route) => {
          const isActive = route.path === currentPath;
          return `
            <a href="#${escapeHtml(route.path)}" data-route="${escapeHtml(route.path)}" class="${isActive ? "is-active" : ""}"${isActive ? ` aria-current="page"` : ""}>
              <strong>${escapeHtml(getCopy(route.label, route.labelHa))}</strong>
              <span>${escapeHtml(getCopy(route.description, route.descriptionHa))}</span>
            </a>
          `;
        })
        .join("")}
    </nav>
  `;
}
