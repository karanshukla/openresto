(function () {
  try {
    var s = localStorage.getItem("openresto-theme");
    var d =
      s === "light" || s === "dark"
        ? s
        : window.matchMedia && window.matchMedia("(prefers-color-scheme:dark)").matches
          ? "dark"
          : "light";
    document.documentElement.classList.add(d);
    document.documentElement.style.backgroundColor = d === "dark" ? "#111214" : "#f2f3f5";
  } catch (e) {}
})();
