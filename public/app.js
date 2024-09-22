document.addEventListener("DOMContentLoaded", () => {
  const darkmode = localStorage.getItem("darkmode");

  if (
    darkmode === "true" ||
    (darkmode === null &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.body.classList.add("dark");
    document.querySelector("#darkmode-toggle input").checked = true;
  }
});

const darkmodeToggle = document.querySelector("#darkmode-toggle input");

if (darkmodeToggle) {
  darkmodeToggle.addEventListener("change", (event) => {
    if (event.target.checked) {
      document.body.classList.add("dark");
      localStorage.setItem("darkmode", "true");
    } else {
      document.body.classList.remove("dark");
      localStorage.setItem("darkmode", "false");
    }
  });
}
