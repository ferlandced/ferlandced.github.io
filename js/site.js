// Burger menu below the desktop breakpoint. Without JS the nav stays visible (see .js-nav in site.css).
(() => {
  const root = document.querySelector("[data-nav-root]");
  const toggle = root && root.querySelector(".nav-toggle");
  if (!toggle) return;
  document.documentElement.classList.add("js-nav");
  const label = toggle.querySelector(".visually-hidden");

  const setOpen = (open) => {
    root.toggleAttribute("data-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    label.textContent = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
  };

  toggle.addEventListener("click", () => setOpen(!root.hasAttribute("data-open")));
  root.querySelectorAll(".site-nav a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.hasAttribute("data-open")) { setOpen(false); toggle.focus(); }
  });
})();

// Contact form: an email or a phone number is required, at least one of the two.
(() => {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;
  const email = form.elements.email, phone = form.elements.phone;
  const check = () => email.setCustomValidity(email.value.trim() || phone.value.trim() ? "" : form.dataset.eitherMessage);
  [email, phone].forEach((el) => el.addEventListener("input", check));
  check();
})();

// Header contact icons appear once the hero has scrolled out from under the header.
(() => {
  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".hero");
  if (!header || !hero || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(([entry]) => {
    header.toggleAttribute("data-past-hero", !entry.isIntersecting && entry.boundingClientRect.top < 0);
  }, { rootMargin: `-${header.offsetHeight}px 0px 0px 0px` });
  io.observe(hero);
})();
