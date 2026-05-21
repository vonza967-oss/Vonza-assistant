/* global document */

(function () {
  const copyableCodes = document.querySelectorAll(".vonza-front-desk-card code");

  copyableCodes.forEach((code) => {
    code.setAttribute("tabindex", "0");
    code.setAttribute("role", "textbox");
    code.setAttribute("aria-readonly", "true");
  });
})();
