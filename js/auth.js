(() => {
  const signInForm = document.querySelector("#signInForm");
  const createForm = document.querySelector("#createForm");
  const tabs = [...document.querySelectorAll("[data-auth-tab]")];

  function selectForm(formName) {
    const create = formName === "create";
    signInForm.hidden = create;
    createForm.hidden = !create;
    tabs.forEach((tab) => {
      const selected = tab.dataset.authTab === formName;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
  }

  async function selectInitialForm() {
    const sessionResponse = await fetch("/api/me", {
      credentials: "same-origin",
    });
    if (sessionResponse.ok && (await sessionResponse.json()).user?.id) {
      window.location.replace("index.html");
      return;
    }
    const setupResponse = await fetch("/api/setup-status");
    if (!setupResponse.ok) return;
    const setup = await setupResponse.json();
    selectForm(setup.hasAccounts ? "sign-in" : "create");
  }

  selectInitialForm().catch(() => {});

  tabs.forEach((tab) =>
    tab.addEventListener("click", () => selectForm(tab.dataset.authTab)),
  );

  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(signInForm);
    const identity = String(data.get("identity") || "").trim();
    const password = String(data.get("password") || "");
    const error = signInForm.querySelector(".auth-error");
    error.textContent = "";
    document.querySelector("#signInNotice").hidden = true;
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity,
          password,
          remember: data.has("remember"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        error.textContent =
          result.error || "Incorrect username/email or password.";
        return;
      }
      window.location.assign("index.html");
    } catch {
      error.textContent =
        "Could not reach CookIT. Start the backend with npm start and try again.";
    }
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(createForm);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "")
      .trim()
      .toLowerCase();
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    const error = createForm.querySelector(".auth-error");
    error.textContent = "";
    if (password !== data.get("confirm")) {
      error.textContent = "Those passwords do not match.";
      return;
    }
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, username, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        error.textContent = result.error || "Could not create the account.";
        return;
      }
      createForm.reset();
      selectForm("sign-in");
      const identityField = signInForm.querySelector('[name="identity"]');
      identityField.value = username;
      signInForm.querySelector('[name="password"]').value = "";
      const notice = document.querySelector("#signInNotice");
      notice.textContent =
        "Account created. Sign in with your username and password.";
      notice.hidden = false;
      signInForm.querySelector('[name="password"]').focus();
    } catch {
      error.textContent =
        "Could not reach CookIT. Start the backend with npm start and try again.";
    }
  });
})();
