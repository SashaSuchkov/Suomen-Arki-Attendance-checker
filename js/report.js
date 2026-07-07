// Attendance report: view a date range across all students + export as CSV

const reportFromInput = document.getElementById("report-from");
const reportToInput = document.getElementById("report-to");
const generateReportBtn = document.getElementById("generate-report-btn");
const reportSpinner = document.getElementById("report-spinner");
const downloadCsvBtn = document.getElementById("download-csv-btn");
const reportStatus = document.getElementById("report-status");
const reportTableWrapper = document.getElementById("report-table-wrapper");
const reportTableHead = document.getElementById("report-table-head");
const reportTableBody = document.getElementById("report-table-body");
const reportEmpty = document.getElementById("report-empty");

let reportData = null; // { dates: [...], topics: {date: topic}, matrix: { studentId: { date: true/false } } }

// Default range: last 30 days up to today
function defaultReportRange() {
  const to = todayString();
  const d = new Date();
  d.setDate(d.getDate() - 30);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  const from = local.toISOString().split("T")[0];
  return { from, to };
}

function initReportRange() {
  const { from, to } = defaultReportRange();
  reportFromInput.value = from;
  reportFromInput.max = todayString();
  reportToInput.value = to;
  reportToInput.max = todayString();
}

generateReportBtn.addEventListener("click", generateReport);
downloadCsvBtn.addEventListener("click", downloadCsv);

async function generateReport() {
  reportStatus.classList.remove("text-danger");
  reportStatus.textContent = "";
  reportTableWrapper.classList.add("d-none");
  reportEmpty.classList.add("d-none");
  downloadCsvBtn.disabled = true;
  reportData = null;

  if (!groupId) {
    reportStatus.classList.add("text-danger");
    reportStatus.textContent = "Group is not loaded yet.";
    return;
  }

  const fromDate = reportFromInput.value;
  const toDate = reportToInput.value;

  if (!fromDate || !toDate) {
    reportStatus.classList.add("text-danger");
    reportStatus.textContent = "Choose both a start and an end date.";
    return;
  }

  if (fromDate > toDate) {
    reportStatus.classList.add("text-danger");
    reportStatus.textContent = "The start date must be before the end date.";
    return;
  }

  generateReportBtn.disabled = true;
  reportSpinner.classList.remove("d-none");

  try {
    const snap = await db.collection("groups").doc(groupId)
      .collection("attendance")
      .where(firebase.firestore.FieldPath.documentId(), ">=", fromDate)
      .where(firebase.firestore.FieldPath.documentId(), "<=", toDate)
      .get();

    if (snap.empty) {
      reportEmpty.classList.remove("d-none");
      return;
    }

    const dates = [];
    const topics = {};
    const matrix = {};

    snap.docs
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach(doc => {
        const date = doc.id;
        const data = doc.data();
        dates.push(date);
        topics[date] = data.topic || "";
        const records = data.records || {};
        Object.keys(records).forEach(studentId => {
          if (!matrix[studentId]) matrix[studentId] = {};
          matrix[studentId][date] = records[studentId];
        });
      });

    reportData = { dates, topics, matrix };
    renderReportTable();
    downloadCsvBtn.disabled = false;

  } catch (err) {
    reportStatus.classList.add("text-danger");
    reportStatus.textContent = "Couldn't load the report: " + err.message;
  } finally {
    generateReportBtn.disabled = false;
    reportSpinner.classList.add("d-none");
  }
}

function renderReportTable() {
  const { dates, topics, matrix } = reportData;

  reportTableHead.innerHTML = "";

  const thName = document.createElement("th");
  thName.textContent = "Student";
  thName.className = "text-start";
  reportTableHead.appendChild(thName);

  dates.forEach(date => {
    const th = document.createElement("th");
    th.textContent = formatDateShort(date);
    if (topics[date]) th.title = topics[date];
    reportTableHead.appendChild(th);
  });

  const thTotal = document.createElement("th");
  thTotal.textContent = "Present";
  reportTableHead.appendChild(thTotal);

  reportTableBody.innerHTML = "";

  students.forEach(student => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = student.name;
    tdName.className = "text-start fw-medium";
    tr.appendChild(tdName);

    let presentCount = 0;
    let recordedCount = 0;

    dates.forEach(date => {
      const td = document.createElement("td");
      const value = matrix[student.id] ? matrix[student.id][date] : undefined;
      if (value === true) {
        td.innerHTML = '<span class="report-present">&#10003;</span>';
        presentCount++;
        recordedCount++;
      } else if (value === false) {
        td.innerHTML = '<span class="report-absent">&#10007;</span>';
        recordedCount++;
      } else {
        td.innerHTML = '<span class="report-none">&ndash;</span>';
      }
      tr.appendChild(td);
    });

    const tdTotal = document.createElement("td");
    tdTotal.className = "text-muted small";
    tdTotal.textContent = `${presentCount}/${recordedCount}`;
    tr.appendChild(tdTotal);

    reportTableBody.appendChild(tr);
  });

  reportTableWrapper.classList.remove("d-none");
}

function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}`;
}

// Excel's default list separator depends on the user's regional settings
// (e.g. Finnish/Russian locales use ';' because ',' is the decimal separator).
// Using ';' plus a leading "sep=;" directive makes the file open correctly
// as columns regardless of the reader's Excel locale.
const CSV_DELIMITER = ";";

function downloadCsv() {
  if (!reportData) return;
  const { dates, topics, matrix } = reportData;

  const header = ["Student", ...dates, "Present"];
  const topicRow = ["Topic", ...dates.map(date => topics[date] || ""), ""];
  const rows = [header, topicRow];

  students.forEach(student => {
    const row = [student.name];
    let presentCount = 0;
    let recordedCount = 0;

    dates.forEach(date => {
      const value = matrix[student.id] ? matrix[student.id][date] : undefined;
      if (value === true) {
        row.push("Present");
        presentCount++;
        recordedCount++;
      } else if (value === false) {
        row.push("Absent");
        recordedCount++;
      } else {
        row.push("");
      }
    });

    row.push(`${presentCount}/${recordedCount}`);
    rows.push(row);
  });

  const csvBody = rows.map(row => row.map(csvEscape).join(CSV_DELIMITER)).join("\r\n");
  const csvContent = "sep=" + CSV_DELIMITER + "\r\n" + csvBody;
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  const groupLabel = sanitizeFilename(groupNameEl && groupNameEl.textContent ? groupNameEl.textContent : "attendance");
  link.download = `attendance_${groupLabel}_${dates[0]}_${dates[dates.length - 1]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const str = String(value === undefined || value === null ? "" : value);
  if (new RegExp(`["\r\n${CSV_DELIMITER}]`).test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function sanitizeFilename(str) {
  const cleaned = str
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "attendance";
}

initReportRange();