let currentUser = null;
let groupId = null;
let students = []; // [{ id, name }]

const loadingBlock = document.getElementById("loading-block");
const noGroupBlock = document.getElementById("no-group-block");
const mainBlock = document.getElementById("main-block");

const groupNameEl = document.getElementById("group-name");
const teacherEmailEl = document.getElementById("teacher-email");
const dateInput = document.getElementById("lesson-date");
const topicInput = document.getElementById("lesson-topic");
const studentsList = document.getElementById("students-list");
const emptyStudents = document.getElementById("empty-students");
const saveBtn = document.getElementById("save-btn");
const saveSpinner = document.getElementById("save-spinner");
const saveStatus = document.getElementById("save-status");

// Авторизация
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  teacherEmailEl.textContent = user.email;
  await loadTeacherGroup();
});

document.getElementById("logout-btn").addEventListener("click", () => {
  auth.signOut();
});

// Загружаем группу и учеников, привязанных к этому учителю
async function loadTeacherGroup() {
  try {
    const teacherDoc = await db.collection("teachers").doc(currentUser.uid).get();

    if (!teacherDoc.exists || !teacherDoc.data().groupId) {
      loadingBlock.classList.add("d-none");
      noGroupBlock.classList.remove("d-none");
      return;
    }

    groupId = teacherDoc.data().groupId;

    const groupDoc = await db.collection("groups").doc(groupId).get();
    groupNameEl.textContent = groupDoc.exists ? (groupDoc.data().name || groupId) : groupId;

    const studentsSnap = await db.collection("groups").doc(groupId)
      .collection("students").orderBy("name").get();

    students = studentsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

    loadingBlock.classList.add("d-none");
    mainBlock.classList.remove("d-none");
    initDatePicker();

    if (students.length === 0) {
      emptyStudents.classList.remove("d-none");
      saveBtn.disabled = true;
    } else {
      renderStudents({});
      await loadAttendanceForDate(dateInput.value);
    }

  } catch (err) {
    loadingBlock.classList.add("d-none");
    showFatalError("Не удалось загрузить данные группы: " + err.message);
  }
}

function showFatalError(message) {
  const div = document.createElement("div");
  div.className = "alert alert-danger";
  div.textContent = message;
  document.querySelector(".container.py-4").prepend(div);
}

// Дата занятия
function todayString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function initDatePicker() {
  dateInput.value = todayString();
  dateInput.max = todayString();
  dateInput.addEventListener("change", async () => {
    await loadAttendanceForDate(dateInput.value);
  });
}

// Отрисовка списка учеников
// attendanceMap: { studentId: true/false }, по умолчанию — все "были"

function renderStudents(attendanceMap) {
  studentsList.innerHTML = "";

  students.forEach(student => {
    const isPresent = attendanceMap.hasOwnProperty(student.id) ? attendanceMap[student.id] : true;

    const row = document.createElement("label");
    row.className = "list-group-item d-flex align-items-center justify-content-between student-row";
    row.innerHTML = `
      <span class="student-name">${escapeHtml(student.name)}</span>
      <div class="form-check form-switch mb-0">
        <input class="form-check-input student-checkbox" type="checkbox" data-student-id="${student.id}" ${isPresent ? "checked" : ""}>
      </div>
    `;
    studentsList.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Загрузка уже сохранённой посещаемости за выбранную дату (если есть)

async function loadAttendanceForDate(dateStr) {
  saveStatus.textContent = "";
  topicInput.value = "";

  try {
    const docSnap = await db.collection("groups").doc(groupId)
      .collection("attendance").doc(dateStr).get();

    if (docSnap.exists) {
      const data = docSnap.data();
      topicInput.value = data.topic || "";
      renderStudents(data.records || {});
      saveStatus.textContent = "Ранее уже сохранено для этой даты — можно отредактировать.";
    } else {
      renderStudents({});
    }
  } catch (err) {
    showFatalError("Не удалось загрузить посещаемость за эту дату: " + err.message);
  }
}

// Кнопки "Все были" / "Все отсутствовали"

document.getElementById("mark-all-present").addEventListener("click", () => {
  document.querySelectorAll(".student-checkbox").forEach(cb => cb.checked = true);
});
document.getElementById("mark-all-absent").addEventListener("click", () => {
  document.querySelectorAll(".student-checkbox").forEach(cb => cb.checked = false);
});

// Сохранение

saveBtn.addEventListener("click", async () => {
  const dateStr = dateInput.value;
  if (!dateStr) {
    saveStatus.textContent = "Выберите дату занятия.";
    saveStatus.classList.add("text-danger");
    return;
  }

  const records = {};
  document.querySelectorAll(".student-checkbox").forEach(cb => {
    records[cb.dataset.studentId] = cb.checked;
  });

  saveBtn.disabled = true;
  saveSpinner.classList.remove("d-none");
  saveStatus.classList.remove("text-danger");
  saveStatus.textContent = "";

  try {
    await db.collection("groups").doc(groupId)
      .collection("attendance").doc(dateStr).set({
        topic: topicInput.value.trim(),
        records: records,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.email
      }, { merge: true });

    saveStatus.textContent = "Сохранено ✓";
  } catch (err) {
    saveStatus.classList.add("text-danger");
    saveStatus.textContent = "Ошибка сохранения: " + err.message;
  } finally {
    saveBtn.disabled = false;
    saveSpinner.classList.add("d-none");
  }
});
