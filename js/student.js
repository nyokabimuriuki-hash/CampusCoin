import { apiRequest, escapeHtml } from "./api-client.js";

let budgetChart;
let expenseChart;
let monthlyReportChart;
let currentRecords = [];

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `KES ${amount.toLocaleString()}`;
}

function sortByDateDesc(records) {
  return [...records].sort((a, b) => {
    const first = a.date || "";
    const second = b.date || "";
    return second.localeCompare(first);
  });
}

function destroyChart(chartRef) {
  if (chartRef) {
    chartRef.destroy();
  }
}

function updateSummary(records) {
  const incomeTotal = records
    .filter((record) => record.type === "Income")
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);

  const expenseTotal = records
    .filter((record) => record.type === "Expenditure")
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);

  const studentTotalIncome = document.getElementById("studentTotalIncome");
  const studentTotalSpend = document.getElementById("studentTotalSpend");
  const studentBalance = document.getElementById("studentBalance");

  if (studentTotalIncome) studentTotalIncome.innerText = formatCurrency(incomeTotal);
  if (studentTotalSpend) studentTotalSpend.innerText = formatCurrency(expenseTotal);
  if (studentBalance) studentBalance.innerText = formatCurrency(incomeTotal - expenseTotal);
}

function renderExpenseTable(records) {
  const expenseTableBody = document.getElementById("expenseTableBody");
  if (!expenseTableBody) return;

  const expenses = sortByDateDesc(records.filter((record) => record.type === "Expenditure"));

  if (!expenses.length) {
    expenseTableBody.innerHTML = `
      <tr>
        <td colspan="6">No expense records yet.</td>
      </tr>
    `;
    return;
  }

  expenseTableBody.innerHTML = expenses
    .map((record) => {
      const budget = Number(record.budget || 0);
      const actual = Number(record.amount || 0);
      const variance = actual - budget;
      const varianceColor = variance > 0 ? "var(--danger)" : "var(--primary-dark)";

      return `
        <tr>
          <td>${escapeHtml(record.category)}</td>
          <td>${formatCurrency(budget)}</td>
          <td>${formatCurrency(actual)}</td>
          <td style="color: ${varianceColor}">${formatCurrency(variance)}</td>
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

  const incomes = sortByDateDesc(records.filter((record) => record.type === "Income"));

  if (!incomes.length) {
    incomeTableBody.innerHTML = `
      <tr>
        <td colspan="4">No income records yet.</td>
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

  const expenses = records.filter((record) => record.type === "Expenditure");
  const categoryTotals = expenses.reduce((totals, record) => {
    const key = record.category || "Other";
    totals[key] = (totals[key] || 0) + Number(record.amount || 0);
    return totals;
  }, {});

  const totalBudget = expenses.reduce((sum, record) => sum + Number(record.budget || 0), 0);
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
  const monthlyExpenses = monthlyRecords.filter((record) => record.type === "Expenditure");
  const monthlyIncomes = monthlyRecords.filter((record) => record.type === "Income");

  const totalMonthlySpend = monthlyExpenses.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const totalMonthlyIncome = monthlyIncomes.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const monthlyBudget = monthlyExpenses.reduce((sum, record) => sum + Number(record.budget || 0), 0);

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
            afterBody: () => {
              if (!Object.keys(monthlyCategoryTotals).length) return "";
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

window.addExpenseRecord = async function () {
  const amount = parseFloat(document.getElementById("expenseAmount").value);
  const rawBudget = document.getElementById("expenseBudget").value.trim();
  const budget = rawBudget === "" ? 0 : parseFloat(rawBudget);
  const category = document.getElementById("expenseCategory").value.trim();
  const date = document.getElementById("expenseDate").value;

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

  const studentTotalIncome = document.getElementById("studentTotalIncome");
  const studentTotalSpend = document.getElementById("studentTotalSpend");
  const studentBalance = document.getElementById("studentBalance");
  const expenseTableBody = document.getElementById("expenseTableBody");
  const incomeTableBody = document.getElementById("incomeTableBody");
  const monthlySpend = document.getElementById("monthlySpend");
  const monthlyIncome = document.getElementById("monthlyIncome");
  const studentWelcome = document.getElementById("studentWelcome");
  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const profileRole = document.getElementById("profileRole");

  if (studentTotalIncome) studentTotalIncome.innerText = "KES 0";
  if (studentTotalSpend) studentTotalSpend.innerText = "KES 0";
  if (studentBalance) studentBalance.innerText = "KES 0";
  if (expenseTableBody) expenseTableBody.innerHTML = "";
  if (incomeTableBody) incomeTableBody.innerHTML = "";
  if (monthlySpend) monthlySpend.innerText = "KES 0";
  if (monthlyIncome) monthlyIncome.innerText = "KES 0";
  if (studentWelcome) studentWelcome.innerText = "Welcome";
  if (profileName) profileName.innerText = "-";
  if (profileEmail) profileEmail.innerText = "-";
  if (profileRole) profileRole.innerText = "-";

  destroyChart(expenseChart);
  destroyChart(budgetChart);
  destroyChart(monthlyReportChart);
  expenseChart = null;
  budgetChart = null;
  monthlyReportChart = null;
};
