try {
  if (!localStorage.selectedTheme && !localStorage.manualDefault) {
    localStorage.selectedTheme = "dark";
    localStorage.rchan_warmdark = "1";
  }
  if (localStorage.selectedTheme === "dark") {
    document.documentElement.className += localStorage.rchan_warmdark === "1" ? " predark rchan-warmdark" : " predark";
  }
} catch (e) {}
