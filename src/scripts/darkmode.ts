const html = document.documentElement;

document.addEventListener("DOMContentLoaded", () => {
  const darkmode = localStorage.getItem("darkmode");

  if (
    darkmode === "true" ||
    (darkmode === null &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    html.classList.add("dark");
    const darkmodeToggle: HTMLInputElement | null = document.querySelector(
      "#darkmode-toggle input",
    );
    if (darkmodeToggle) {
      darkmodeToggle.checked = true;
    }
  }
});

const darkmodeToggle = document.querySelector("#darkmode-toggle input");

if (darkmodeToggle) {
  darkmodeToggle.addEventListener("change", (event) => {
    if ((event.target as HTMLInputElement).checked) {
      html.classList.add("dark");
      localStorage.setItem("darkmode", "true");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("darkmode", "false");
    }
  });
}
