window.showSection = function (sectionId) {
  const publicPages = document.querySelectorAll(".page");
  publicPages.forEach(page => page.classList.add("hidden"));

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.remove("hidden");
  }
};

window.showStudentSection = function (sectionId) {
  const studentSections = document.querySelectorAll(".student-section");
  studentSections.forEach(section => section.classList.add("hidden"));

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.remove("hidden");
  }
};

window.showAdminSection = function (sectionId) {
  const adminSections = document.querySelectorAll(".admin-section");
  adminSections.forEach(section => section.classList.add("hidden"));

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.remove("hidden");
  }
};