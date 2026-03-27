import { apiRequest, escapeHtml } from "./api-client.js";

let budgetChart;
let expenseChart;
let monthlyReportChart;
let currentRecords = [];

// Formatting helpers
function formatCurrency(value) {
  const amount = Number(value || 0);
  return `KES ${amount.toLocaleString()}`;
}

function setElementText(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerText = value;
  }
}

function setElementValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.value = value;
  }
}

function setElementHtml(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = value;
  }
}

function sortByDateDesc(records) {
  return [...records].sort((a, b) => {
    const first = a.date || "";
    const second = b.date || "";
    return second.localeCompare(first);
  });
}

function sortByDateAsc(records) {
  return [...records].sort((a, b) => {
    const first = a.date || "";
    const second = b.date || "";
    const dateComparison = first.localeCompare(second);
    if (dateComparison !== 0) return dateComparison;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

// Budget helpers
function getMonthKey(date) {
  return String(date || "").slice(0, 7);
}

function getBudgetGroupKey(category, date) {
  return `${getMonthKey(date)}::${String(category || "").trim().toLowerCase()}`;
}

function buildMonthlyBudgetMap(records) {
  const budgetMap = new Map();
  const expenses = sortByDateAsc(records.filter((record) => record.type === "Expenditure"));

  expenses.forEach((record) => {
    const explicitBudget = Number(record.budget || 0);
    if (explicitBudget <= 0) return;

    budgetMap.set(getBudgetGroupKey(record.category, record.date), explicitBudget);
  });

  return budgetMap;
}

function getEffectiveBudget(record, budgetMap) {
  const explicitBudget = Number(record.budget || 0);
  if (explicitBudget > 0) {
    return explicitBudget;
  }

  return Number(budgetMap.get(getBudgetGroupKey(record.category, record.date)) || 0);
}

function getMonthlyBudgetEntries(records) {
  const budgetMap = buildMonthlyBudgetMap(records);

  return [...budgetMap.entries()].map(([key, budget]) => ({
    key,
    budget: Number(budget || 0)
  }));
}

// Date and filter helpers
function parseRecordDate(value) {
  return value ? new Date(`${value}T00:00:00`) : null;
}

function getStartOfWeek(date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfWeek(date) {
  const end = getStartOfWeek(date);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function matchesRecordFilter(record, filterValue, selectedMonth = "") {
  const recordDate = parseRecordDate(record.date);
  if (!recordDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filterValue === "today") {
    return recordDate.getTime() === today.getTime();
  }

  if (filterValue === "week") {
    return recordDate >= getStartOfWeek(today) && recordDate <= getEndOfWeek(today);
  }

  if (filterValue === "month") {
    return (
      recordDate.getFullYear() === today.getFullYear() &&
      recordDate.getMonth() === today.getMonth()
    );
  }

  if (filterValue === "custom-month") {
    return selectedMonth !== "" && String(record.date || "").startsWith(selectedMonth);
  }

  return true;
}

function getFilterValue(elementId) {
  return document.getElementById(elementId)?.value || "month";
}

function getSelectedMonthValue(elementId) {
  return document.getElementById(elementId)?.value || "";
}

function getOverviewMonth() {
  const overviewMonth = document.getElementById("overviewMonth");
  const defaultMonth = new Date().toISOString().slice(0, 7);

  if (!overviewMonth) {
    return defaultMonth;
  }

  if (!overviewMonth.value) {
    overviewMonth.value = defaultMonth;
  }

  return overviewMonth.value;
}

function getOverviewRecords(records) {
  const selectedMonth = getOverviewMonth();
  return records.filter((record) => String(record.date || "").startsWith(selectedMonth));
}

function getRecordsByType(records, type) {
  return records.filter((record) => record.type === type);
}

function getFilteredRecords(records, type, filterId, monthId) {
  return sortByDateDesc(
    getRecordsByType(records, type).filter((record) =>
      matchesRecordFilter(record, getFilterValue(filterId), getSelectedMonthValue(monthId))
    )
  );
}

function destroyChart(chartRef) {
  if (chartRef) {
    chartRef.destroy();
  }
}

// Dashboard rendering
function updateSummary(records) {
  const overviewRecords = getOverviewRecords(records);

  const incomeTotal = getRecordsByType(overviewRecords, "Income")
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);

  const expenseTotal = getRecordsByType(overviewRecords, "Expenditure")
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);

  setElementText("studentTotalIncome", formatCurrency(incomeTotal));
  setElementText("studentTotalSpend", formatCurrency(expenseTotal));
  setElementText("studentBalance", formatCurrency(incomeTotal - expenseTotal));
}

function renderExpenseTable(records) {
  const expenseTableBody = document.getElementById("expenseTableBody");
  if (!expenseTableBody) return;

  const budgetMap = buildMonthlyBudgetMap(records);
  const balanceByRecordId = new Map();
  const runningSpendByCategory = new Map();
  sortByDateAsc(getRecordsByType(records, "Expenditure")).forEach((record) => {
    const key = getBudgetGroupKey(record.category, record.date);
    const budget = getEffectiveBudget(record, budgetMap);
    const updatedSpend = (runningSpendByCategory.get(key) || 0) + Number(record.amount || 0);
    runningSpendByCategory.set(key, updatedSpend);
    balanceByRecordId.set(String(record.id), budget - updatedSpend);
  });

  const expenses = getFilteredRecords(
    records,
    "Expenditure",
    "expenseRecordFilter",
    "expenseRecordMonth"
  );

  if (!expenses.length) {
    expenseTableBody.innerHTML = `
      <tr>
        <td colspan="6">No expense records for this filter.</td>
      </tr>
    `;
    return;
  }

  expenseTableBody.innerHTML = expenses
    .map((record) => {
      const budget = getEffectiveBudget(record, budgetMap);
      const actual = Number(record.amount || 0);
      const balance = Number(balanceByRecordId.get(String(record.id)) || 0);
      const balanceColor = balance < 0 ? "var(--danger)" : "var(--primary-dark)";

      return `
        <tr>
          <td>${escapeHtml(record.category)}</td>
          <td>${formatCurrency(budget)}</td>
          <td>${formatCurrency(actual)}</td>
          <td style="color: ${balanceColor}">${formatCurrency(balance)}</td>
          <td>${escapeHtml(record.date || "-")}</td>
          <td><button type="button" onclick="deleteRecord('${record.id}')">Delete</button></td>
        </tr>
      `;
    })
    .join("");
}

function renderIncomeTable(records) {
  const incomeTableBody = document.getElementById("incomeTableBody");
  if (!incomeTableBody) return;

  const incomes = getFilteredRecords(records, "Income", "incomeRecordFilter", "incomeRecordMonth");

  if (!incomes.length) {
    incomeTableBody.innerHTML = `
      <tr>
        <td colspan="4">No income records for this filter.</td>
      </tr>
    `;
    return;
  }

  incomeTableBody.innerHTML = incomes
    .map(
      (record) => `
        <tr>
          <td>${escapeHtml(record.category)}</td>
          <td>${formatCurrency(record.amount)}</td>
          <td>${escapeHtml(record.date || "-")}</td>
          <td><button type="button" onclick="deleteRecord('${record.id}')">Delete</button></td>
        </tr>
      `
    )
    .join("");
}

function renderHomeCharts(records) {
  const expenseBreakdownChart = document.getElementById("expenseBreakdownChart");
  const budgetComparisonChart = document.getElementById("budgetComparisonChart");

  if (!expenseBreakdownChart || !budgetComparisonChart) return;

  const overviewMonth = getOverviewMonth();
  const overviewRecords = getOverviewRecords(records);
  const expenses = getRecordsByType(overviewRecords, "Expenditure");
  const monthlyBudgetEntries = getMonthlyBudgetEntries(records).filter((entry) =>
    entry.key.startsWith(`${overviewMonth}::`)
  );
  const categoryTotals = expenses.reduce((totals, record) => {
    const key = record.category || "Other";
    totals[key] = (totals[key] || 0) + Number(record.amount || 0);
    return totals;
  }, {});

  const totalBudget = monthlyBudgetEntries.reduce((sum, entry) => sum + entry.budget, 0);
  const totalActual = expenses.reduce((sum, record) => sum + Number(record.amount || 0), 0);

  destroyChart(expenseChart);
  destroyChart(budgetChart);

  expenseChart = new Chart(expenseBreakdownChart.getContext("2d"), {
    type: "pie",
    data: {
      labels: Object.keys(categoryTotals).length ? Object.keys(categoryTotals) : ["No Data"],
      datasets: [
        {
          data: Object.keys(categoryTotals).length ? Object.values(categoryTotals) : [1],
          backgroundColor: Object.keys(categoryTotals).length
            ? ["#b9917b", "#d8b7a3", "#946f5c", "#ead8cc", "#8a776d", "#45362e"]
            : ["#ead8cc"]
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });

  budgetChart = new Chart(budgetComparisonChart.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Budget", "Actual"],
      datasets: [
        {
          label: "KES",
          data: [totalBudget, totalActual],
          backgroundColor: ["#d8b7a3", "#45362e"]
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderMonthlyReport(records) {
  const monthlySpend = document.getElementById("monthlySpend");
  const monthlyIncome = document.getElementById("monthlyIncome");
  const monthFilter = document.getElementById("monthFilter");
  const reportChart = document.getElementById("reportChart");
  if (!monthlySpend || !monthlyIncome || !monthFilter || !reportChart) return;

  const selectedMonth = monthFilter.value || new Date().toISOString().slice(0, 7);
  if (!monthFilter.value) {
    monthFilter.value = selectedMonth;
  }

  const monthlyRecords = records.filter((record) => (record.date || "").startsWith(selectedMonth));
  const monthlyExpenses = getRecordsByType(monthlyRecords, "Expenditure");
  const monthlyIncomes = getRecordsByType(monthlyRecords, "Income");
  const monthlyBudgetEntries = getMonthlyBudgetEntries(records).filter((entry) =>
    entry.key.startsWith(`${selectedMonth}::`)
  );

  const totalMonthlySpend = monthlyExpenses.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const totalMonthlyIncome = monthlyIncomes.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const monthlyBudget = monthlyBudgetEntries.reduce((sum, entry) => sum + entry.budget, 0);

  monthlySpend.innerText = formatCurrency(totalMonthlySpend);
  monthlyIncome.innerText = formatCurrency(totalMonthlyIncome);

  const monthlyCategoryTotals = monthlyExpenses.reduce((totals, record) => {
    const key = record.category || "Other";
    totals[key] = (totals[key] || 0) + Number(record.amount || 0);
    return totals;
  }, {});

  destroyChart(monthlyReportChart);
  monthlyReportChart = new Chart(reportChart.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Income", "Budget", "Actual Spend"],
      datasets: [
        {
          label: selectedMonth,
          data: [totalMonthlyIncome, monthlyBudget, totalMonthlySpend],
          backgroundColor: ["#b9917b", "#d8b7a3", "#45362e"]
        }
      ]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(context.raw)}`,
            afterBody: (tooltipItems) => {
              const hoveredLabel = tooltipItems[0]?.label || "";
              if (hoveredLabel !== "Actual Spend" || !Object.keys(monthlyCategoryTotals).length) {
                return "";
              }

              return Object.entries(monthlyCategoryTotals).map(
                ([category, total]) => `${category}: ${formatCurrency(total)}`
              );
            }
          }
        }
      }
    }
  });
}

function renderStudentDashboard(records) {
  currentRecords = records;
  updateSummary(records);
  renderExpenseTable(records);
  renderIncomeTable(records);
  renderHomeCharts(records);
  renderMonthlyReport(records);
}

// Student actions
window.initRealTimeData = async function () {
  try {
    if (!window.currentUser?.firebaseUid) {
      return;
    }

    const payload = await apiRequest(`/api/records?firebaseUid=${encodeURIComponent(window.currentUser.firebaseUid)}`);
    renderStudentDashboard(payload.records || []);
  } catch (error) {
    console.warn("Unable to load student records", error);
  }
};

window.loadMonthlyReport = function () {
  renderMonthlyReport(currentRecords);
};

window.loadOverviewMonth = function () {
  updateSummary(currentRecords);
  renderHomeCharts(currentRecords);
};

window.handleRecordFilterChange = function (type) {
  const select = document.getElementById(`${type}RecordFilter`);
  const monthInput = document.getElementById(`${type}RecordMonth`);

  if (!select || !monthInput) {
    window.applyRecordFilters();
    return;
  }

  const useCustomMonth = select.value === "custom-month";
  monthInput.classList.toggle("hidden", !useCustomMonth);

  if (useCustomMonth && !monthInput.value) {
    monthInput.value = new Date().toISOString().slice(0, 7);
  }

  window.applyRecordFilters();
};

window.applyRecordFilters = function () {
  renderExpenseTable(currentRecords);
  renderIncomeTable(currentRecords);
};

window.addExpenseRecord = async function () {
  const amount = parseFloat(document.getElementById("expenseAmount").value);
  const rawBudget = document.getElementById("expenseBudget").value.trim();
  const category = document.getElementById("expenseCategory").value.trim();
  const date = document.getElementById("expenseDate").value;
  const budgetMap = buildMonthlyBudgetMap(currentRecords);
  const budget = rawBudget === ""
    ? Number(budgetMap.get(getBudgetGroupKey(category, date)) || 0)
    : parseFloat(rawBudget);

  if (!window.currentUser?.firebaseUid) {
    alert("Please log in first.");
    return;
  }

  if (Number.isNaN(amount) || Number.isNaN(budget) || !category || !date) {
    alert("Please enter amount, category, and date. Budget is optional.");
    return;
  }

  try {
    await apiRequest("/api/records", {
      method: "POST",
      body: {
        firebaseUid: window.currentUser.firebaseUid,
        type: "Expenditure",
        category,
        amount,
        budget,
        date
      }
    });

    document.getElementById("expenseAmount").value = "";
    document.getElementById("expenseBudget").value = "";
    document.getElementById("expenseCategory").value = "";
    document.getElementById("expenseDate").value = "";

    await window.initRealTimeData();
  } catch (error) {
    alert(error.message || "Unable to add expense.");
  }
};

window.addIncomeRecord = async function () {
  const amount = parseFloat(document.getElementById("incomeAmount").value);
  const category = document.getElementById("incomeType").value;
  const date = document.getElementById("incomeDate").value;

  if (!window.currentUser?.firebaseUid) {
    alert("Please log in first.");
    return;
  }

  if (Number.isNaN(amount) || !date) {
    alert("Please enter income amount and date.");
    return;
  }

  try {
    await apiRequest("/api/records", {
      method: "POST",
      body: {
        firebaseUid: window.currentUser.firebaseUid,
        type: "Income",
        category,
        amount,
        budget: 0,
        date
      }
    });

    document.getElementById("incomeAmount").value = "";
    document.getElementById("incomeDate").value = "";

    await window.initRealTimeData();
  } catch (error) {
    alert(error.message || "Unable to add income.");
  }
};

window.deleteRecord = async function (recordId) {
  const uid = encodeURIComponent(window.currentUser?.firebaseUid || "");
  await apiRequest(`/api/records/${recordId}?firebaseUid=${uid}`, {
    method: "DELETE"
  });

  await window.initRealTimeData();
};

window.resetStudentUI = function () {
  currentRecords = [];
  setElementText("studentTotalIncome", "KES 0");
  setElementText("studentTotalSpend", "KES 0");
  setElementText("studentBalance", "KES 0");
  setElementHtml("expenseTableBody", "");
  setElementHtml("incomeTableBody", "");
  setElementText("monthlySpend", "KES 0");
  setElementText("monthlyIncome", "KES 0");
  setElementText("studentWelcome", "Welcome");
  setElementText("profileName", "-");
  setElementText("profileEmail", "-");
  setElementText("profileRole", "-");
  setElementValue("overviewMonth", "");

  destroyChart(expenseChart);
  destroyChart(budgetChart);
  destroyChart(monthlyReportChart);
  expenseChart = null;
  budgetChart = null;
  monthlyReportChart = null;

  const expenseRecordFilter = document.getElementById("expenseRecordFilter");
  const incomeRecordFilter = document.getElementById("incomeRecordFilter");
  const expenseRecordMonth = document.getElementById("expenseRecordMonth");
  const incomeRecordMonth = document.getElementById("incomeRecordMonth");

  if (expenseRecordFilter) expenseRecordFilter.value = "today";
  if (incomeRecordFilter) incomeRecordFilter.value = "today";
  if (expenseRecordMonth) {
    expenseRecordMonth.value = "";
    expenseRecordMonth.classList.add("hidden");
  }
  if (incomeRecordMonth) {
    incomeRecordMonth.value = "";
    incomeRecordMonth.classList.add("hidden");
  }
};
