// Если человек уже вошёл — сразу отправляем на страницу с группой
auth.onAuthStateChanged((user) => {
  if (user) {
    window.location.href = "app.html";
  }
});

const form = document.getElementById("login-form");
const errorBox = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");
const loginBtnText = document.getElementById("login-btn-text");
const loginSpinner = document.getElementById("login-spinner");

function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  loginSpinner.classList.toggle("d-none", !isLoading);
  loginBtnText.textContent = isLoading ? "Logging in..." : "Login";
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("d-none");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.add("d-none");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  setLoading(true);
  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.href = "app.html";
  } catch (err) {
    setLoading(false);
    if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
      showError("Wrong email or password.");
    } else if (err.code === "auth/too-many-requests") {
      showError("Too many attempts. Try again later.");
    } else {
      showError("Couldn't log in: " + err.message);
    }
  }
});
