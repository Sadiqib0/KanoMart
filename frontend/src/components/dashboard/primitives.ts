import { escapeHtml, formatPrice, localizeStatus } from "../../utils";

let panelIdCounter = 0;

export type StatCardInput = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
};

export type ActionInput = {
  label: string;
  href?: string;
  route?: string;
  id?: string;
  tone?: "primary" | "secondary";
};

export function renderStatusBadge(status: string, label = status): string {
  const normalized = String(status || "unknown").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const text = label === status ? localizeStatus(status) : label;
  return `<span class="dash-status dash-status-${escapeHtml(normalized)}">${escapeHtml(text)}</span>`;
}

export function renderStatCard(stat: StatCardInput): string {
  return `
    <article class="dash-stat-card" data-tone="${escapeHtml(stat.tone ?? "neutral")}">
      <div class="dash-stat-card-top">
        <span>${escapeHtml(stat.label)}</span>
        <i aria-hidden="true"></i>
      </div>
      <strong>${escapeHtml(String(stat.value))}</strong>
      ${stat.detail ? `<small>${escapeHtml(stat.detail)}</small>` : ""}
    </article>
  `;
}

export function renderStatGrid(stats: StatCardInput[]): string {
  return `<div class="dash-stat-grid">${stats.map(renderStatCard).join("")}</div>`;
}

export function renderEmptyState(title: string, body: string, action?: ActionInput): string {
  return `
    <div class="dash-empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
      ${action ? renderDashboardAction(action) : ""}
    </div>
  `;
}

export function renderErrorState(title: string, body: string): string {
  return `
    <div class="dash-error-state" role="alert">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

export function renderDashboardNote(body: string): string {
  return `<p class="dash-page-note">${escapeHtml(body)}</p>`;
}

export function renderSkeletonCards(count = 4): string {
  return `
    <div class="dash-stat-grid" aria-hidden="true">
      ${Array.from({ length: count }, () => `<article class="dash-stat-card dash-skeleton"><div class="dash-stat-card-top"><span></span><i></i></div><strong></strong><small></small></article>`).join("")}
    </div>
  `;
}

export function renderDashboardAction(action: ActionInput): string {
  const tone = action.tone ?? "primary";
  if (action.href || action.route) {
    const href = action.href ?? `#${action.route}`;
    return `<a class="dash-action dash-action-${tone}" href="${escapeHtml(href)}"${action.route ? ` data-route="${escapeHtml(action.route)}"` : ""}>${escapeHtml(action.label)}</a>`;
  }
  return `<button class="dash-action dash-action-${tone}" type="button"${action.id ? ` id="${escapeHtml(action.id)}"` : ""}>${escapeHtml(action.label)}</button>`;
}

export function renderDashboardHeader(input: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ActionInput[];
}): string {
  return `
    <header class="dash-page-header">
      <div class="dash-header-copy">
        <p class="dash-eyebrow">${escapeHtml(input.eyebrow)}</p>
        <h2>${escapeHtml(input.title)}</h2>
        <p>${escapeHtml(input.description)}</p>
      </div>
      ${input.actions?.length ? `<div class="dash-header-actions">${input.actions.map(renderDashboardAction).join("")}</div>` : ""}
    </header>
  `;
}

export function renderPanel(input: {
  title: string;
  eyebrow?: string;
  action?: ActionInput;
  body: string;
  className?: string;
}): string {
  panelIdCounter += 1;
  const titleId = `dash-panel-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section"}-${panelIdCounter}`;
  return `
    <section class="dash-panel ${escapeHtml(input.className ?? "")}" aria-labelledby="${escapeHtml(titleId)}">
      <div class="dash-panel-heading">
        <div>
          ${input.eyebrow ? `<span>${escapeHtml(input.eyebrow)}</span>` : ""}
          <h3 id="${escapeHtml(titleId)}">${escapeHtml(input.title)}</h3>
        </div>
        ${input.action ? renderDashboardAction({ ...input.action, tone: input.action.tone ?? "secondary" }) : ""}
      </div>
      <div class="dash-panel-body">${input.body}</div>
    </section>
  `;
}

export function renderMiniRows(
  rows: Array<{ title: string; meta?: string; value?: string; status?: string; action?: ActionInput }>,
  empty: { title: string; body: string; action?: ActionInput }
): string {
  if (rows.length === 0) return renderEmptyState(empty.title, empty.body, empty.action);
  return `
    <div class="dash-mini-list">
      ${rows
        .map(
          (row) => `
            <article class="dash-mini-row">
              <div class="dash-mini-row-main">
                <strong>${escapeHtml(row.title)}</strong>
                ${row.meta ? `<span>${escapeHtml(row.meta)}</span>` : ""}
              </div>
              <div class="dash-mini-row-aside">
                ${row.value ? `<b>${escapeHtml(row.value)}</b>` : ""}
                ${row.status ? renderStatusBadge(row.status) : ""}
                ${row.action ? renderDashboardAction({ ...row.action, tone: row.action.tone ?? "secondary" }) : ""}
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderMoney(amount: number | undefined): string {
  return formatPrice(Math.max(0, Number(amount ?? 0) || 0));
}
