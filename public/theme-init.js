(function () {
  try {
    var tm = {
      light: [0, "#ffffff"],
      sepia: [0, "#fdfaf3"],
      sage: [0, "#fafdf8"],
      breeze: [0, "#fbfdff"],
      dark: [1, "#0f172a"],
      forest: [1, "#0b1f16"],
      ocean: [1, "#0a192f"],
      dusk: [1, "#181024"],
      amoled: [1, "#000000"],
    };
    var ac = { "sk-green": 1, blue: 1, teal: 1, violet: 1, amber: 1, rose: 1 };
    var t = localStorage.getItem("sk_tocok_theme");
    var a = localStorage.getItem("sk_tocok_accent");
    var s =
      t && tm[t]
        ? t
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    var acc = a && ac[a] ? a : "sk-green";
    var isD = tm[s][0] === 1;
    var r = document.documentElement;
    r.dataset.theme = s;
    r.dataset.accent = acc;
    r.classList.toggle("dark", isD);
    r.style.colorScheme = isD ? "dark" : "light";
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) {
      m = document.createElement("meta");
      m.name = "theme-color";
      document.head.appendChild(m);
    }
    m.content = tm[s][1];
  } catch (e) {}
})();
