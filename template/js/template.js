// ===== MENU DO USUÁRIO (HEADER) =====
const userBtn = document.getElementById("userBtn");
const menuUser = document.getElementById("menuUser");

if (userBtn && menuUser) {
  userBtn.addEventListener("click", () => {
    menuUser.style.display =
      menuUser.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (!document.querySelector(".user-icon").contains(e.target)) {
      menuUser.style.display = "none";
    }
  });
}

// ===== MENU LATERAL (SIDEBAR) =====
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (menuToggle && sidebar && sidebarOverlay) {
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
    document.body.classList.toggle('sidebar-locked');
  });

  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
    document.body.classList.remove('sidebar-locked');
  });
}
