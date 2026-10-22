const STORAGE_KEY = "shiptrack_amazon_portal_v1";

let records = loadRecords();
let activeDetailId = null;
let toastTimer;

const $ = (id) => document.getElementById(id);

function localDate(date = new Date()) {
  if (typeof date === "string") {
    return normalizeDate(date);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(raw) {
  if (!raw) return localDate();
  const str = String(raw).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD/YYYY or M/D/YYYY or MM/DD/YY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) {
    const parts = str.split("/");
    const m = parts[0].padStart(2, "0");
    const d = parts[1].padStart(2, "0");
    let y = parts[2];
    if (y.length === 2) {
      y = Number(y) > 50 ? `19${y}` : `20${y}`;
    }
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY or DD.MM.YYYY
  if (/^\d{1,2}[-.]\d{1,2}[-.]\d{2,4}$/.test(str)) {
    const parts = str.split(/[-.]/);
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    let y = parts[2];
    if (y.length === 2) {
      y = Number(y) > 50 ? `19${y}` : `20${y}`;
    }
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return str;
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(value = "") {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function loadRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((r) => {
          r.date = normalizeDate(r.date);
        });
        return parsed;
      }
    }
  } catch (error) {
    console.error("Could not load saved records", error);
  }

  const today = localDate();
  const yesterday = localDate(new Date(Date.now() - 86400000));

  return []
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function statusOf(record) {
  if (!record.asins || !record.asins.length) return "Pending";
  const statuses = record.asins.map((a) => a.status);
  if (statuses.every((s) => s === "Submitted")) return "Submitted";
  if (statuses.every((s) => s === "Rejected")) return "Rejected";
  if (statuses.every((s) => s === "Pending")) return "Pending";
  return "Mixed";
}

function statusBadge(status) {
  const css =
    {
      Submitted: "status-submitted",
      Rejected: "status-rejected",
      Pending: "status-pending",
      Mixed: "status-mixed",
    }[status] || "status-pending";

  return `<span class="status-badge ${css}">${escapeHtml(status)}</span>`;
}

function getFilteredRecords() {
  const from = $("fromDate").value ? normalizeDate($("fromDate").value) : "";
  const to = $("toDate").value ? normalizeDate($("toDate").value) : "";
  return records.filter((r) => {
    const d = normalizeDate(r.date);
    return (!from || d >= from) && (!to || d <= to);
  });
}

function renderDashboard() {
  const filtered = getFilteredRecords();

  $("totalRefs").textContent = filtered.length;
  $("totalUnits").textContent = filtered.reduce(
    (sum, r) => sum + Number(r.units || 0),
    0,
  );

  const allAsins = filtered.flatMap((r) => r.asins || []);
  $("totalSubmitted").textContent = allAsins.filter(
    (a) => a.status === "Submitted",
  ).length;
  $("totalRejected").textContent = allAsins.filter(
    (a) => a.status === "Rejected",
  ).length;

  const recent = [...filtered]
    .sort((a, b) => normalizeDate(b.date).localeCompare(normalizeDate(a.date)))
    .slice(0, 8);
  const copyIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

  $("recentTable").innerHTML = recent.length
    ? recent
        .map((r) => {
          const asinsHtml = (r.asins || []).length
            ? `<div class="asin-list-cell">${(r.asins || [])
                .map(
                  (a) => `
                <span class="asin-item">
                  <span>${escapeHtml(a.asin)}</span>
                  <button type="button" class="copy-btn" data-copy="${escapeHtml(a.asin)}" title="Copy ASIN ${escapeHtml(a.asin)}">${copyIconSvg}</button>
                </span>
              `,
                )
                .join("")}</div>`
            : `<span style="color: #94a3b8;">—</span>`;

          return `
            <tr>
              <td>${escapeHtml(r.date)}</td>
              <td>
                <span class="ref-box">
                  <strong>${escapeHtml(r.refNo)}</strong>
                  <button type="button" class="copy-btn" data-copy="${escapeHtml(r.refNo)}" title="Copy Reference No ${escapeHtml(r.refNo)}">${copyIconSvg}</button>
                </span>
              </td>
              <td>${asinsHtml}</td>
              <td>${escapeHtml(r.employee)}</td>
              <td>${Number(r.units || 0).toLocaleString()}</td>
              <td>${statusBadge(statusOf(r))}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td class="empty-cell" colspan="6">No references found for this date range.</td></tr>`;

  const counts = [
    {
      name: "Submitted",
      color: "#10b981",
      count: allAsins.filter((a) => a.status === "Submitted").length,
    },
    {
      name: "Pending",
      color: "#f59e0b",
      count: allAsins.filter((a) => a.status === "Pending").length,
    },
    {
      name: "Rejected",
      color: "#f43f5e",
      count: allAsins.filter((a) => a.status === "Rejected").length,
    },
  ];
  const total = allAsins.length;

  $("statusSummary").innerHTML = total
    ? counts
        .map(
          (item) => `
    <div class="summary-line">
      <div class="summary-meta"><span>${item.name}</span><strong>${item.count} (${Math.round((item.count / total) * 100)}%)</strong></div>
      <div class="progress-track"><div class="progress-fill" style="width:${(item.count / total) * 100}%;background:${item.color}"></div></div>
    </div>
  `,
        )
        .join("")
    : `<p class="empty-cell">No ASIN data available.</p>`;

  // --- Employee-wise Summary ---
  const empSummaryEl = $("employeeSummaryGrid");
  if (!empSummaryEl) return;

  const empMap = new Map();
  filtered.forEach((r) => {
    const name = r.employee.trim();
    if (!name) return;
    if (!empMap.has(name)) {
      empMap.set(name, { refs: 0, units: 0, subAsins: 0, rejAsins: 0, subUnits: 0, rejUnits: 0 });
    }
    const e = empMap.get(name);
    e.refs++;
    e.units += Number(r.units || 0);
    const rAsins = r.asins || [];
    const rTotal = rAsins.length || 1;
    const rSub = rAsins.filter((a) => a.status === "Submitted").length;
    const rRej = rAsins.filter((a) => a.status === "Rejected").length;
    e.subAsins += rSub;
    e.rejAsins += rRej;
    e.subUnits += Math.round(Number(r.units || 0) * (rSub / rTotal));
    e.rejUnits += Math.round(Number(r.units || 0) * (rRej / rTotal));
  });

  const empEntries = [...empMap.entries()].sort((a, b) => b[1].units - a[1].units);

  if (!empEntries.length) {
    empSummaryEl.innerHTML = `<p class="empty-cell" style="padding:20px 0;">No employee data for the selected range.</p>`;
    return;
  }

  const maxUnits = Math.max(...empEntries.map(([, e]) => e.units), 1);

  empSummaryEl.innerHTML = empEntries.map(([name, e]) => {
    const subPct = e.units ? Math.round((e.subUnits / e.units) * 100) : 0;
    const rejPct = e.units ? Math.round((e.rejUnits / e.units) * 100) : 0;
    const barWidth = Math.round((e.units / maxUnits) * 100);
    const initial = name.charAt(0).toUpperCase();
    return `
    <div class="emp-sum-card">
      <div class="emp-sum-top">
        <div class="emp-sum-avatar">${escapeHtml(initial)}</div>
        <div class="emp-sum-info">
          <div class="emp-sum-name">${escapeHtml(name)}</div>
          <div class="emp-sum-refs">${e.refs} reference${e.refs !== 1 ? "s" : ""}</div>
        </div>
        <div class="emp-sum-units">${e.units.toLocaleString()}<span>units</span></div>
      </div>
      <div class="emp-sum-bar-track">
        <div class="emp-sum-bar-fill" style="width:${barWidth}%"></div>
      </div>
      <div class="emp-sum-metrics">
        <div class="emp-sum-metric green">
          <span class="emp-sum-label">✓ Submitted</span>
          <span class="emp-sum-val">${e.subAsins} ASINs · ${e.subUnits.toLocaleString()} units (${subPct}%)</span>
        </div>
        <div class="emp-sum-metric red">
          <span class="emp-sum-label">✕ Rejected</span>
          <span class="emp-sum-val">${e.rejAsins} ASINs · ${e.rejUnits.toLocaleString()} units (${rejPct}%)</span>
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ── Collapsible Panel Toggle ── */
function togglePanel(panelId) {
  const panel = $(panelId);
  if (!panel) return;
  panel.classList.toggle("open");
}
window.togglePanel = togglePanel;

/* ── Date Preset Helper ── */
function applyDatePreset(type, fromId, toId, callback) {
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let from = "";
  let to = "";

  if (type === "today") {
    from = fmt(today);
    to = fmt(today);
  } else if (type === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    from = fmt(y);
    to = fmt(y);
  } else if (type === "7days") {
    const d7 = new Date(today);
    d7.setDate(d7.getDate() - 6);
    from = fmt(d7);
    to = fmt(today);
  } else if (type === "30days") {
    const d30 = new Date(today);
    d30.setDate(d30.getDate() - 29);
    from = fmt(d30);
    to = fmt(today);
  } else if (type === "thisMonth") {
    const m1 = new Date(today.getFullYear(), today.getMonth(), 1);
    from = fmt(m1);
    to = fmt(today);
  } else if (type === "all") {
    from = "";
    to = "";
  }

  const fEl = $(fromId);
  const tEl = $(toId);
  if (fEl) fEl.value = from;
  if (tEl) tEl.value = to;

  if (callback) callback();
}

/* ── Reference Tracking Filters & Render ── */
function populateRefFilterDropdowns() {
  const empSelect = $("refFilterEmployee");
  const compSelect = $("refFilterCompany");

  if (empSelect) {
    const curEmp = empSelect.value;
    const emps = [...new Set(records.map((r) => r.employee.trim()).filter(Boolean))].sort();
    empSelect.innerHTML =
      `<option value="">All Employees (${emps.length})</option>` +
      emps.map((e) => `<option value="${escapeHtml(e)}" ${e === curEmp ? "selected" : ""}>${escapeHtml(e)}</option>`).join("");
  }

  if (compSelect) {
    const curComp = compSelect.value;
    const comps = [...new Set(records.map((r) => (r.company || "").trim()).filter(Boolean))].sort();
    compSelect.innerHTML =
      `<option value="">All Companies (${comps.length})</option>` +
      comps.map((c) => `<option value="${escapeHtml(c)}" ${c === curComp ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
  }
}

function renderRefFilterTags(active) {
  const container = $("refFilterTags");
  if (!container) return;
  const tags = [];
  if (active.from || active.to) {
    tags.push({
      label: `📅 ${active.from || '...'} → ${active.to || '...'}`,
      clear: () => {
        if ($("refFilterFrom")) $("refFilterFrom").value = "";
        if ($("refFilterTo")) $("refFilterTo").value = "";
      },
    });
  }
  if (active.employee) {
    tags.push({
      label: `👤 Associate: ${active.employee}`,
      clear: () => {
        if ($("refFilterEmployee")) $("refFilterEmployee").value = "";
      },
    });
  }
  if (active.company) {
    tags.push({
      label: `🏢 Company: ${active.company}`,
      clear: () => {
        if ($("refFilterCompany")) $("refFilterCompany").value = "";
      },
    });
  }
  if (active.status) {
    tags.push({
      label: `🏷️ Status: ${active.status}`,
      clear: () => {
        if ($("refFilterStatus")) $("refFilterStatus").value = "";
      },
    });
  }
  if (active.query) {
    tags.push({
      label: `🔍 "${active.query}"`,
      clear: () => {
        if ($("referenceSearch")) $("referenceSearch").value = "";
      },
    });
  }

  container.innerHTML = tags
    .map(
      (t, idx) => `
    <span class="filter-tag">
      ${escapeHtml(t.label)}
      <span class="filter-tag-close" data-clear-tag="${idx}">✕</span>
    </span>
  `,
    )
    .join("");

  container.querySelectorAll("[data-clear-tag]").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.clearTag);
      if (tags[idx]) {
        tags[idx].clear();
        renderReferences();
      }
    });
  });
}

function renderReferences() {
  populateRefFilterDropdowns();

  const query = ($("referenceSearch")?.value || "").trim().toLowerCase();
  const from = $("refFilterFrom")?.value ? normalizeDate($("refFilterFrom").value) : "";
  const to = $("refFilterTo")?.value ? normalizeDate($("refFilterTo").value) : "";
  const employee = ($("refFilterEmployee")?.value || "").trim();
  const company = ($("refFilterCompany")?.value || "").trim();
  const status = ($("refFilterStatus")?.value || "").trim();
  const sortBy = $("refFilterSort")?.value || "date_desc";

  // Multi-criteria Filtering
  const filtered = records.filter((r) => {
    const d = normalizeDate(r.date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (employee && r.employee.trim() !== employee) return false;
    if (company && (r.company || "").trim() !== company) return false;
    if (status && statusOf(r) !== status) return false;

    if (query) {
      const matchHeader = [r.refNo, r.employee, r.company].some((v) =>
        String(v || "").toLowerCase().includes(query),
      );
      const matchAsin = (r.asins || []).some((a) =>
        String(a.asin || "").toLowerCase().includes(query),
      );
      if (!matchHeader && !matchAsin) return false;
    }
    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === "date_desc") return normalizeDate(b.date).localeCompare(normalizeDate(a.date));
    if (sortBy === "date_asc") return normalizeDate(a.date).localeCompare(normalizeDate(b.date));
    if (sortBy === "units_desc") return Number(b.units || 0) - Number(a.units || 0);
    if (sortBy === "units_asc") return Number(a.units || 0) - Number(b.units || 0);
    if (sortBy === "ref_asc") return String(a.refNo || "").localeCompare(String(b.refNo || ""));
    return 0;
  });

  const copyIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

  $("referencesTable").innerHTML = filtered.length
    ? filtered
        .map(
          (r) => `
    <tr>
      <td>${escapeHtml(r.date)}</td>
      <td>
        <span class="ref-box">
          <strong>${escapeHtml(r.refNo)}</strong>
          <button type="button" class="copy-btn" data-copy="${escapeHtml(r.refNo)}" title="Copy Reference No ${escapeHtml(r.refNo)}">${copyIconSvg}</button>
        </span>
      </td>
      <td>${escapeHtml(r.employee)}</td>
      <td>${escapeHtml(r.company || "—")}</td>
      <td><strong>${Number(r.units || 0).toLocaleString()}</strong></td>
      <td>${statusBadge(statusOf(r))}</td>
      <td>
        <button class="action-btn" data-detail="${r.id}">Details</button>
        <button class="action-btn" data-edit="${r.id}">Edit</button>
        <button class="action-btn danger" data-delete="${r.id}">Delete</button>
      </td>
    </tr>
  `,
        )
        .join("")
    : `<tr><td class="empty-cell" colspan="7">No shipments found matching these filters.</td></tr>`;

  // Update Result Count Badge
  const totalUnits = filtered.reduce((s, r) => s + Number(r.units || 0), 0);
  if ($("refResultCount")) {
    $("refResultCount").innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${records.length}</strong> shipments (${totalUnits.toLocaleString()} units)`;
  }

  // Render Filter Tags
  renderRefFilterTags({ from, to, employee, company, status, query });

  // Update Analytics panels with the filtered dataset!
  renderCompanyAnalytics(filtered);
  renderAsinAnalytics(filtered);
}

/* ── Employee Performance Filters & Render ── */
function populateEmpFilterDropdowns() {
  const compSelect = $("empFilterCompany");
  if (compSelect) {
    const curComp = compSelect.value;
    const comps = [...new Set(records.map((r) => (r.company || "").trim()).filter(Boolean))].sort();
    compSelect.innerHTML =
      `<option value="">All Companies (${comps.length})</option>` +
      comps.map((c) => `<option value="${escapeHtml(c)}" ${c === curComp ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
  }
}

function getEmployeeStats(filteredRecs = records, query = "", sortBy = "units_desc") {
  const allNames = [...new Set(records.map((r) => r.employee.trim()).filter(Boolean))];
  let names = allNames;
  if (query) {
    names = names.filter((n) => n.toLowerCase().includes(query.toLowerCase()));
  }

  const list = names
    .map((name) => {
      const own = filteredRecs.filter((r) => r.employee.trim() === name);
      const asins = own.flatMap((r) => r.asins || []);
      const units = own.reduce((sum, r) => sum + Number(r.units || 0), 0);
      const submitted = asins.filter((a) => a.status === "Submitted").length;
      const rejected = asins.filter((a) => a.status === "Rejected").length;
      const subRate = asins.length ? Math.round((submitted / asins.length) * 100) : 0;
      return {
        name,
        refs: own.length,
        units,
        submitted,
        rejected,
        subRate,
      };
    })
    .filter((e) => e.refs > 0 || !filteredRecs.length);

  // Sorting
  list.sort((a, b) => {
    if (sortBy === "units_desc") return b.units - a.units;
    if (sortBy === "refs_desc") return b.refs - a.refs;
    if (sortBy === "sub_rate_desc") return b.subRate - a.subRate;
    if (sortBy === "rej_desc") return b.rejected - a.rejected;
    return b.units - a.units;
  });

  return list;
}

function renderEmployees() {
  populateEmpFilterDropdowns();

  const from = $("empFilterFrom")?.value ? normalizeDate($("empFilterFrom").value) : "";
  const to = $("empFilterTo")?.value ? normalizeDate($("empFilterTo").value) : "";
  const company = ($("empFilterCompany")?.value || "").trim();
  const query = ($("empSearchInput")?.value || "").trim().toLowerCase();
  const sortBy = $("empFilterSort")?.value || "units_desc";

  const filteredRecs = records.filter((r) => {
    const d = normalizeDate(r.date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (company && (r.company || "").trim() !== company) return false;
    return true;
  });

  const stats = getEmployeeStats(filteredRecs, query, sortBy);

  // Result Badge
  if ($("empResultCount")) {
    $("empResultCount").innerHTML = `Showing <strong>${stats.length}</strong> associate${stats.length !== 1 ? 's' : ''}`;
  }

  // Active filter tags for employees
  const tagContainer = $("empFilterTags");
  if (tagContainer) {
    const tags = [];
    if (from || to) tags.push(`📅 ${from || '...'} → ${to || '...'}`);
    if (company) tags.push(`🏢 Company: ${company}`);
    if (query) tags.push(`🔍 "${query}"`);
    tagContainer.innerHTML = tags
      .map((t) => `<span class="filter-tag">${escapeHtml(t)}</span>`)
      .join("");
  }

  $("employeeCards").innerHTML = stats.length
    ? stats
        .map(
          (e) => `
    <article class="employee-card">
      <div class="employee-avatar">${escapeHtml(e.name.charAt(0).toUpperCase())}</div>
      <h3>${escapeHtml(e.name)}</h3>
      <p>Shipment performance</p>
      <div class="employee-metrics">
        <div><strong>${e.refs}</strong><span>Shipments</span></div>
        <div><strong>${e.units.toLocaleString()}</strong><span>Total units</span></div>
      </div>
    </article>
  `,
        )
        .join("")
    : `<div class="panel"><p class="empty-cell">No employee records match the selected filter.</p></div>`;

  $("employeeTable").innerHTML = stats.length
    ? stats
        .map(
          (e) => `
    <tr>
      <td><strong>${escapeHtml(e.name)}</strong></td>
      <td>${e.refs}</td>
      <td><strong>${e.units.toLocaleString()}</strong></td>
      <td><span style="color:#16875c;font-weight:600;">${e.submitted}</span></td>
      <td><span style="color:#d84a57;font-weight:600;">${e.rejected}</span></td>
    </tr>
  `,
        )
        .join("")
    : `<tr><td colspan="5" class="empty-cell">No data available.</td></tr>`;

  renderEmpCompanyBreakdown(filteredRecs);
  renderEmpAsinBreakdown(filteredRecs);
}

/* ── Company Analytics (Reference Tracking) ── */
function renderCompanyAnalytics(sourceRecords = records) {
  const el = $("companyAnalytics");
  if (!el) return;

  const compMap = new Map();
  sourceRecords.forEach((r) => {
    const co = (r.company || "Unknown").trim();
    if (!compMap.has(co)) compMap.set(co, { refs: 0, units: 0 });
    const c = compMap.get(co);
    c.refs++;
    c.units += Number(r.units || 0);
  });

  const entries = [...compMap.entries()].sort((a, b) => b[1].units - a[1].units);
  if (!entries.length) {
    el.innerHTML = `<p class="empty-cell" style="padding:16px 0">No company data for current filter.</p>`;
    return;
  }
  const maxUnits = Math.max(...entries.map(([, c]) => c.units), 1);

  el.innerHTML = entries
    .map(([co, c]) => {
      const pct = Math.round((c.units / maxUnits) * 100);
      return `
      <div class="analytics-item">
        <div class="analytics-item-header">
          <span class="analytics-item-label" title="${escapeHtml(co)}">${escapeHtml(co)}</span>
          <span class="analytics-item-meta"><strong>${c.refs}</strong> shipment${c.refs !== 1 ? 's' : ''} · <strong>${c.units.toLocaleString()}</strong> units</span>
        </div>
        <div class="analytics-bar-track">
          <div class="analytics-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
    })
    .join("");
}

/* ── ASIN Analytics (Reference Tracking) ── */
function renderAsinAnalytics(sourceRecords = records) {
  const el = $("asinAnalytics");
  if (!el) return;

  const asinMap = new Map();
  sourceRecords.forEach((r) => {
    const units = Number(r.units || 0);
    const asins = r.asins || [];
    const perAsin = asins.length ? Math.round(units / asins.length) : units;
    asins.forEach((a) => {
      const key = (a.asin || "Unknown").trim();
      if (!asinMap.has(key)) asinMap.set(key, { refs: 0, units: 0, submitted: 0 });
      const entry = asinMap.get(key);
      entry.refs++;
      entry.units += perAsin;
      if (a.status === "Submitted") entry.submitted++;
    });
  });

  const entries = [...asinMap.entries()].sort((a, b) => b[1].units - a[1].units).slice(0, 15);
  if (!entries.length) {
    el.innerHTML = `<p class="empty-cell" style="padding:16px 0">No ASIN data for current filter.</p>`;
    return;
  }
  const maxUnits = Math.max(...entries.map(([, a]) => a.units), 1);

  el.innerHTML = entries
    .map(([asin, a]) => {
      const pct = Math.round((a.units / maxUnits) * 100);
      const subPct = a.refs ? Math.round((a.submitted / a.refs) * 100) : 0;
      return `
      <div class="analytics-item">
        <div class="analytics-item-header">
          <span class="analytics-item-label" title="${escapeHtml(asin)}">${escapeHtml(asin)}</span>
          <span class="analytics-item-meta">${a.refs} record${a.refs !== 1 ? 's' : ''} · <strong>${subPct}%</strong> submitted</span>
        </div>
        <div class="analytics-bar-track">
          <div class="analytics-bar-fill green" style="width:${pct}%"></div>
        </div>
      </div>`;
    })
    .join("");
}

/* ── Employee × Company Breakdown (Employee Performance) ── */
function renderEmpCompanyBreakdown(sourceRecords = records) {
  const el = $("empCompanyBreakdown");
  if (!el) return;

  const names = [...new Set(sourceRecords.map((r) => r.employee.trim()).filter(Boolean))].sort();
  if (!names.length) {
    el.innerHTML = `<p class="empty-cell" style="padding:16px 0">No employee data for current filter.</p>`;
    return;
  }

  el.innerHTML = names
    .map((name) => {
      const own = sourceRecords.filter((r) => r.employee.trim() === name);
      const coMap = new Map();
      own.forEach((r) => {
        const co = (r.company || "Unknown").trim();
        if (!coMap.has(co)) coMap.set(co, { refs: 0, units: 0 });
        const c = coMap.get(co);
        c.refs++;
        c.units += Number(r.units || 0);
      });
      const coEntries = [...coMap.entries()].sort((a, b) => b[1].units - a[1].units);
      const maxU = Math.max(...coEntries.map(([, c]) => c.units), 1);
      const initial = name.charAt(0).toUpperCase();

      const rows = coEntries
        .map(([co, c]) => {
          const pct = Math.round((c.units / maxU) * 100);
          return `
        <div class="analytics-item">
          <div class="analytics-item-header">
            <span class="analytics-item-label" title="${escapeHtml(co)}">${escapeHtml(co)}</span>
            <span class="analytics-item-meta"><strong>${c.refs}</strong> shipment${c.refs !== 1 ? 's' : ''} · <strong>${c.units.toLocaleString()}</strong> units</span>
          </div>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
        })
        .join("");

      return `
      <div class="emp-breakdown-group">
        <div class="emp-breakdown-header">
          <div class="emp-breakdown-avatar">${escapeHtml(initial)}</div>
          <span>${escapeHtml(name)}</span>
          <span style="margin-left:auto;font-weight:400;color:var(--muted);font-size:12px;">${coEntries.length} compan${coEntries.length !== 1 ? 'ies' : 'y'}</span>
        </div>
        <div class="emp-breakdown-body">${rows}</div>
      </div>`;
    })
    .join("");
}

/* ── Employee × ASIN Breakdown (Employee Performance) ── */
function renderEmpAsinBreakdown(sourceRecords = records) {
  const el = $("empAsinBreakdown");
  if (!el) return;

  const names = [...new Set(sourceRecords.map((r) => r.employee.trim()).filter(Boolean))].sort();
  if (!names.length) {
    el.innerHTML = `<p class="empty-cell" style="padding:16px 0">No employee data for current filter.</p>`;
    return;
  }

  el.innerHTML = names
    .map((name) => {
      const own = sourceRecords.filter((r) => r.employee.trim() === name);
      const asinMap = new Map();
      own.forEach((r) => {
        const units = Number(r.units || 0);
        const asins = r.asins || [];
        const perAsin = asins.length ? Math.round(units / asins.length) : units;
        asins.forEach((a) => {
          const key = (a.asin || "Unknown").trim();
          if (!asinMap.has(key)) asinMap.set(key, { refs: 0, units: 0, submitted: 0 });
          const entry = asinMap.get(key);
          entry.refs++;
          entry.units += perAsin;
          if (a.status === "Submitted") entry.submitted++;
        });
      });

      const asinEntries = [...asinMap.entries()].sort((a, b) => b[1].units - a[1].units).slice(0, 10);
      const initial = name.charAt(0).toUpperCase();

      if (!asinEntries.length) {
        return `
        <div class="emp-breakdown-group">
          <div class="emp-breakdown-header">
            <div class="emp-breakdown-avatar">${escapeHtml(initial)}</div>
            <span>${escapeHtml(name)}</span>
          </div>
          <div class="emp-breakdown-body"><p class="empty-cell" style="padding:10px 0">No ASIN data.</p></div>
        </div>`;
      }

      const maxU = Math.max(...asinEntries.map(([, a]) => a.units), 1);
      const rows = asinEntries
        .map(([asin, a]) => {
          const pct = Math.round((a.units / maxU) * 100);
          const subPct = a.refs ? Math.round((a.submitted / a.refs) * 100) : 0;
          return `
        <div class="analytics-item">
          <div class="analytics-item-header">
            <span class="analytics-item-label" title="${escapeHtml(asin)}">${escapeHtml(asin)}</span>
            <span class="analytics-item-meta">${a.refs} record${a.refs !== 1 ? 's' : ''} · <strong>${subPct}%</strong> submitted</span>
          </div>
          <div class="analytics-bar-track">
            <div class="analytics-bar-fill green" style="width:${pct}%"></div>
          </div>
        </div>`;
        })
        .join("");

      return `
      <div class="emp-breakdown-group">
        <div class="emp-breakdown-header">
          <div class="emp-breakdown-avatar">${escapeHtml(initial)}</div>
          <span>${escapeHtml(name)}</span>
          <span style="margin-left:auto;font-weight:400;color:var(--muted);font-size:12px;">${asinEntries.length} ASIN${asinEntries.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="emp-breakdown-body">${rows}</div>
      </div>`;
    })
    .join("");
}

const FIXED_EMPLOYEES = [
  "Abdul Rehman",
  "Nasir Naveed",
  "Aqeel Qaisar",
  "Raouf Ahmad",
  "Junaid Shah",
  "Mugees ur Rehman",
];

function renderSelects() {
  const previous = $("reportEmployee").value || "all";
  // Merge fixed + any new names added via records
  const recordNames = records.map((r) => r.employee.trim()).filter(Boolean);
  const names = [
    ...new Set([...FIXED_EMPLOYEES, ...recordNames]),
  ].sort();

  $("reportEmployee").innerHTML =
    `<option value="all">Entire Team</option>` +
    names
      .map(
        (name) =>
          `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`,
      )
      .join("");

  if (previous === "all" || names.includes(previous))
    $("reportEmployee").value = previous;

  // Update the datalist in Add Reference modal dynamically (new names not in FIXED_EMPLOYEES)
  const newNames = recordNames.filter((n) => !FIXED_EMPLOYEES.includes(n));
  const existingFixed = $("employeeOptions").querySelectorAll("[data-fixed]").length;
  if (newNames.length) {
    // Remove old dynamic ones
    $("employeeOptions").querySelectorAll("[data-dynamic]").forEach((el) => el.remove());
    newNames.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.dataset.dynamic = "1";
      $("employeeOptions").appendChild(opt);
    });
  }
}

function renderAll() {
  renderDashboard();
  renderReferences();
  renderEmployees();
  renderSelects();
}

/**
 * Page Navigation - Fixed and enhanced to refresh views dynamically
 */
function navigate(page) {
  if (!page) return;

  document.querySelectorAll(".page").forEach((el) => {
    el.classList.remove("active");
  });

  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.remove("active");
  });

  const targetPage = $(`${page}Page`);
  const targetNav = document.querySelector(`[data-page="${page}"]`);

  if (!targetPage) {
    console.error(`Page not found: ${page}`);
    return;
  }

  targetPage.classList.add("active");
  if (targetNav) {
    targetNav.classList.add("active");
  }

  const titles = {
    dashboard: "Dashboard Overview",
    references: "Reference Tracking",
    bulkImport: "Bulk Report Import",
    employees: "Employee Performance",
    reports: "Daily Reports",
  };

  if ($("pageTitle")) {
    $("pageTitle").textContent = titles[page] || "ShipTrack";
  }

  // Refresh page data on navigation so content is never stale
  if (page === "dashboard") renderDashboard();
  if (page === "references") renderReferences();
  if (page === "employees") renderEmployees();
  if (page === "reports") {
    renderSelects();
    generateReport();
  }
}

function openModal(record = null) {
  $("referenceForm").reset();
  $("asinRows").innerHTML = "";
  $("formError").textContent = "";
  $("editId").value = record ? record.id : "";
  $("modalTitle").textContent = record ? "Edit Reference" : "Add New Reference";

  $("refNo").value = record ? record.refNo : "";
  $("refDate").value = record ? normalizeDate(record.date) : localDate();
  $("employeeName").value = record ? record.employee : "";
  $("companyName").value = record ? record.company || "" : "";
  $("units").value = record ? record.units : "";

  if (record && record.asins && record.asins.length) {
    record.asins.forEach((a) => addAsinRow(a.asin, a.status));
  } else {
    addAsinRow();
  }

  $("referenceModal").classList.add("open");
  $("refNo").focus();
}

function closeModal() {
  $("referenceModal").classList.remove("open");
}

function addAsinRow(asin = "", status = "Pending") {
  const row = document.createElement("div");
  row.className = "asin-row";
  row.innerHTML = `
    <input class="asin-value" placeholder="ASIN" value="${escapeHtml(asin)}" required>
    <select class="asin-status">
      <option ${status === "Pending" ? "selected" : ""}>Pending</option>
      <option ${status === "Submitted" ? "selected" : ""}>Submitted</option>
      <option ${status === "Rejected" ? "selected" : ""}>Rejected</option>
    </select>
    <button type="button" class="remove-asin" title="Remove ASIN">×</button>
  `;

  row.querySelector(".remove-asin").addEventListener("click", () => {
    if ($("asinRows").children.length === 1) {
      showToast("At least one ASIN is required.");
      return;
    }
    row.remove();
  });

  $("asinRows").appendChild(row);
}

function getAsinsFromForm() {
  const rows = [...$("asinRows").querySelectorAll(".asin-row")];
  return rows.map((row) => ({
    id: uid(),
    asin: row.querySelector(".asin-value").value.trim().toUpperCase(),
    status: row.querySelector(".asin-status").value,
    updatedAt: new Date().toISOString(),
  }));
}

function saveReference(event) {
  event.preventDefault();
  $("formError").textContent = "";

  const id = $("editId").value;
  const refNo = $("refNo").value.trim();
  const employee = $("employeeName").value.trim();
  const date = normalizeDate($("refDate").value);
  const units = Number($("units").value);
  const company = $("companyName").value.trim();

  if (!refNo || !employee || !date || !Number.isInteger(units) || units < 1) {
    $("formError").textContent =
      "Please enter a reference, employee, date and valid total units.";
    return;
  }

  const duplicate = records.find(
    (r) => r.refNo.toLowerCase() === refNo.toLowerCase() && r.id !== id,
  );
  if (duplicate) {
    $("formError").textContent =
      "This Reference No. already exists. Each reference can belong to only one employee.";
    return;
  }

  const asins = getAsinsFromForm();
  if (!asins.length || asins.some((a) => !a.asin)) {
    $("formError").textContent = "Please add at least one valid ASIN.";
    return;
  }

  const normalized = asins.map((a) => a.asin);
  if (new Set(normalized).size !== normalized.length) {
    $("formError").textContent =
      "Duplicate ASINs found in this reference. Each ASIN must be unique.";
    return;
  }

  const previous = records.find((r) => r.id === id);
  if (previous && previous.asins) {
    asins.forEach((a) => {
      const old = previous.asins.find(
        (oldAsin) => oldAsin.asin.toUpperCase() === a.asin,
      );
      if (old && old.status === a.status) {
        a.id = old.id;
        a.updatedAt = old.updatedAt;
      }
    });
  }

  const record = {
    id: id || uid(),
    refNo,
    employee,
    date,
    units,
    company,
    asins,
  };

  if (previous) {
    records = records.map((r) => (r.id === id ? record : r));
  } else {
    records.unshift(record);
  }

  saveRecords();
  closeModal();
  renderAll();
  showToast(
    previous
      ? "Reference updated successfully."
      : "Reference saved successfully.",
  );
}

function openDetail(id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;
  activeDetailId = id;

  $("detailTitle").textContent = record.refNo;
  $("detailContent").innerHTML = `
    <div class="detail-meta">
      <div><span>Date</span><strong>${escapeHtml(record.date)}</strong></div>
      <div><span>Employee</span><strong>${escapeHtml(record.employee)}</strong></div>
      <div><span>Company</span><strong>${escapeHtml(record.company || "—")}</strong></div>
      <div><span>Total Units (reference total)</span><strong>${Number(record.units).toLocaleString()}</strong></div>
      <div><span>ASIN Count</span><strong>${(record.asins || []).length}</strong></div>
      <div><span>Overall Status</span><strong>${statusBadge(statusOf(record))}</strong></div>
    </div>
    <h3 class="asin-detail-title">ASIN Status Management</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ASIN</th><th>Status</th><th>Last Updated</th><th>Action</th></tr></thead>
        <tbody>
          ${(record.asins || [])
            .map(
              (a) => `
            <tr>
              <td><strong>${escapeHtml(a.asin)}</strong></td>
              <td>${statusBadge(a.status)}</td>
              <td>${a.updatedAt ? escapeHtml(new Date(a.updatedAt).toLocaleString()) : "—"}</td>
              <td>
                <button class="action-btn" data-status="${a.id}" data-next="Submitted">Submit</button>
                <button class="action-btn danger" data-status="${a.id}" data-next="Rejected">Reject</button>
                <button class="action-btn" data-status="${a.id}" data-next="Pending">Pending</button>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  $("detailModal").classList.add("open");
}

function updateAsinStatus(asinId, nextStatus) {
  const record = records.find((r) => r.id === activeDetailId);
  if (!record) return;

  const asin = (record.asins || []).find((a) => a.id === asinId);
  if (!asin) return;

  asin.status = nextStatus;
  asin.updatedAt = new Date().toISOString();

  saveRecords();
  renderAll();
  openDetail(activeDetailId);
  showToast(`ASIN status updated to ${nextStatus}.`);
}

function deleteReference(id) {
  const record = records.find((r) => r.id === id);
  if (!record) return;

  if (!confirm(`Delete reference "${record.refNo}"? This cannot be undone.`))
    return;

  records = records.filter((r) => r.id !== id);
  saveRecords();
  renderAll();
  showToast("Reference deleted.");
}

// --- BULK REPORT IMPORT ENGINE ---

function parseBulkReport(rawText, defaultEmployee) {
  if (!rawText || !rawText.trim()) {
    return { error: "Please paste your report text from Google Sheets." };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) {
    return { error: "No content found in pasted report." };
  }

  const parsedRows = [];
  let headerFound = false;
  let colMap = {
    date: 0,
    ref: 1,
    asin: 2,
    status: 3,
    units: 4,
    time: 5,
    company: 6,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let cols = [];
    if (line.includes("\t")) {
      cols = line.split("\t").map((c) => c.trim());
    } else if (line.includes("|")) {
      cols = line
        .split("|")
        .map((c) => c.trim())
        .filter(
          (c, idx, arr) =>
            !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""),
        );
    } else if (line.includes(",")) {
      cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    } else {
      cols = line.split(/\s{2,}/).map((c) => c.trim());
    }

    if (!cols.length || cols.every((c) => !c || /^[-:]+$/.test(c))) {
      continue;
    }

    const lineLower = line.toLowerCase();
    if (
      !headerFound &&
      (lineLower.includes("date") ||
        lineLower.includes("reference") ||
        lineLower.includes("asin") ||
        lineLower.includes("status"))
    ) {
      headerFound = true;
      cols.forEach((col, idx) => {
        const cLower = col.toLowerCase();
        if (cLower.includes("date")) colMap.date = idx;
        else if (cLower.includes("ref")) colMap.ref = idx;
        else if (cLower.includes("asin")) colMap.asin = idx;
        else if (cLower.includes("status")) colMap.status = idx;
        else if (cLower.includes("unit")) colMap.units = idx;
        else if (cLower.includes("time")) colMap.time = idx;
        else if (cLower.includes("company") || cLower.includes("store"))
          colMap.company = idx;
      });
      continue;
    }

    const rawDate = cols[colMap.date] || "";
    const rawRef = cols[colMap.ref] || "";
    const rawAsin = cols[colMap.asin] || "";
    const rawStatus = cols[colMap.status] || "Pending";
    const rawUnits = cols[colMap.units] || "1";
    const rawCompany = cols[colMap.company] || "";

    if (!rawRef && !rawAsin) continue;

    const date = normalizeDate(rawDate);
    const refNo = String(rawRef).trim().toUpperCase();
    const asin = String(rawAsin).trim().toUpperCase();

    let status = "Pending";
    const sLower = String(rawStatus).toLowerCase();
    if (
      sLower.includes("sub") ||
      sLower.includes("done") ||
      sLower.includes("approved")
    ) {
      status = "Submitted";
    } else if (
      sLower.includes("rej") ||
      sLower.includes("fail") ||
      sLower.includes("error")
    ) {
      status = "Rejected";
    }

    const units = parseInt(String(rawUnits).replace(/[^0-9]/g, ""), 10) || 1;
    const company = rawCompany || "";

    parsedRows.push({
      date,
      refNo,
      asin,
      status,
      units,
      company,
      valid: Boolean(refNo && asin),
    });
  }

  if (!parsedRows.length) {
    return {
      error: "Could not parse any valid rows. Please check the columns layout.",
    };
  }

  // Group by Reference Number
  const refGroups = new Map();
  parsedRows.forEach((row) => {
    if (!row.refNo) return;
    if (!refGroups.has(row.refNo)) {
      refGroups.set(row.refNo, {
        refNo: row.refNo,
        date: row.date,
        employee: defaultEmployee,
        company: row.company,
        units: row.units,
        asins: [],
      });
    }

    const group = refGroups.get(row.refNo);
    if (row.units > group.units) group.units = row.units;
    if (row.company && !group.company) group.company = row.company;

    if (row.asin && !group.asins.some((a) => a.asin === row.asin)) {
      group.asins.push({
        id: uid(),
        asin: row.asin,
        status: row.status,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  return {
    references: Array.from(refGroups.values()),
    totalAsins: parsedRows.filter((r) => r.valid).length,
  };
}

function previewBulkReport() {
  const text = $("bulkReportText").value;
  const employee = $("importEmployee").value.trim() || "Operations Team";
  const result = parseBulkReport(text, employee);

  const summary = $("importSummary");
  const preview = $("importPreview");

  if (result.error) {
    summary.hidden = false;
    summary.className = "import-summary warning";
    summary.innerHTML = `⚠️ <strong>Issue:</strong> ${escapeHtml(result.error)}`;
    preview.innerHTML = "";
    return;
  }

  summary.hidden = false;
  summary.className = "import-summary success";
  summary.innerHTML = `✓ Found <strong>${result.references.length} unique Reference(s)</strong> with <strong>${result.totalAsins} ASIN(s)</strong> for associate <strong>${escapeHtml(employee)}</strong>. Ready to import.`;

  preview.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference No.</th>
            <th>Company</th>
            <th>Units</th>
            <th>ASINs</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${result.references
            .map(
              (r) => `
            <tr>
              <td>${escapeHtml(r.date)}</td>
              <td><strong>${escapeHtml(r.refNo)}</strong></td>
              <td>${escapeHtml(r.company || "—")}</td>
              <td>${r.units}</td>
              <td>${r.asins.map((a) => `${escapeHtml(a.asin)} (${a.status})`).join(", ")}</td>
              <td>${statusBadge(statusOf(r))}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function importBulkReport() {
  const text = $("bulkReportText").value;
  const employee = $("importEmployee").value.trim();

  if (!employee) {
    showToast("Please enter employee name first.");
    $("importEmployee").focus();
    return;
  }

  const result = parseBulkReport(text, employee);
  if (result.error) {
    showToast(result.error);
    return;
  }

  let created = 0;
  let updated = 0;

  result.references.forEach((newRef) => {
    const existing = records.find(
      (r) => r.refNo.toLowerCase() === newRef.refNo.toLowerCase(),
    );
    if (existing) {
      newRef.asins.forEach((newA) => {
        if (
          !existing.asins.some(
            (ea) => ea.asin.toUpperCase() === newA.asin.toUpperCase(),
          )
        ) {
          existing.asins.push(newA);
        }
      });
      if (newRef.units > existing.units) existing.units = newRef.units;
      existing.employee = employee;
      updated++;
    } else {
      records.unshift({
        id: uid(),
        refNo: newRef.refNo,
        date: newRef.date,
        employee: employee,
        company: newRef.company,
        units: newRef.units,
        asins: newRef.asins,
      });
      created++;
    }
  });

  saveRecords();
  renderAll();

  $("bulkReportText").value = "";
  $("importSummary").hidden = true;
  $("importPreview").innerHTML = "";

  showToast(`Bulk report imported: ${created} created, ${updated} updated.`);
  setTimeout(() => navigate("references"), 500);
}

function clearBulkReport() {
  $("bulkReportText").value = "";
  $("importSummary").hidden = true;
  $("importPreview").innerHTML = "";
  showToast("Report cleared.");
}

// --- DAILY REPORT & EXPORTS ---

function formatMarkdownTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    return Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length));
  });

  const pad = (str, len) => String(str ?? "").padEnd(len);

  const headerLine =
    "| " + headers.map((h, i) => pad(h, colWidths[i])).join(" | ") + " |";
  const separatorLine =
    "|-" + colWidths.map((w) => "-".repeat(w)).join("-|-") + "-|";
  const dataLines = rows.map(
    (r) =>
      "| " + r.map((cell, i) => pad(cell, colWidths[i])).join(" | ") + " |",
  );

  return [headerLine, separatorLine, ...dataLines].join("\n");
}

function generateReport() {
  const dateInput = $("reportDate");
  const date = dateInput ? normalizeDate(dateInput.value) : localDate();
  const employee = $("reportEmployee").value || "all";
  const selected = records.filter(
    (r) =>
      normalizeDate(r.date) === date &&
      (employee === "all" || r.employee === employee),
  );
  const asins = selected.flatMap((r) => r.asins || []);
  const title =
    employee === "all"
      ? "TEAM DAILY SHIPMENT REPORT"
      : `DAILY SHIPMENT REPORT — ${employee.toUpperCase()}`;

  const submitted = asins.filter((a) => a.status === "Submitted").length;
  const rejected = asins.filter((a) => a.status === "Rejected").length;
  const units = selected.reduce((sum, r) => sum + Number(r.units || 0), 0);

  if (!selected.length) {
    $("reportOutput").value = [
      `# ${title}`,
      `Date: ${date} | Associate: ${employee === "all" ? "Entire Team" : employee}`,
      "",
      "No shipment references recorded for this date.",
    ].join("\n");
    return;
  }

  const headers = [
    "#",
    "Reference No.",
    "ASINs",
    "Company",
    "Units",
    "Submitted",
    "Rejected",
    "Status",
  ];

  const tableRows = selected
    .sort((a, b) => a.refNo.localeCompare(b.refNo))
    .map((r, index) => {
      const rSub = (r.asins || []).filter((a) => a.status === "Submitted").length;
      const rRej = (r.asins || []).filter((a) => a.status === "Rejected").length;
      const asinsText = (r.asins || []).map((a) => a.asin).join(", ") || "—";
      const status = statusOf(r);

      return [
        String(index + 1),
        r.refNo,
        asinsText,
        r.company || "—",
        Number(r.units || 0).toLocaleString(),
        String(rSub),
        String(rRej),
        status,
      ];
    });

  const tableMarkdown = formatMarkdownTable(headers, tableRows);

  const lines = [
    `# ${title}`,
    `**Date:** ${date}  |  **Associate:** ${employee === "all" ? "Entire Team" : employee}`,
    `**Summary:** ${selected.length} References  |  ${units.toLocaleString()} Total Units  |  ${submitted} Submitted  |  ${rejected} Rejected`,
    "",
    tableMarkdown,
    "",
    `_Generated by ShipTrack Amazon Shipment Portal at ${new Date().toLocaleTimeString()}_`,
  ];

  $("reportOutput").value = lines.join("\n");
}

async function copyToClipboard(text, msg) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast(msg || `Copied: ${text}`);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    showToast(msg || `Copied: ${text}`);
  }
}

async function copyReport() {
  const text = $("reportOutput").value;
  if (!text.trim()) {
    showToast("Generate a report first.");
    return;
  }
  await copyToClipboard(text, "Report copied to clipboard.");
}

function downloadPdfReport() {
  const dateInput = $("reportDate");
  const date = dateInput ? normalizeDate(dateInput.value) : localDate();
  const employee = $("reportEmployee")?.value || "all";
  const selected = records.filter(
    (r) =>
      normalizeDate(r.date) === date &&
      (employee === "all" || r.employee === employee),
  );

  if (!selected.length) {
    showToast("No shipment records available for this date to generate PDF.");
    return;
  }

  const allAsins = selected.flatMap((r) => r.asins || []);
  const title =
    employee === "all"
      ? "TEAM DAILY SHIPMENT REPORT"
      : `DAILY SHIPMENT REPORT — ${employee.toUpperCase()}`;

  const submittedAsins = allAsins.filter((a) => a.status === "Submitted").length;
  const rejectedAsins = allAsins.filter((a) => a.status === "Rejected").length;
  const totalUnitsAll = selected.reduce((sum, r) => sum + Number(r.units || 0), 0);

  // Calculate submitted units & rejected units
  const submittedUnitsAll = selected.reduce((sum, r) => {
    const rSub = (r.asins || []).filter((a) => a.status === "Submitted").length;
    const rTotal = (r.asins || []).length || 1;
    return sum + Math.round(Number(r.units || 0) * (rSub / rTotal));
  }, 0);
  const rejectedUnitsAll = selected.reduce((sum, r) => {
    const rRej = (r.asins || []).filter((a) => a.status === "Rejected").length;
    const rTotal = (r.asins || []).length || 1;
    return sum + Math.round(Number(r.units || 0) * (rRej / rTotal));
  }, 0);

  // Helper: build table rows HTML for a list of records
  function buildTableRows(recs) {
    return [...recs]
      .sort((a, b) => a.refNo.localeCompare(b.refNo))
      .map((r, index) => {
        const rSub = (r.asins || []).filter((a) => a.status === "Submitted").length;
        const rRej = (r.asins || []).filter((a) => a.status === "Rejected").length;
        const rTotal = (r.asins || []).length || 1;
        const rSubUnits = Math.round(Number(r.units || 0) * (rSub / rTotal));
        const rRejUnits = Math.round(Number(r.units || 0) * (rRej / rTotal));
        const asinsList = (r.asins || []).map((a) => a.asin).join(", ") || "—";
        const st = statusOf(r);
        const badgeClass = { Submitted: "badge-sub", Rejected: "badge-rej", Pending: "badge-pen", Mixed: "badge-mix" }[st] || "badge-pen";

        return `
        <tr>
          <td style="text-align:center;color:#64748b;font-weight:600;">${index + 1}</td>
          <td><strong class="ref-code">${escapeHtml(r.refNo)}</strong></td>
          <td><span style="font-family:Consolas,monospace;font-size:9px;color:#0f172a;word-break:break-all;">${escapeHtml(asinsList)}</span></td>
          <td>${escapeHtml(r.company || "—")}</td>
          <td style="font-weight:700;text-align:center;">${Number(r.units || 0).toLocaleString()}</td>
          <td style="color:#128254;font-weight:700;text-align:center;">${rSub}</td>
          <td style="color:#128254;font-weight:700;text-align:center;">${rSubUnits.toLocaleString()}</td>
          <td style="color:#c53b4c;font-weight:700;text-align:center;">${rRej}</td>
          <td style="color:#c53b4c;font-weight:700;text-align:center;">${rRejUnits.toLocaleString()}</td>
          <td><span class="badge ${badgeClass}">${st}</span></td>
        </tr>`;
      })
      .join("");
  }

  // Build table HTML block (header + rows)
  function buildTable(recs) {
    return `
  <table>
    <thead>
      <tr>
        <th style="width:24px;text-align:center;">#</th>
        <th>Reference No.</th>
        <th>ASINs</th>
        <th>Company</th>
        <th style="text-align:center;">Total Units</th>
        <th style="text-align:center;">Sub</th>
        <th style="text-align:center;">Sub Units</th>
        <th style="text-align:center;">Rej</th>
        <th style="text-align:center;">Rej Units</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${buildTableRows(recs)}
    </tbody>
  </table>`;
  }

  // Per-employee cards + tables (only when Entire Team)
  let teamTablesHtml = "";
  if (employee === "all") {
    const empGroups = new Map();
    selected.forEach((r) => {
      if (!empGroups.has(r.employee)) empGroups.set(r.employee, []);
      empGroups.get(r.employee).push(r);
    });

    const sortedEmp = [...empGroups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const maxEmpUnits = Math.max(...sortedEmp.map(([, recs]) => recs.reduce((s, r) => s + Number(r.units || 0), 0)), 1);

    // ── Employee Summary Cards Grid ──
    let cardsHtml = `<div class="emp-cards-grid">`;
    sortedEmp.forEach(([empName, empRecs]) => {
      const empAsins = empRecs.flatMap((r) => r.asins || []);
      const eSub = empAsins.filter((a) => a.status === "Submitted").length;
      const eRej = empAsins.filter((a) => a.status === "Rejected").length;
      const eUnits = empRecs.reduce((s, r) => s + Number(r.units || 0), 0);
      const eSubUnits = empRecs.reduce((s, r) => {
        const rSub = (r.asins || []).filter((a) => a.status === "Submitted").length;
        const rTotal = (r.asins || []).length || 1;
        return s + Math.round(Number(r.units || 0) * (rSub / rTotal));
      }, 0);
      const eRejUnits = empRecs.reduce((s, r) => {
        const rRej = (r.asins || []).filter((a) => a.status === "Rejected").length;
        const rTotal = (r.asins || []).length || 1;
        return s + Math.round(Number(r.units || 0) * (rRej / rTotal));
      }, 0);
      const barW = Math.round((eUnits / maxEmpUnits) * 100);
      const subPct = eUnits ? Math.round((eSubUnits / eUnits) * 100) : 0;
      const rejPct = eUnits ? Math.round((eRejUnits / eUnits) * 100) : 0;

      cardsHtml += `
      <div class="emp-card">
        <div class="emp-card-top">
          <div class="emp-card-avatar">${escapeHtml(empName[0])}</div>
          <div class="emp-card-info">
            <div class="emp-card-name">${escapeHtml(empName)}</div>
            <div class="emp-card-refs">${empRecs.length} refs</div>
          </div>
          <div class="emp-card-units">${eUnits.toLocaleString()}<span>units</span></div>
        </div>
        <div class="emp-card-bar"><div class="emp-card-bar-fill" style="width:${barW}%"></div></div>
        <div class="emp-card-row sub">✓ Submitted &nbsp; ${eSub} ASINs · ${eSubUnits.toLocaleString()} units (${subPct}%)</div>
        <div class="emp-card-row rej">✕ Rejected &nbsp; ${eRej} ASINs · ${eRejUnits.toLocaleString()} units (${rejPct}%)</div>
      </div>`;
    });
    cardsHtml += `</div>`;

    // ── Per-employee Detail Tables ──
    let detailHtml = "";
    sortedEmp.forEach(([empName, empRecs]) => {
      const empAsins = empRecs.flatMap((r) => r.asins || []);
      const eSub = empAsins.filter((a) => a.status === "Submitted").length;
      const eRej = empAsins.filter((a) => a.status === "Rejected").length;
      const eUnits = empRecs.reduce((s, r) => s + Number(r.units || 0), 0);
      const eSubUnits = empRecs.reduce((s, r) => {
        const rSub = (r.asins || []).filter((a) => a.status === "Submitted").length;
        const rTotal = (r.asins || []).length || 1;
        return s + Math.round(Number(r.units || 0) * (rSub / rTotal));
      }, 0);
      const eRejUnits = empRecs.reduce((s, r) => {
        const rRej = (r.asins || []).filter((a) => a.status === "Rejected").length;
        const rTotal = (r.asins || []).length || 1;
        return s + Math.round(Number(r.units || 0) * (rRej / rTotal));
      }, 0);
      detailHtml += `
  <div class="emp-section">
    <div class="emp-section-header">
      <span class="emp-avatar">${escapeHtml(empName[0])}</span>
      <div>
        <div class="emp-name">${escapeHtml(empName)}</div>
        <div class="emp-meta">${empRecs.length} References · ${eUnits.toLocaleString()} Total Units · <span style="color:#128254;">${eSub} Sub (${eSubUnits.toLocaleString()} units)</span> · <span style="color:#c53b4c;">${eRej} Rej (${eRejUnits.toLocaleString()} units)</span></div>
      </div>
    </div>
    ${buildTable(empRecs)}
  </div>`;
    });

    teamTablesHtml = cardsHtml + detailHtml;
  }

  const mainTableHtml = employee === "all" ? "" : buildTable(selected);

  const printableHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ShipTrack_Daily_Report_${date}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #1e293b; margin: 0; padding: 0; font-size: 10px; line-height: 1.4;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .header {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 2px solid #0084ff; padding-bottom: 12px; margin-bottom: 14px;
    }
    .brand-box { display: flex; align-items: center; gap: 10px; }
    .brand-logo-print { max-height: 28px; width: auto; }
    .brand-info h2 { margin: 0; font-size: 18px; font-weight: 800; color: #080e1a; }
    .brand-info p { margin: 2px 0 0; font-size: 8px; font-weight: 700; color: #0084ff; letter-spacing: 1.4px; }
    .meta-box { text-align: right; }
    .meta-title { font-size: 13px; font-weight: 800; color: #0084ff; letter-spacing: 0.5px; }
    .meta-desc { margin: 2px 0 0; font-size: 9px; color: #64748b; }
    .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; }
    .kpi-card p { margin: 0 0 3px; font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-card strong { font-size: 18px; font-weight: 800; color: #0f172a; }
    .kpi-card.green strong { color: #10b981; }
    .kpi-card.red strong { color: #f43f5e; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    thead { background: #080e1a; color: #fff; }
    th { padding: 7px 8px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; text-align: left; }
    td { padding: 7px 8px; border-bottom: 1px solid #edf0f5; font-size: 9px; color: #334155; }
    tr:nth-child(even) td { background: #fcfdfe; }
    .ref-code { font-family: Consolas, monospace; color: #0f172a; font-size: 9px; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 10px; font-size: 8px; font-weight: 700; }
    .badge-sub { background: #ecfdf5; color: #047857; }
    .badge-rej { background: #fff1f2; color: #be123c; }
    .badge-pen { background: #fffbeb; color: #b45309; }
    .badge-mix { background: #f5f3ff; color: #5b21b6; }
    /* Employee cards grid */
    .emp-cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
    .emp-card { background: #f8fafd; border: 1px solid #e2eaf5; border-radius: 10px; padding: 12px; }
    .emp-card-top { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; }
    .emp-card-avatar {
      width: 32px; height: 32px; border-radius: 9px; background: #0084ff; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; flex-shrink: 0;
    }
    .emp-card-info { flex: 1; min-width: 0; }
    .emp-card-name { font-size: 11px; font-weight: 800; color: #080e1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .emp-card-refs { font-size: 8px; color: #64748b; margin-top: 1px; }
    .emp-card-units { text-align: right; font-size: 16px; font-weight: 800; color: #080e1a; line-height: 1.1; }
    .emp-card-units span { display: block; font-size: 7.5px; font-weight: 600; color: #94a3b8; text-transform: uppercase; }
    .emp-card-bar { height: 5px; border-radius: 5px; background: #e8edf5; overflow: hidden; margin-bottom: 9px; }
    .emp-card-bar-fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg, #0084ff, #00c0f9); }
    .emp-card-row { font-size: 8.5px; font-weight: 700; padding: 4px 7px; border-radius: 5px; margin-bottom: 4px; }
    .emp-card-row.sub { background: #ecfdf5; color: #047857; }
    .emp-card-row.rej { background: #fff1f2; color: #be123c; margin-bottom: 0; }
    /* Employee detail sections */
    .emp-section { margin-bottom: 18px; }
    .emp-section-header {
      display: flex; align-items: center; gap: 10px;
      background: #f1f5fd; border: 1px solid #dce6ff;
      border-radius: 8px; padding: 8px 12px; margin-bottom: 6px;
    }
    .emp-avatar {
      width: 30px; height: 30px; border-radius: 8px; background: #0084ff; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; flex-shrink: 0;
    }
    .emp-name { font-size: 12px; font-weight: 800; color: #080e1a; }
    .emp-meta { font-size: 8.5px; color: #526078; margin-top: 1px; }
    .detail-heading { font-size: 10px; font-weight: 800; color: #080e1a; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    .summary-footer {
      border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 12px;
      display: flex; justify-content: space-between; color: #8b98aa; font-size: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand-box">
      <img src="logo.png" alt="TEKXS" class="brand-logo-print" />
      <div class="brand-info">
        <h2>TEKXS</h2>
        <p>TEKXS PRIVATE LIMITED &mdash; LAHORE, PAKISTAN</p>
      </div>
    </div>
    <div class="meta-box">
      <div class="meta-title">${escapeHtml(title)}</div>
      <p class="meta-desc">Date: <strong>${escapeHtml(date)}</strong> | Associate: <strong>${escapeHtml(employee === "all" ? "Entire Team" : employee)}</strong></p>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card">
      <p>Total Shipments</p>
      <strong>${selected.length}</strong>
    </div>
    <div class="kpi-card">
      <p>Total Units</p>
      <strong>${totalUnitsAll.toLocaleString()}</strong>
    </div>
    <div class="kpi-card green">
      <p>Submitted Units</p>
      <strong>${submittedUnitsAll.toLocaleString()}</strong>
    </div>
    <div class="kpi-card ${rejectedUnitsAll > 0 ? "red" : ""}">
      <p>Rejected Units</p>
      <strong>${rejectedUnitsAll.toLocaleString()}</strong>
    </div>
    <div class="kpi-card">
      <p>Submitted / Rejected ASINs</p>
      <strong><span style="color:#128254">${submittedAsins}</span> / <span style="color:#c53b4c">${rejectedAsins}</span></strong>
    </div>
  </div>

  ${employee === "all" ? teamTablesHtml : mainTableHtml}

  <div class="summary-footer">
    <span>TEKXS Amazon Operations Portal &copy; ${new Date().getFullYear()}</span>
    <span>Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</span>
  </div>
</body>
</html>`;

  let printIframe = $("reportPrintIframe");
  if (!printIframe) {
    printIframe = document.createElement("iframe");
    printIframe.id = "reportPrintIframe";
    printIframe.style.position = "fixed";
    printIframe.style.right = "0";
    printIframe.style.bottom = "0";
    printIframe.style.width = "0";
    printIframe.style.height = "0";
    printIframe.style.border = "none";
    document.body.appendChild(printIframe);
  }

  const doc = printIframe.contentWindow.document;
  doc.open();
  doc.write(printableHtml);
  doc.close();

  showToast("Opening PDF Print Dialog...");

  setTimeout(() => {
    printIframe.contentWindow.focus();
    printIframe.contentWindow.print();
  }, 350);
}

function exportCsv() {
  if (!records.length) {
    showToast("No records to export.");
    return;
  }

  const rows = [
    [
      "Date",
      "Reference No",
      "Employee",
      "Company",
      "Total Units",
      "ASIN",
      "Status",
      "Status Updated",
    ],
  ];
  records.forEach((r) => {
    (r.asins || []).forEach((a) =>
      rows.push([
        r.date,
        r.refNo,
        r.employee,
        r.company || "",
        r.units,
        a.asin,
        a.status,
        a.updatedAt || "",
      ]),
    );
  });

  const csv = rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shiptrack-${localDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV export downloaded.");
}

function resetDemoData() {
  if (
    !confirm(
      "This will remove all current browser records and reload demo data. Continue?",
    )
  )
    return;

  localStorage.removeItem(STORAGE_KEY);
  records = loadRecords();
  saveRecords();
  renderAll();
  showToast("Demo data restored.");
}

function init() {
  saveRecords();

  if ($("fromDate")) $("fromDate").value = "";
  if ($("toDate")) $("toDate").value = "";
  if ($("reportDate")) $("reportDate").value = localDate();

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.page));
  });

  document.querySelectorAll("[data-goto]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.goto));
  });

  $("openAddModal")?.addEventListener("click", () => openModal());
  $("closeModal")?.addEventListener("click", closeModal);
  $("cancelModal")?.addEventListener("click", closeModal);
  $("closeDetail")?.addEventListener("click", () =>
    $("detailModal").classList.remove("open"),
  );
  $("addAsin")?.addEventListener("click", () => addAsinRow());
  $("referenceForm")?.addEventListener("submit", saveReference);

  // ── Dashboard Filter Listeners ──
  document.querySelectorAll("[data-dash-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-dash-preset]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyDatePreset(btn.dataset.dashPreset, "fromDate", "toDate", renderDashboard);
    });
  });

  $("fromDate")?.addEventListener("change", () => {
    document.querySelectorAll("[data-dash-preset]").forEach((b) => b.classList.remove("active"));
    renderDashboard();
  });
  $("toDate")?.addEventListener("change", () => {
    document.querySelectorAll("[data-dash-preset]").forEach((b) => b.classList.remove("active"));
    renderDashboard();
  });
  $("resetDates")?.addEventListener("click", () => {
    $("fromDate").value = "";
    $("toDate").value = "";
    document.querySelectorAll("[data-dash-preset]").forEach((b) => b.classList.remove("active"));
    document.querySelector("[data-dash-preset='all']")?.classList.add("active");
    renderDashboard();
  });

  // ── Reference Tracking Filter Listeners ──
  document.querySelectorAll("[data-ref-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-ref-preset]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyDatePreset(btn.dataset.refPreset, "refFilterFrom", "refFilterTo", renderReferences);
    });
  });

  $("refFilterFrom")?.addEventListener("change", () => {
    document.querySelectorAll("[data-ref-preset]").forEach((b) => b.classList.remove("active"));
    renderReferences();
  });
  $("refFilterTo")?.addEventListener("change", () => {
    document.querySelectorAll("[data-ref-preset]").forEach((b) => b.classList.remove("active"));
    renderReferences();
  });
  $("refFilterEmployee")?.addEventListener("change", renderReferences);
  $("refFilterCompany")?.addEventListener("change", renderReferences);
  $("refFilterStatus")?.addEventListener("change", renderReferences);
  $("refFilterSort")?.addEventListener("change", renderReferences);
  $("referenceSearch")?.addEventListener("input", renderReferences);

  $("refClearFilters")?.addEventListener("click", () => {
    if ($("refFilterFrom")) $("refFilterFrom").value = "";
    if ($("refFilterTo")) $("refFilterTo").value = "";
    if ($("refFilterEmployee")) $("refFilterEmployee").value = "";
    if ($("refFilterCompany")) $("refFilterCompany").value = "";
    if ($("refFilterStatus")) $("refFilterStatus").value = "";
    if ($("refFilterSort")) $("refFilterSort").value = "date_desc";
    if ($("referenceSearch")) $("referenceSearch").value = "";
    document.querySelectorAll("[data-ref-preset]").forEach((b) => b.classList.remove("active"));
    document.querySelector("[data-ref-preset='all']")?.classList.add("active");
    renderReferences();
    showToast("Reference filters reset.");
  });

  // ── Employee Performance Filter Listeners ──
  document.querySelectorAll("[data-emp-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-emp-preset]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyDatePreset(btn.dataset.empPreset, "empFilterFrom", "empFilterTo", renderEmployees);
    });
  });

  $("empFilterFrom")?.addEventListener("change", () => {
    document.querySelectorAll("[data-emp-preset]").forEach((b) => b.classList.remove("active"));
    renderEmployees();
  });
  $("empFilterTo")?.addEventListener("change", () => {
    document.querySelectorAll("[data-emp-preset]").forEach((b) => b.classList.remove("active"));
    renderEmployees();
  });
  $("empFilterCompany")?.addEventListener("change", renderEmployees);
  $("empFilterSort")?.addEventListener("change", renderEmployees);
  $("empSearchInput")?.addEventListener("input", renderEmployees);

  $("empClearFilters")?.addEventListener("click", () => {
    if ($("empFilterFrom")) $("empFilterFrom").value = "";
    if ($("empFilterTo")) $("empFilterTo").value = "";
    if ($("empFilterCompany")) $("empFilterCompany").value = "";
    if ($("empFilterSort")) $("empFilterSort").value = "units_desc";
    if ($("empSearchInput")) $("empSearchInput").value = "";
    document.querySelectorAll("[data-emp-preset]").forEach((b) => b.classList.remove("active"));
    document.querySelector("[data-emp-preset='all']")?.classList.add("active");
    renderEmployees();
    showToast("Employee filters reset.");
  });

  // Bulk Import Listeners
  $("previewBulkReport")?.addEventListener("click", previewBulkReport);
  $("importBulkReport")?.addEventListener("click", importBulkReport);
  $("clearBulkReport")?.addEventListener("click", clearBulkReport);

  // Report & Export Listeners
  $("generateReport")?.addEventListener("click", generateReport);
  $("reportDate")?.addEventListener("change", generateReport);
  $("reportEmployee")?.addEventListener("change", generateReport);
  $("copyReport")?.addEventListener("click", copyReport);
  $("downloadPdf")?.addEventListener("click", downloadPdfReport);
  $("exportCsv")?.addEventListener("click", exportCsv);
  $("clearDemo")?.addEventListener("click", resetDemoData);

  // Global Copy Button Handler (Reference No & ASIN copy buttons)
  document.addEventListener("click", (event) => {
    const copyBtn = event.target.closest("[data-copy]");
    if (copyBtn) {
      event.preventDefault();
      event.stopPropagation();
      const val = copyBtn.dataset.copy;
      copyToClipboard(val, `Copied: ${val}`);
      copyBtn.classList.add("copied");
      setTimeout(() => copyBtn.classList.remove("copied"), 1200);
    }
  });

  $("referencesTable")?.addEventListener("click", (event) => {
    const detail = event.target.closest("[data-detail]");
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");

    if (detail && !detail.disabled) openDetail(detail.dataset.detail);
    if (edit && !edit.disabled) {
      const record = records.find((r) => r.id === edit.dataset.edit);
      if (record) openModal(record);
    }
    if (del && !del.disabled) deleteReference(del.dataset.delete);
  });

  $("detailContent")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");
    if (button) updateAsinStatus(button.dataset.status, button.dataset.next);
  });

  $("referenceModal")?.addEventListener("click", (event) => {
    if (event.target === $("referenceModal")) closeModal();
  });

  $("detailModal")?.addEventListener("click", (event) => {
    if (event.target === $("detailModal"))
      $("detailModal").classList.remove("open");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      $("detailModal")?.classList.remove("open");
    }
  });

  renderAll();
  generateReport();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
