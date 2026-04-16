import { apiRequest, escapeHtml } from "./api-client.js";

// ===== Formatting helper =====
function formatCurrency(value) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

// ===== Load admin users table =====
window.loadAllUsers = async function () {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const uid = encodeURIComponent(window.currentUser?.firebaseUid || "");
  const payload = await apiRequest(`/api/admin/users?firebaseUid=${uid}`);
  const users = payload.users || [];

  tbody.innerHTML = users
    .map(
      (user) => `
        <tr>
          <td>${escapeHtml(user.fullName)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.role)}</td>
        </tr>
      `
    )
    .join("");

  document.getElementById("totalUsers").textContent = users.length;
};

// ===== Load admin records table =====
window.loadAllSystemRecords = async function () {
  const tbody = document.getElementById("adminRecordsTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const uid = encodeURIComponent(window.currentUser?.firebaseUid || "");
  const payload = await apiRequest(`/api/admin/records?firebaseUid=${uid}`);
  const records = payload.records || [];

  tbody.innerHTML = records
    .map(
      (record) => `
        <tr>
          <td>${escapeHtml(record.userId)}</td>
          <td>${escapeHtml(record.type)}</td>
          <td>${escapeHtml(record.category)}</td>
          <td>${formatCurrency(record.amount)}</td>
          <td>${formatCurrency(record.budget)}</td>
          <td>${escapeHtml(record.date)}</td>
        </tr>
      `
    )
    .join("");

  document.getElementById("totalRecords").textContent = records.length;
};

// ===== Load admin summary totals =====
window.loadAdminSummary = async function () {
  const uid = encodeURIComponent(window.currentUser?.firebaseUid || "");
  const payload = await apiRequest(`/api/admin/summary?firebaseUid=${uid}`);
  document.getElementById("adminIncomeTotal").textContent = payload.incomeCount ?? 0;
  document.getElementById("adminExpenseTotal").textContent = payload.expenseCount ?? 0;
  document.getElementById("totalRecords").textContent = payload.totalRecords ?? 0;
};

// ===== Auto-refresh admin data while dashboard is open =====
setInterval(async () => {
  const dashboard = document.getElementById("adminDashboard");
  if (!dashboard || dashboard.classList.contains("hidden")) {
    return;
  }

  try {
    await window.loadAllUsers();
    await window.loadAllSystemRecords();
  } catch (error) {
    console.warn("Unable to refresh admin data", error);
  }
}, 4000);
