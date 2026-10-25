const STORAGE_KEY = "shiptrack_amazon_portal_v1";
const TARGETS_KEY = "shiptrack_employee_targets_v1";

let records = loadRecords();
let targets = loadTargets();
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

  return [];
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/* ── Targets: Load / Save ── */
function loadTargets() {
  try {
    const saved = localStorage.getItem(TARGETS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return {
    "Abdul Rehman": 500,
    "Nasir Naveed": 450,
    "Aqeel Qaisar": 400,
    "Raouf Ahmad": 350,
    "Junaid Shah": 300,
  };
}

function saveTargets() {
  localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
}

/* ── JSON Backup & Restore ── */
function downloadJsonBackup() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    records,
    targets,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = localDate().replace(/-/g, "");
  link.href = url;
  link.download = `shipment_portal_backup_${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("✓ JSON backup downloaded successfully.");
}

function handleRestoreJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // Support both plain array and versioned backup
      let imported = [];
      let importedTargets = {};
      if (Array.isArray(data)) {
        imported = data;
      } else if (data.records && Array.isArray(data.records)) {
        imported = data.records;
        importedTargets = data.targets || {};
      } else {
        showToast("⚠ Invalid backup file format.");
        return;
      }

      if (
        !confirm(
          `This will REPLACE all current data with ${imported.length} records from the backup.\n\nAre you sure?`,
        )
      )
        return;

      imported.forEach((r) => {
        r.date = normalizeDate(r.date);
      });
      records = imported;
      targets = importedTargets;
      saveRecords();
      saveTargets();
      renderAll();
      renderLeaderboard();
      renderEmpTargetsGrid();
      showToast(`✓ Restored ${records.length} records from backup.`);

      // Reset file input display
      if ($("restoreFileName"))
        $("restoreFileName").textContent = "No file chosen";
      if ($("restoreJsonFile")) $("restoreJsonFile").value = "";
    } catch (err) {
      showToast(
        "⚠ Could not read backup file. Make sure it is a valid JSON backup.",
      );
    }
  };
  reader.readAsText(file);
}

/* ── Employee Targets Grid Renderer ── */
function renderEmpTargetsGrid() {
  const el = $("empTargetsGrid");
  if (!el) return;

  const allNames = [
    ...new Set(records.map((r) => r.employee.trim()).filter(Boolean)),
  ].sort();

  if (!allNames.length) {
    el.innerHTML = `<p class="empty-cell" style="padding:16px;">No employees found. Import or add references first.</p>`;
    return;
  }

  el.innerHTML = allNames
    .map((name) => {
      const initial = name.charAt(0).toUpperCase();
      const currentTarget = targets[name] || 0;
      return `
    <div class="emp-target-row">
      <div class="emp-target-avatar">${escapeHtml(initial)}</div>
      <span class="emp-target-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      <input
        type="number"
        class="emp-target-input"
        data-emp-name="${escapeHtml(name)}"
        value="${currentTarget}"
        min="0"
        step="50"
        placeholder="0"
        title="Daily unit target for ${escapeHtml(name)}"
      />
    </div>`;
    })
    .join("");
}

function saveTargetsFromGrid() {
  const inputs = document.querySelectorAll(".emp-target-input[data-emp-name]");
  inputs.forEach((input) => {
    const name = input.dataset.empName;
    const val = Number(input.value) || 0;
    targets[name] = val;
  });
  saveTargets();

  const msg = $("targetsSavedMsg");
  if (msg) {
    msg.style.opacity = "1";
    setTimeout(() => {
      msg.style.opacity = "0";
    }, 2000);
  }
  renderLeaderboard();
  renderEmployees();
  showToast("✓ Targets saved.");
}

/* ── Leaderboard ── */
function renderLeaderboard() {
  const el = $("leaderboardGrid");
  if (!el) return;

  if (!records.length) {
    el.innerHTML = `<p class="empty-cell" style="padding:16px 0;">No data yet. Import or add references to see leaderboard.</p>`;
    return;
  }

  const today = localDate();
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    return localDate(d);
  })();

  // Build stats per employee for today, this week, all time
  const periods = [
    {
      key: "today",
      label: "Today",
      filter: (r) => normalizeDate(r.date) === today,
    },
    {
      key: "week",
      label: "This Week",
      filter: (r) => normalizeDate(r.date) >= weekStart,
    },
    { key: "allTime", label: "All Time", filter: () => true },
  ];

  const allNames = [
    ...new Set(records.map((r) => r.employee.trim()).filter(Boolean)),
  ];

  const periodBlocks = periods.map(({ key, label, filter }) => {
    const filtered = records.filter(filter);
    const stats = allNames
      .map((name) => {
        const own = filtered.filter((r) => r.employee.trim() === name);
        const units = own.reduce((s, r) => s + Number(r.units || 0), 0);
        return { name, units, refs: own.length };
      })
      .filter((e) => e.units > 0)
      .sort((a, b) => b.units - a.units)
      .slice(0, 3);

    if (!stats.length)
      return `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <p class="leaderboard-label">${escapeHtml(label)}</p>
        <p class="empty-cell" style="padding:8px 0; font-size:12px;">No data</p>
      </div>`;

    const rankEmojis = ["🥇", "🥈", "🥉"];

    return `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <p class="leaderboard-label">${escapeHtml(label)}</p>
      ${stats
        .map((e, i) => {
          const target = targets[e.name] || 0;
          const pct =
            target > 0
              ? Math.min(Math.round((e.units / target) * 100), 100)
              : 0;
          const isOver = target > 0 && e.units >= target;
          const targetText =
            target > 0
              ? `<span class="leaderboard-target-pct${isOver ? " hit" : ""}">${e.units.toLocaleString()} / ${target.toLocaleString()} units ${isOver ? "✓" : `(${pct}%)`}</span>`
              : `<span class="leaderboard-target-pct">${e.units.toLocaleString()} units · ${e.refs} ref${e.refs !== 1 ? "s" : ""}</span>`;

          return `
        <div class="leaderboard-card rank-${i + 1}">
          <span class="leaderboard-rank">${rankEmojis[i]}</span>
          <span class="leaderboard-name" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</span>
          <span class="leaderboard-units">${e.units.toLocaleString()}<span> units</span></span>
          ${
            target > 0
              ? `
          <div class="leaderboard-target-bar">
            <div class="leaderboard-target-fill${isOver ? " over-target" : ""}" style="width:${pct}%"></div>
          </div>`
              : ""
          }
          ${targetText}
        </div>`;
        })
        .join("")}
    </div>`;
  });

  el.innerHTML = `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:24px; width:100%;">${periodBlocks.join("")}</div>`;
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
      empMap.set(name, {
        refs: 0,
        units: 0,
        subAsins: 0,
        rejAsins: 0,
        subUnits: 0,
        rejUnits: 0,
      });
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

  const empEntries = [...empMap.entries()].sort(
    (a, b) => b[1].units - a[1].units,
  );

  if (!empEntries.length) {
    empSummaryEl.innerHTML = `<p class="empty-cell" style="padding:20px 0;">No employee data for the selected range.</p>`;
    return;
  }

  const maxUnits = Math.max(...empEntries.map(([, e]) => e.units), 1);

  empSummaryEl.innerHTML = empEntries
    .map(([name, e]) => {
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
    })
    .join("");
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
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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
    const emps = [
      ...new Set(records.map((r) => r.employee.trim()).filter(Boolean)),
    ].sort();
    empSelect.innerHTML =
      `<option value="">All Employees (${emps.length})</option>` +
      emps
        .map(
          (e) =>
            `<option value="${escapeHtml(e)}" ${e === curEmp ? "selected" : ""}>${escapeHtml(e)}</option>`,
        )
        .join("");
  }

  if (compSelect) {
    const curComp = compSelect.value;
    const comps = [
      ...new Set(records.map((r) => (r.company || "").trim()).filter(Boolean)),
    ].sort();
    compSelect.innerHTML =
      `<option value="">All Companies (${comps.length})</option>` +
      comps
        .map(
          (c) =>
            `<option value="${escapeHtml(c)}" ${c === curComp ? "selected" : ""}>${escapeHtml(c)}</option>`,
        )
        .join("");
  }
}

function renderRefFilterTags(active) {
  const container = $("refFilterTags");
  if (!container) return;
  const tags = [];
  if (active.from || active.to) {
    tags.push({
      label: `📅 ${active.from || "..."} → ${active.to || "..."}`,
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
  const from = $("refFilterFrom")?.value
    ? normalizeDate($("refFilterFrom").value)
    : "";
  const to = $("refFilterTo")?.value
    ? normalizeDate($("refFilterTo").value)
    : "";
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
        String(v || "")
          .toLowerCase()
          .includes(query),
      );
      const matchAsin = (r.asins || []).some((a) =>
        String(a.asin || "")
          .toLowerCase()
          .includes(query),
      );
      if (!matchHeader && !matchAsin) return false;
    }
    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === "date_desc")
      return normalizeDate(b.date).localeCompare(normalizeDate(a.date));
    if (sortBy === "date_asc")
      return normalizeDate(a.date).localeCompare(normalizeDate(b.date));
    if (sortBy === "units_desc")
      return Number(b.units || 0) - Number(a.units || 0);
    if (sortBy === "units_asc")
      return Number(a.units || 0) - Number(b.units || 0);
    if (sortBy === "ref_asc")
      return String(a.refNo || "").localeCompare(String(b.refNo || ""));
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
    $("refResultCount").innerHTML =
      `Showing <strong>${filtered.length}</strong> of <strong>${records.length}</strong> shipments (${totalUnits.toLocaleString()} units)`;
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
    const comps = [
      ...new Set(records.map((r) => (r.company || "").trim()).filter(Boolean)),
    ].sort();
    compSelect.innerHTML =
      `<option value="">All Companies (${comps.length})</option>` +
      comps
        .map(
          (c) =>
            `<option value="${escapeHtml(c)}" ${c === curComp ? "selected" : ""}>${escapeHtml(c)}</option>`,
        )
        .join("");
  }
}

function getEmployeeStats(
  filteredRecs = records,
  query = "",
  sortBy = "units_desc",
) {
  const allNames = [
    ...new Set(records.map((r) => r.employee.trim()).filter(Boolean)),
  ];
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
      const subRate = asins.length
        ? Math.round((submitted / asins.length) * 100)
        : 0;
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

  const from = $("empFilterFrom")?.value
    ? normalizeDate($("empFilterFrom").value)
    : "";
  const to = $("empFilterTo")?.value
    ? normalizeDate($("empFilterTo").value)
    : "";
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
    $("empResultCount").innerHTML =
      `Showing <strong>${stats.length}</strong> associate${stats.length !== 1 ? "s" : ""}`;
  }

  // Active filter tags for employees
  const tagContainer = $("empFilterTags");
  if (tagContainer) {
    const tags = [];
    if (from || to) tags.push(`📅 ${from || "..."} → ${to || "..."}`);
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
        .map((e) => {
          const dailyTarget = targets[e.name] || 0;
          let targetCell = `<td><span style="color:var(--muted);font-size:11px;">—</span></td>`;
          if (dailyTarget > 0) {
            const todayRecs = records.filter(
              (r) =>
                normalizeDate(r.date) === localDate() &&
                r.employee.trim() === e.name,
            );
            const todayUnits = todayRecs.reduce(
              (s, r) => s + Number(r.units || 0),
              0,
            );
            const pct = Math.min(
              Math.round((todayUnits / dailyTarget) * 100),
              100,
            );
            const isOver = todayUnits >= dailyTarget;
            targetCell = `<td><div class="target-progress-cell"><div class="target-mini-bar"><div class="target-mini-fill${isOver ? " over" : ""}" style="width:${pct}%"></div></div><span class="target-mini-text${isOver ? " hit" : ""}">${todayUnits.toLocaleString()} / ${dailyTarget.toLocaleString()} (${pct}%)${isOver ? " ✓" : ""}</span></div></td>`;
          }
          return `<tr><td><strong>${escapeHtml(e.name)}</strong></td><td>${e.refs}</td><td><strong>${e.units.toLocaleString()}</strong></td><td><span style="color:#16875c;font-weight:600;">${e.submitted}</span></td><td><span style="color:#d84a57;font-weight:600;">${e.rejected}</span></td>${targetCell}</tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty-cell">No data available.</td></tr>`;

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

  const entries = [...compMap.entries()].sort(
    (a, b) => b[1].units - a[1].units,
  );
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
          <span class="analytics-item-meta"><strong>${c.refs}</strong> shipment${c.refs !== 1 ? "s" : ""} · <strong>${c.units.toLocaleString()}</strong> units</span>
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
      if (!asinMap.has(key))
        asinMap.set(key, { refs: 0, units: 0, submitted: 0 });
      const entry = asinMap.get(key);
      entry.refs++;
      entry.units += perAsin;
      if (a.status === "Submitted") entry.submitted++;
    });
  });

  const entries = [...asinMap.entries()]
    .sort((a, b) => b[1].units - a[1].units)
    .slice(0, 15);
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
          <span class="analytics-item-meta">${a.refs} record${a.refs !== 1 ? "s" : ""} · <strong>${subPct}%</strong> submitted</span>
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

  const names = [
    ...new Set(sourceRecords.map((r) => r.employee.trim()).filter(Boolean)),
  ].sort();
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
      const coEntries = [...coMap.entries()].sort(
        (a, b) => b[1].units - a[1].units,
      );
      const maxU = Math.max(...coEntries.map(([, c]) => c.units), 1);
      const initial = name.charAt(0).toUpperCase();

      const rows = coEntries
        .map(([co, c]) => {
          const pct = Math.round((c.units / maxU) * 100);
          return `
        <div class="analytics-item">
          <div class="analytics-item-header">
            <span class="analytics-item-label" title="${escapeHtml(co)}">${escapeHtml(co)}</span>
            <span class="analytics-item-meta"><strong>${c.refs}</strong> shipment${c.refs !== 1 ? "s" : ""} · <strong>${c.units.toLocaleString()}</strong> units</span>
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
          <span style="margin-left:auto;font-weight:400;color:var(--muted);font-size:12px;">${coEntries.length} compan${coEntries.length !== 1 ? "ies" : "y"}</span>
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

  const names = [
    ...new Set(sourceRecords.map((r) => r.employee.trim()).filter(Boolean)),
  ].sort();
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
          if (!asinMap.has(key))
            asinMap.set(key, { refs: 0, units: 0, submitted: 0 });
          const entry = asinMap.get(key);
          entry.refs++;
          entry.units += perAsin;
          if (a.status === "Submitted") entry.submitted++;
        });
      });

      const asinEntries = [...asinMap.entries()]
        .sort((a, b) => b[1].units - a[1].units)
        .slice(0, 10);
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
            <span class="analytics-item-meta">${a.refs} record${a.refs !== 1 ? "s" : ""} · <strong>${subPct}%</strong> submitted</span>
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
          <span style="margin-left:auto;font-weight:400;color:var(--muted);font-size:12px;">${asinEntries.length} ASIN${asinEntries.length !== 1 ? "s" : ""}</span>
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
  const names = [...new Set([...FIXED_EMPLOYEES, ...recordNames])].sort();

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
  const existingFixed =
    $("employeeOptions").querySelectorAll("[data-fixed]").length;
  if (newNames.length) {
    // Remove old dynamic ones
    $("employeeOptions")
      .querySelectorAll("[data-dynamic]")
      .forEach((el) => el.remove());
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
  renderLeaderboard();
  renderEmpTargetsGrid();
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
    feedback: "Feedback Management",
  };

  if ($("pageTitle")) {
    $("pageTitle").textContent = titles[page] || "TEKXS Shipments";
  }

  // Refresh page data on navigation so content is never stale
  if (page === "dashboard") renderDashboard();
  if (page === "references") renderReferences();
  if (page === "employees") renderEmployees();
  if (page === "reports") {
    renderSelects();
    generateReport();
  }
  if (page === "feedback") renderFeedback();
}

function openModal(record = null) {
  $("referenceForm").reset();
  $("asinRows").innerHTML = "";
  $("formError").textContent = "";
  $("editId").value = record ? record.id : "";
  $("modalTitle").textContent = record ? "Edit Reference" : "Add New Reference";

  const dupWarn = $("refNoDuplicateWarning");
  if (dupWarn) dupWarn.style.display = "none";
  if ($("refNo")) $("refNo").classList.remove("input-error");

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

function checkDuplicateRefNo() {
  const refNoInput = $("refNo");
  if (!refNoInput) return;
  const refNoVal = refNoInput.value.trim().toLowerCase();
  const currentId = $("editId") ? $("editId").value : "";
  const dupWarn = $("refNoDuplicateWarning");

  if (!refNoVal) {
    if (dupWarn) dupWarn.style.display = "none";
    refNoInput.classList.remove("input-error");
    return;
  }

  const isDuplicate = records.some(
    (r) =>
      r.refNo &&
      r.refNo.trim().toLowerCase() === refNoVal &&
      r.id !== currentId,
  );

  if (dupWarn) {
    dupWarn.style.display = isDuplicate ? "block" : "none";
  }
  if (isDuplicate) {
    refNoInput.classList.add("input-error");
  } else {
    refNoInput.classList.remove("input-error");
  }
}

function closeModal() {
  $("referenceModal").classList.remove("open");
}

function addAsinRow(asin = "", status = "Pending") {
  const row = document.createElement("div");
  row.className = "asin-row";
  row.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:2px;flex:1;">
      <input class="asin-value" placeholder="ASIN (e.g. B0B8TGMSQX)" value="${escapeHtml(asin)}" required>
      <span class="asin-valid-hint"></span>
    </div>
    <select class="asin-status">
      <option ${status === "Pending" ? "selected" : ""}>Pending</option>
      <option ${status === "Submitted" ? "selected" : ""}>Submitted</option>
      <option ${status === "Rejected" ? "selected" : ""}>Rejected</option>
    </select>
    <button type="button" class="remove-asin" title="Remove ASIN">&times;</button>
  `;

  const asinInput = row.querySelector(".asin-value");
  const asinHint = row.querySelector(".asin-valid-hint");

  function validateAsinInput() {
    const val = asinInput.value.trim().toUpperCase();
    asinInput.value = val;
    if (!val) {
      asinInput.classList.remove("asin-ok", "asin-error");
      asinHint.className = "asin-valid-hint";
      asinHint.textContent = "";
      return;
    }
    const ok = /^[A-Z0-9]{10}$/.test(val);
    if (ok) {
      asinInput.classList.add("asin-ok");
      asinInput.classList.remove("asin-error");
      asinHint.className = "asin-valid-hint valid";
      asinHint.textContent = "\u2713 Valid ASIN";
    } else {
      asinInput.classList.add("asin-error");
      asinInput.classList.remove("asin-ok");
      asinHint.className = "asin-valid-hint invalid";
      asinHint.textContent = `\u26a0 Must be 10 alphanumeric chars (${val.length}/10)`;
    }
  }

  asinInput.addEventListener("input", validateAsinInput);
  if (asin) validateAsinInput();

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
      `Duplicate Error: Reference "${refNo}" already exists (assigned to ${duplicate.employee}). Each reference must be unique.`;
    const dupWarn = $("refNoDuplicateWarning");
    if (dupWarn) dupWarn.style.display = "block";
    $("refNo").classList.add("input-error");
    $("refNo").focus();
    return;
  }

  const asins = getAsinsFromForm();
  if (!asins.length || asins.some((a) => !a.asin)) {
    $("formError").textContent = "Please add at least one valid ASIN.";
    return;
  }

  const invalidAsins = asins.filter((a) => !/^[A-Z0-9]{10}$/.test(a.asin));
  if (invalidAsins.length) {
    const invalidList = invalidAsins.map((a) => `"${a.asin}"`).join(", ");
    if (
      !confirm(
        `Warning: The following ASIN(s) do not match Amazon's 10-character alphanumeric standard:\n\n${invalidList}\n\nDo you want to save anyway?`,
      )
    ) {
      $("formError").textContent =
        `Invalid ASIN format: ${invalidList}. Amazon ASINs must be exactly 10 alphanumeric characters.`;
      return;
    }
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

// --- BULK REPORT IMPORT ENGINE ---

function parseBulkReport(rawText, defaultEmployee) {
  if (!rawText || !rawText.trim()) {
    return { error: "Please paste your report text from Google Sheets." };
  }

  const lines = rawText.split(/\r?\n/);
  if (!lines.length) {
    return { error: "No content found in pasted report." };
  }

  const parsedRows = [];
  let headerFound = false;
  let lastSeenDate = "";
  let ignoredCount = 0;
  let noCompanyCount = 0;

  // Default column mapping according to standard sheet:
  // Date | Reference No. | ASIN | Status | Units | Time | Company
  let colMap = {
    date: 0,
    ref: 1,
    asin: 2,
    status: 3,
    units: 4,
    time: 5,
    company: 6,
  };

  const isLikelyDate = (str) => {
    if (!str || typeof str !== "string") return false;
    const s = str.trim();
    if (!s) return false;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return true;
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(s)) return true;
    if (/^\d{1,2}[-.]\d{1,2}[-.]\d{2,4}$/.test(s)) return true;
    return false;
  };

  const isHeaderLine = (lineLower) => {
    let kwCount = 0;
    if (lineLower.includes("date")) kwCount++;
    if (lineLower.includes("ref")) kwCount++;
    if (lineLower.includes("asin")) kwCount++;
    if (lineLower.includes("status")) kwCount++;
    if (lineLower.includes("unit")) kwCount++;
    if (lineLower.includes("company") || lineLower.includes("store")) kwCount++;
    if (lineLower.includes("time")) kwCount++;
    return kwCount >= 2;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Skip completely blank lines
    if (!line) {
      continue;
    }

    // 2. Parse columns depending on delimiter
    let cols = [];
    if (rawLine.includes("\t")) {
      cols = rawLine.split("\t").map((c) => c.trim());
    } else if (rawLine.includes("|")) {
      cols = rawLine
        .split("|")
        .map((c) => c.trim())
        .filter(
          (c, idx, arr) =>
            !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""),
        );
    } else if (rawLine.includes(",")) {
      cols = rawLine
        .split(",")
        .map((c) => c.trim().replace(/^["']|["']$/g, ""));
    } else {
      cols = rawLine.split(/\s{2,}/).map((c) => c.trim());
    }

    // Skip markdown separator lines e.g. |---|---|
    if (!cols.length || cols.every((c) => !c || /^[-:|+=_]+$/.test(c))) {
      ignoredCount++;
      continue;
    }

    const nonEmptyCols = cols.filter(Boolean);
    if (!nonEmptyCols.length) {
      ignoredCount++;
      continue;
    }

    // 3. Header Detection (could appear at top or repeated between dates)
    const lineLower = line.toLowerCase();
    if (isHeaderLine(lineLower)) {
      headerFound = true;
      cols.forEach((col, idx) => {
        const cLower = col.toLowerCase().trim();
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

    // 4. Date-Only Divider row detection (e.g. "10/12/26", "10/16/26" across the row)
    if (nonEmptyCols.length === 1 && isLikelyDate(nonEmptyCols[0])) {
      lastSeenDate = normalizeDate(nonEmptyCols[0]);
      ignoredCount++;
      continue;
    }
    if (isLikelyDate(cols[0]) && nonEmptyCols.length === 1) {
      lastSeenDate = normalizeDate(cols[0]);
      ignoredCount++;
      continue;
    }

    // 5. Extract fields based on colMap
    let rawDate = (
      cols[colMap.date] !== undefined ? cols[colMap.date] : ""
    ).trim();
    let rawRef = (
      cols[colMap.ref] !== undefined ? cols[colMap.ref] : ""
    ).trim();
    let rawAsin = (
      cols[colMap.asin] !== undefined ? cols[colMap.asin] : ""
    ).trim();
    let rawStatus = (
      cols[colMap.status] !== undefined ? cols[colMap.status] : ""
    ).trim();
    let rawUnits = (
      cols[colMap.units] !== undefined ? cols[colMap.units] : ""
    ).trim();
    let rawTime = (
      colMap.time !== undefined && cols[colMap.time] !== undefined
        ? cols[colMap.time]
        : ""
    ).trim();
    let rawCompany = (
      colMap.company !== undefined && cols[colMap.company] !== undefined
        ? cols[colMap.company]
        : ""
    ).trim();

    // Smart adjustment if sheet has 6 columns (no Time column: Date, Ref, ASIN, Status, Units, Company)
    if ((!rawCompany || colMap.company >= cols.length) && rawTime) {
      const isTimeFmt = /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(rawTime);
      if (!isTimeFmt) {
        rawCompany = rawTime;
        rawTime = "";
      }
    }

    // 6. VALIDATION CHECKS (Valid row MUST have date, ref no, asin, status, units; company is optional)

    // Check Reference Number:
    if (!rawRef) {
      ignoredCount++;
      continue;
    }
    if (
      isLikelyDate(rawRef) ||
      /^(submitted|rejected|pending|date|asin|status|units|company)$/i.test(
        rawRef,
      )
    ) {
      ignoredCount++;
      continue;
    }

    // Check ASIN:
    if (!rawAsin) {
      ignoredCount++;
      continue;
    }
    if (
      isLikelyDate(rawAsin) ||
      /^(submitted|rejected|pending|date|reference|ref|status|units|company)$/i.test(
        rawAsin,
      )
    ) {
      ignoredCount++;
      continue;
    }
    if (!/^[A-Z0-9\-_]{5,15}$/i.test(rawAsin)) {
      ignoredCount++;
      continue;
    }

    // Check Date:
    let date = "";
    if (isLikelyDate(rawDate)) {
      date = normalizeDate(rawDate);
      lastSeenDate = date;
    } else if (lastSeenDate) {
      date = lastSeenDate;
    } else {
      ignoredCount++;
      continue;
    }

    // Check Status:
    if (!rawStatus) {
      ignoredCount++;
      continue;
    }
    let status = "";
    const sLower = rawStatus.toLowerCase();
    if (
      sLower.includes("sub") ||
      sLower.includes("done") ||
      sLower.includes("appr")
    ) {
      status = "Submitted";
    } else if (
      sLower.includes("rej") ||
      sLower.includes("fail") ||
      sLower.includes("error") ||
      sLower.includes("cancel")
    ) {
      status = "Rejected";
    } else if (sLower.includes("pend")) {
      status = "Pending";
    } else {
      ignoredCount++;
      continue;
    }

    // Check Units:
    let units = 0;
    if (rawUnits) {
      const parsedNum = parseInt(rawUnits.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsedNum)) {
        units = parsedNum;
      } else if (status === "Rejected") {
        units = 0;
      } else {
        ignoredCount++;
        continue;
      }
    } else {
      if (status === "Rejected") {
        units = 0;
      } else {
        ignoredCount++;
        continue;
      }
    }

    // Company:
    // User rule: Company can be blank/empty, especially for Rejected / Gated ASINs
    const company =
      rawCompany &&
      rawCompany !== "-" &&
      rawCompany !== "—" &&
      rawCompany.toLowerCase() !== "n/a"
        ? rawCompany
        : "";
    if (!company) {
      noCompanyCount++;
    }

    parsedRows.push({
      date,
      refNo: rawRef.toUpperCase(),
      asin: rawAsin.toUpperCase(),
      status,
      units,
      company,
      time: rawTime,
    });
  }

  if (!parsedRows.length) {
    return {
      error: `Could not find any valid shipment rows.${ignoredCount > 0 ? ` (Ignored ${ignoredCount} blank, divider, or incomplete rows).` : ""} Please check that your report has Date, Reference No, ASIN, Status, and Units columns.`,
      ignoredCount,
    };
  }

  // Group by Reference Number
  const refGroups = new Map();
  parsedRows.forEach((row) => {
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

    if (!group.asins.some((a) => a.asin === row.asin)) {
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
    totalAsins: parsedRows.length,
    ignoredCount,
    noCompanyCount,
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

  // Count existing duplicates and non-standard ASINs
  let existingCount = 0;
  let invalidAsinCount = 0;
  result.references.forEach((r) => {
    if (
      records.some(
        (rec) => rec.refNo && rec.refNo.toLowerCase() === r.refNo.toLowerCase(),
      )
    ) {
      existingCount++;
    }
    r.asins.forEach((a) => {
      if (!/^[A-Z0-9]{10}$/.test(a.asin)) invalidAsinCount++;
    });
  });

  let infoMsg = "";
  if (result.ignoredCount > 0) {
    infoMsg += `<br><span style="color:#0284c7; font-size:12px; font-weight:600;">🧹 <strong>${result.ignoredCount}</strong> blank, date-divider, or incomplete row(s) automatically filtered and ignored.</span>`;
  }
  if (result.noCompanyCount > 0) {
    infoMsg += `<br><span style="color:#64748b; font-size:12px; font-weight:500;">🏢 <strong>${result.noCompanyCount}</strong> ASIN(s) have no company specified (e.g. Gated/Copylisted) and were accepted as valid.</span>`;
  }
  if (existingCount > 0) {
    infoMsg += `<br><span style="color:#d97706; font-size:12px; font-weight:600;">⚠️ ${existingCount} Reference(s) already exist in portal (new ASINs will be merged into existing records).</span>`;
  }
  if (invalidAsinCount > 0) {
    infoMsg += `<br><span style="color:#dc2626; font-size:12px; font-weight:600;">⚠️ ${invalidAsinCount} ASIN(s) do not match Amazon 10-character alphanumeric standard.</span>`;
  }

  summary.hidden = false;
  summary.className =
    existingCount > 0 || invalidAsinCount > 0
      ? "import-summary warning"
      : "import-summary success";
  summary.innerHTML = `✓ Found <strong>${result.references.length} unique Reference(s)</strong> with <strong>${result.totalAsins} ASIN(s)</strong> for associate <strong>${escapeHtml(employee)}</strong>.${infoMsg}`;

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
            <th>Status / Alerts</th>
          </tr>
        </thead>
        <tbody>
          ${result.references
            .map((r) => {
              const isDup = records.some(
                (rec) =>
                  rec.refNo &&
                  rec.refNo.toLowerCase() === r.refNo.toLowerCase(),
              );
              const dupBadge = isDup
                ? `<span class="badge" style="background:rgba(245,158,11,0.15); color:#d97706; margin-left:6px; font-size:10px;">⚠ Duplicate (Merge)</span>`
                : `<span class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; margin-left:6px; font-size:10px;">New</span>`;

              const asinsHtml = r.asins
                .map((a) => {
                  const isValidAsin = /^[A-Z0-9]{10}$/.test(a.asin);
                  const statusPill =
                    a.status === "Rejected"
                      ? `<span style="color:#dc2626; font-size:10.5px; font-weight:700;">(Rejected)</span>`
                      : `<span style="color:#10b981; font-size:10.5px; font-weight:600;">(${a.status})</span>`;
                  return isValidAsin
                    ? `<span>${escapeHtml(a.asin)} ${statusPill}</span>`
                    : `<span style="color:#dc2626; font-weight:700;" title="Non-standard Amazon ASIN">${escapeHtml(a.asin)} ⚠ ${statusPill}</span>`;
                })
                .join(", ");

              const companyDisplay = r.company
                ? escapeHtml(r.company)
                : `<span style="color:#94a3b8; font-style:italic;" title="No company assigned (Gated/Copylisted)">— (None)</span>`;

              return `
              <tr>
                <td>${escapeHtml(r.date)}</td>
                <td><strong>${escapeHtml(r.refNo)}</strong> ${dupBadge}</td>
                <td>${companyDisplay}</td>
                <td>${r.units}</td>
                <td>${asinsHtml}</td>
                <td>${statusBadge(statusOf(r))}</td>
              </tr>
            `;
            })
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
      if (newRef.company && !existing.company)
        existing.company = newRef.company;
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

  const ignoredText =
    result.ignoredCount > 0
      ? ` (${result.ignoredCount} junk/divider rows ignored)`
      : "";
  showToast(
    `Bulk report imported: ${created} created, ${updated} updated${ignoredText}.`,
  );
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
  const fromInput = $("reportDateFrom") || $("reportDate");
  const toInput = $("reportDateTo") || $("reportDate");
  const from =
    fromInput && fromInput.value ? normalizeDate(fromInput.value) : "";
  const to = toInput && toInput.value ? normalizeDate(toInput.value) : "";
  const employee = $("reportEmployee")?.value || "all";

  const selected = records.filter((r) => {
    const d = normalizeDate(r.date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (employee !== "all" && r.employee !== employee) return false;
    return true;
  });

  const asins = selected.flatMap((r) => r.asins || []);

  let dateLabel = "";
  if (from && to && from === to) {
    dateLabel = from;
  } else if (from && to) {
    dateLabel = `${from} → ${to}`;
  } else if (from) {
    dateLabel = `From ${from}`;
  } else if (to) {
    dateLabel = `Until ${to}`;
  } else {
    dateLabel = "All Time";
  }

  const isSingleDay = Boolean(from && to && from === to);
  const periodTitle = isSingleDay ? "DAILY SHIPMENT REPORT" : "SHIPMENT REPORT";
  const title =
    employee === "all"
      ? `TEAM ${periodTitle}`
      : `${periodTitle} — ${employee.toUpperCase()}`;

  const submitted = asins.filter((a) => a.status === "Submitted").length;
  const rejected = asins.filter((a) => a.status === "Rejected").length;
  const units = selected.reduce((sum, r) => sum + Number(r.units || 0), 0);

  if (!selected.length) {
    $("reportOutput").value = [
      `# ${title}`,
      `Period: ${dateLabel} | Associate: ${employee === "all" ? "Entire Team" : employee}`,
      "",
      "No shipment references recorded for this date range.",
    ].join("\n");
    return;
  }

  const headers = [
    "#",
    "Date",
    "Reference No.",
    "ASINs",
    "Company",
    "Units",
    "Submitted",
    "Rejected",
    "Status",
  ];

  const tableRows = selected
    .sort((a, b) => {
      const dComp = normalizeDate(b.date).localeCompare(normalizeDate(a.date));
      return dComp !== 0 ? dComp : a.refNo.localeCompare(b.refNo);
    })
    .map((r, index) => {
      const rSub = (r.asins || []).filter(
        (a) => a.status === "Submitted",
      ).length;
      const rRej = (r.asins || []).filter(
        (a) => a.status === "Rejected",
      ).length;
      const asinsText = (r.asins || []).map((a) => a.asin).join(", ") || "—";
      const status = statusOf(r);

      return [
        String(index + 1),
        r.date,
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
    `**Period:** ${dateLabel}  |  **Associate:** ${employee === "all" ? "Entire Team" : employee}`,
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
  const fromInput = $("reportDateFrom") || $("reportDate");
  const toInput = $("reportDateTo") || $("reportDate");
  const from =
    fromInput && fromInput.value ? normalizeDate(fromInput.value) : "";
  const to = toInput && toInput.value ? normalizeDate(toInput.value) : "";
  const employee = $("reportEmployee")?.value || "all";
  const selected = records.filter((r) => {
    const d = normalizeDate(r.date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    if (employee !== "all" && r.employee !== employee) return false;
    return true;
  });

  if (!selected.length) {
    showToast(
      "No shipment records available for this date range to generate PDF.",
    );
    return;
  }

  let dateLabel = "";
  if (from && to && from === to) {
    dateLabel = from;
  } else if (from && to) {
    dateLabel = `${from} → ${to}`;
  } else if (from) {
    dateLabel = `From ${from}`;
  } else if (to) {
    dateLabel = `Until ${to}`;
  } else {
    dateLabel = "All Time";
  }

  const isSingleDay = Boolean(from && to && from === to);
  const periodTitle = isSingleDay ? "DAILY SHIPMENT REPORT" : "SHIPMENT REPORT";
  const title =
    employee === "all"
      ? `TEAM ${periodTitle}`
      : `${periodTitle} — ${employee.toUpperCase()}`;

  // ── Dynamic PDF file name ──
  const empSlug =
    employee === "all" ? "Entire_Team" : employee.trim().replace(/\s+/g, "_");
  const pdfFileName = `TEKXS_${empSlug}`;

  const allAsins = selected.flatMap((r) => r.asins || []);

  const submittedAsins = allAsins.filter(
    (a) => a.status === "Submitted",
  ).length;
  const rejectedAsins = allAsins.filter((a) => a.status === "Rejected").length;
  const totalUnitsAll = selected.reduce(
    (sum, r) => sum + Number(r.units || 0),
    0,
  );

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
      .sort((a, b) => {
        const dComp = normalizeDate(b.date).localeCompare(
          normalizeDate(a.date),
        );
        return dComp !== 0 ? dComp : a.refNo.localeCompare(b.refNo);
      })
      .map((r, index) => {
        const rSub = (r.asins || []).filter(
          (a) => a.status === "Submitted",
        ).length;
        const rRej = (r.asins || []).filter(
          (a) => a.status === "Rejected",
        ).length;
        const rTotal = (r.asins || []).length || 1;
        const rSubUnits = Math.round(Number(r.units || 0) * (rSub / rTotal));
        const rRejUnits = Math.round(Number(r.units || 0) * (rRej / rTotal));
        const asinsList = (r.asins || []).map((a) => a.asin).join(", ") || "—";
        const st = statusOf(r);
        const badgeClass =
          {
            Submitted: "badge-sub",
            Rejected: "badge-rej",
            Pending: "badge-pen",
            Mixed: "badge-mix",
          }[st] || "badge-pen";

        return `
        <tr>
          <td style="text-align:center;color:#64748b;font-weight:600;">${index + 1}</td>
          <td style="font-size:8.5px;white-space:nowrap;color:#64748b;">${escapeHtml(r.date)}</td>
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
        <th>Date</th>
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

    const sortedEmp = [...empGroups.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    const maxEmpUnits = Math.max(
      ...sortedEmp.map(([, recs]) =>
        recs.reduce((s, r) => s + Number(r.units || 0), 0),
      ),
      1,
    );

    // ── Employee Summary Cards Grid ──
    let cardsHtml = `<div class="emp-cards-grid">`;
    sortedEmp.forEach(([empName, empRecs]) => {
      const empAsins = empRecs.flatMap((r) => r.asins || []);
      const eSub = empAsins.filter((a) => a.status === "Submitted").length;
      const eRej = empAsins.filter((a) => a.status === "Rejected").length;
      const eUnits = empRecs.reduce((s, r) => s + Number(r.units || 0), 0);
      const eSubUnits = empRecs.reduce((s, r) => {
        const rSub = (r.asins || []).filter(
          (a) => a.status === "Submitted",
        ).length;
        const rTotal = (r.asins || []).length || 1;
        return s + Math.round(Number(r.units || 0) * (rSub / rTotal));
      }, 0);
      const eRejUnits = empRecs.reduce((s, r) => {
        const rRej = (r.asins || []).filter(
          (a) => a.status === "Rejected",
        ).length;
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
        const rSub = (r.asins || []).filter(
          (a) => a.status === "Submitted",
        ).length;
        const rTotal = (r.asins || []).length || 1;
        return s + Math.round(Number(r.units || 0) * (rSub / rTotal));
      }, 0);
      const eRejUnits = empRecs.reduce((s, r) => {
        const rRej = (r.asins || []).filter(
          (a) => a.status === "Rejected",
        ).length;
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
  <title>${pdfFileName}</title>
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
    .brand-logo-print { max-height: 52px; width: auto; display: block; }
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
      <p class="meta-desc">Period: <strong>${escapeHtml(dateLabel)}</strong> | Associate: <strong>${escapeHtml(employee === "all" ? "Entire Team" : employee)}</strong></p>
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

  // ── Set main document title so browser uses it as PDF filename ──
  const _origTitle = document.title;
  document.title = pdfFileName;

  const restoreTitle = () => {
    document.title = _origTitle;
    printIframe.contentWindow.removeEventListener("afterprint", restoreTitle);
  };
  printIframe.contentWindow.addEventListener("afterprint", restoreTitle);

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
  localStorage.removeItem(TARGETS_KEY);
  records = loadRecords();
  targets = loadTargets();
  saveRecords();
  saveTargets();
  renderAll();
  showToast("Demo data restored.");
}

function init() {
  saveRecords();

  if ($("fromDate")) $("fromDate").value = "";
  if ($("toDate")) $("toDate").value = "";
  if ($("reportDate")) $("reportDate").value = localDate();
  // Report date range defaults → today
  const _today = localDate();
  if ($("reportDateFrom")) $("reportDateFrom").value = _today;
  if ($("reportDateTo")) $("reportDateTo").value = _today;

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
  $("refNo")?.addEventListener("input", checkDuplicateRefNo);

  // ── Dashboard Filter Listeners ──
  document.querySelectorAll("[data-dash-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-dash-preset]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyDatePreset(
        btn.dataset.dashPreset,
        "fromDate",
        "toDate",
        renderDashboard,
      );
    });
  });

  $("fromDate")?.addEventListener("change", () => {
    document
      .querySelectorAll("[data-dash-preset]")
      .forEach((b) => b.classList.remove("active"));
    renderDashboard();
  });
  $("toDate")?.addEventListener("change", () => {
    document
      .querySelectorAll("[data-dash-preset]")
      .forEach((b) => b.classList.remove("active"));
    renderDashboard();
  });
  $("resetDates")?.addEventListener("click", () => {
    $("fromDate").value = "";
    $("toDate").value = "";
    document
      .querySelectorAll("[data-dash-preset]")
      .forEach((b) => b.classList.remove("active"));
    document.querySelector("[data-dash-preset='all']")?.classList.add("active");
    renderDashboard();
  });

  // ── Reference Tracking Filter Listeners ──
  document.querySelectorAll("[data-ref-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-ref-preset]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyDatePreset(
        btn.dataset.refPreset,
        "refFilterFrom",
        "refFilterTo",
        renderReferences,
      );
    });
  });

  $("refFilterFrom")?.addEventListener("change", () => {
    document
      .querySelectorAll("[data-ref-preset]")
      .forEach((b) => b.classList.remove("active"));
    renderReferences();
  });
  $("refFilterTo")?.addEventListener("change", () => {
    document
      .querySelectorAll("[data-ref-preset]")
      .forEach((b) => b.classList.remove("active"));
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
    document
      .querySelectorAll("[data-ref-preset]")
      .forEach((b) => b.classList.remove("active"));
    document.querySelector("[data-ref-preset='all']")?.classList.add("active");
    renderReferences();
    showToast("Reference filters reset.");
  });

  // ── Employee Performance Filter Listeners ──
  document.querySelectorAll("[data-emp-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-emp-preset]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyDatePreset(
        btn.dataset.empPreset,
        "empFilterFrom",
        "empFilterTo",
        renderEmployees,
      );
    });
  });

  $("empFilterFrom")?.addEventListener("change", () => {
    document
      .querySelectorAll("[data-emp-preset]")
      .forEach((b) => b.classList.remove("active"));
    renderEmployees();
  });
  $("empFilterTo")?.addEventListener("change", () => {
    document
      .querySelectorAll("[data-emp-preset]")
      .forEach((b) => b.classList.remove("active"));
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
    document
      .querySelectorAll("[data-emp-preset]")
      .forEach((b) => b.classList.remove("active"));
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

  // ── Report Date Range Preset Buttons ──
  document.querySelectorAll("[data-rep-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll("[data-rep-preset]")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyDatePreset(
        btn.dataset.repPreset,
        "reportDateFrom",
        "reportDateTo",
        generateReport,
      );
    });
  });

  // ── Report Date Range From / To change listeners ──
  $("reportDateFrom")?.addEventListener("change", () => {
    document
      .querySelectorAll("[data-rep-preset]")
      .forEach((b) => b.classList.remove("active"));
    generateReport();
  });
  $("reportDateTo")?.addEventListener("change", () => {
    document
      .querySelectorAll("[data-rep-preset]")
      .forEach((b) => b.classList.remove("active"));
    generateReport();
  });

  // ── Reset Report Dates ──
  $("resetReportDates")?.addEventListener("click", () => {
    const t = localDate();
    if ($("reportDateFrom")) $("reportDateFrom").value = t;
    if ($("reportDateTo")) $("reportDateTo").value = t;
    document
      .querySelectorAll("[data-rep-preset]")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelector("[data-rep-preset='today']")
      ?.classList.add("active");
    generateReport();
    showToast("Report dates reset to today.");
  });

  $("copyReport")?.addEventListener("click", copyReport);
  $("downloadPdf")?.addEventListener("click", downloadPdfReport);
  $("exportCsv")?.addEventListener("click", exportCsv);
  $("downloadJson")?.addEventListener("click", downloadJsonBackup);
  $("restoreJsonFile")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      if ($("restoreFileName")) $("restoreFileName").textContent = file.name;
      handleRestoreJsonFile(file);
    }
  });
  $("clearDemo")?.addEventListener("click", resetDemoData);
  $("saveTargetsBtn")?.addEventListener("click", saveTargetsFromGrid);

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

///////////////////////////

/* ==================================
   SHIFT TIMING SETTINGS
================================== */

const SHIFT_STORAGE_KEY = "medicore_shipment_shift_v1";

function getSavedShift() {
  try {
    const saved = localStorage.getItem(SHIFT_STORAGE_KEY);

    return saved ? JSON.parse(saved) : { start: "23:00", end: "07:00" };
  } catch {
    return { start: "23:00", end: "07:00" };
  }
}

function formatShiftTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function updateShiftLabel() {
  const shift = getSavedShift();
  const label = document.getElementById("activeShiftLabel");

  if (label) {
    // label.textContent =
    //   `Shift: ${formatShiftTime(shift.start)} – ${formatShiftTime(shift.end)}`;
    label.textContent = "Note: Shift Timing feature coming soon!";
  }
}

function closeShiftPopup() {
  document.getElementById("shiftPopupOverlay")?.classList.remove("open");
}

function openShiftPopup() {
  const shift = getSavedShift();

  document.getElementById("shiftStartTime").value = shift.start;
  document.getElementById("shiftEndTime").value = shift.end;

  document.getElementById("shiftPopupOverlay").classList.add("open");
}

function saveShiftPopup() {
  const start = document.getElementById("shiftStartTime").value;
  const end = document.getElementById("shiftEndTime").value;

  if (!start || !end || start === end) {
    alert("Please select a valid shift start and end time.");
    return;
  }

  localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify({ start, end }));

  updateShiftLabel();
  closeShiftPopup();

  alert("Shift timing saved successfully!");

  // Refresh the report using the saved shift.
  // This takes effect after the report generator is connected below.
  if (typeof generateShiftReport === "function") {
    generateShiftReport();
  }
}

document
  .getElementById("openShiftSettings")
  ?.addEventListener("click", openShiftPopup);

document
  .getElementById("closeShiftSettings")
  ?.addEventListener("click", closeShiftPopup);

document
  .getElementById("cancelShiftSettings")
  ?.addEventListener("click", closeShiftPopup);

document
  .getElementById("saveShiftSettings")
  ?.addEventListener("click", saveShiftPopup);

document
  .getElementById("shiftPopupOverlay")
  ?.addEventListener("click", function (event) {
    if (event.target === this) closeShiftPopup();
  });

updateShiftLabel();

/* ===== TEKXS Portal Feedback ===== */
(() => {
  const button = document.getElementById("portalFeedbackBtn");
  const overlay = document.getElementById("portalFeedbackOverlay");
  const closeButton = document.getElementById("closeFeedbackPopup");
  const hideButton = document.getElementById("hideFeedbackBtn");
  const form = document.getElementById("portalFeedbackForm");

  if (!button || !overlay || !form) return;

  const openFeedback = () => overlay.classList.add("open");
  const closeFeedback = () => overlay.classList.remove("open");

  button.addEventListener("click", (event) => {
    if (event.target.closest("#hideFeedbackBtn")) {
      event.stopPropagation();
      button.style.display = "none";
      return;
    }
    openFeedback();
  });

  closeButton?.addEventListener("click", closeFeedback);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeFeedback();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeFeedback();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const category = document.getElementById("feedbackCategory").value;
    const rating = form.querySelector(
      'input[name="feedbackRating"]:checked',
    )?.value;
    const message = document.getElementById("feedbackMessage").value.trim();
    const employee = document.getElementById("feedbackEmployee").value.trim();

    if (!category || !rating || !message) {
      alert("Please complete all required feedback fields.");
      return;
    }

    const feedback = {
      id: Date.now(),
      category,
      rating: Number(rating),
      message,
      employee: employee || "Anonymous",
      submittedAt: new Date().toISOString(),
    };

    try {
      const storageKey = "tekxs_portal_feedback_v1";
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");

      if (!Array.isArray(saved)) {
        throw new Error("Invalid feedback storage");
      }

      saved.push(feedback);
      localStorage.setItem(storageKey, JSON.stringify(saved));

      renderFeedback();

      alert("Thank you! Your feedback has been saved successfully.");

      form.reset();
      closeFeedback();
    } catch (error) {
      alert("Feedback could not be saved. Please check browser storage.");
    }
  });
})();

// Feedback Management ka complete page

/* =========================================
   FEEDBACK MANAGEMENT
   Reads from the existing feedback storage
========================================= */

const PORTAL_FEEDBACK_KEY = "tekxs_portal_feedback_v1";

function readPortalFeedback() {
  try {
    const data = JSON.parse(localStorage.getItem(PORTAL_FEEDBACK_KEY) || "[]");

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Could not read feedback:", error);
    return [];
  }
}

function escapeFeedbackHTML(value) {
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

function formatFeedbackDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderFeedback() {
  const list = document.getElementById("feedbackList");
  if (!list) return;

  const feedback = readPortalFeedback();

  const search = (document.getElementById("feedbackSearch")?.value || "")
    .trim()
    .toLowerCase();

  const type = document.getElementById("feedbackTypeFilter")?.value || "all";
  const rating =
    document.getElementById("feedbackRatingFilter")?.value || "all";

  const total = feedback.length;

  const average = total
    ? feedback.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) /
      total
    : 0;

  document.getElementById("feedbackTotal").textContent = total;
  document.getElementById("feedbackAverage").textContent = total
    ? `${average.toFixed(1)} / 5`
    : "—";

  document.getElementById("feedbackSuggestions").textContent = feedback.filter(
    (item) => item.category === "Suggestion",
  ).length;

  document.getElementById("feedbackBugs").textContent = feedback.filter(
    (item) => item.category === "Bug Report",
  ).length;

  const filtered = feedback
    .filter((item) => {
      const searchable = [item.employee, item.category, item.message]
        .join(" ")
        .toLowerCase();

      return (
        (!search || searchable.includes(search)) &&
        (type === "all" || item.category === type) &&
        (rating === "all" || Number(item.rating) === Number(rating))
      );
    })
    .sort(
      (a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0),
    );

  document.getElementById("feedbackResultCount").textContent =
    `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`;

  document.getElementById("feedbackEmpty").hidden = filtered.length > 0;

  list.innerHTML = filtered
    .map((item) => {
      const employee = String(item.employee || "Anonymous");
      const initials = employee.trim().charAt(0).toUpperCase() || "?";
      const stars = Math.max(0, Math.min(5, Number(item.rating) || 0));

      return `
      <article class="feedback-entry">
        <div class="feedback-entry-top">
          <div class="feedback-entry-identity">
            <div class="feedback-entry-avatar">
              ${escapeFeedbackHTML(initials)}
            </div>
            <div>
              <h4>${escapeFeedbackHTML(employee)}</h4>
              <div class="feedback-entry-date">
                ${escapeFeedbackHTML(formatFeedbackDate(item.submittedAt))}
              </div>
            </div>
          </div>

          <span class="feedback-type-tag">
            ${escapeFeedbackHTML(item.category || "Other")}
          </span>
        </div>

        <div class="feedback-entry-rating"
          aria-label="${stars} out of 5 stars">
          ${"★".repeat(stars)}${"☆".repeat(5 - stars)}
        </div>

        <p class="feedback-entry-message">
          ${escapeFeedbackHTML(item.message || "")}
        </p>

        <div class="feedback-entry-footer">
          <span>TEKXS Shipment Portal</span>
          <span>·</span>
          <span>Rating: ${stars}/5</span>
        </div>
      </article>
    `;
    })
    .join("");
}

document
  .getElementById("refreshFeedback")
  ?.addEventListener("click", renderFeedback);

document
  .getElementById("feedbackSearch")
  ?.addEventListener("input", renderFeedback);

document
  .getElementById("feedbackTypeFilter")
  ?.addEventListener("change", renderFeedback);

document
  .getElementById("feedbackRatingFilter")
  ?.addEventListener("change", renderFeedback);
