document
  .getElementById("loginForm")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector("button"),
      errorBox = document.getElementById("errorBox");
    button.disabled = true;
    errorBox.hidden = true;
    try {
      const { user } = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      location.assign(
        user.role === "Editor"
          ? "/editor/articles"
          : user.role === "Reporter"
            ? "/reporter/articles"
            : "/",
      );
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      button.disabled = false;
    }
  });
