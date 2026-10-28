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

// Desktop header: switches from the cream logo over the hero photo to the dark logo on white as
// soon as the page scrolls, because the photo slides away immediately.
(() => {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const update = () => header.toggleAttribute("data-scrolled", window.scrollY > 24);
  update();
  window.addEventListener("scroll", update, { passive: true });
})();

// Form dialogs: a link with data-dialog="<id>" opens that <dialog> on the home page. Without JS
// (or without <dialog> support) the link opens the form page. [data-close] links and the backdrop close it.
// The form inside gets "wizard:open" with the link's data-intent (see js/forms.js).
(() => {
  document.querySelectorAll("a[data-dialog]").forEach((link) => {
    const dialog = document.getElementById(link.dataset.dialog);
    if (!dialog || typeof dialog.showModal !== "function") return;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      dialog.querySelector("form[data-wizard]")?.dispatchEvent(new CustomEvent("wizard:open", { detail: { intent: link.dataset.intent } }));
      dialog.showModal();
    });
  });
  // Backdrop: only a click outside the dialog's box closes it. Clicks on the dialog's own empty
  // area (e.g. below the form on a full-screen phone dialog) also target the <dialog>, so check the position.
  const outside = (dialog, e) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  document.querySelectorAll("dialog.form-dialog").forEach((dialog) => {
    dialog.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) { e.preventDefault(); dialog.close(); }
      else if (e.target === dialog && outside(dialog, e)) dialog.close();
    });
  });
})();

// Tabs (property alert regions): one panel at a time. Without JS the tab list stays hidden and every panel shows.
(() => {
  document.querySelectorAll("[data-tabs]").forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    const select = (i, focus) => {
      tabs.forEach((t, n) => {
        t.setAttribute("aria-selected", String(n === i));
        t.tabIndex = n === i ? 0 : -1;
        panels[n].hidden = n !== i;
      });
      if (focus) tabs[i].focus();
    };
    list.addEventListener("click", (e) => {
      const i = tabs.indexOf(e.target.closest('[role="tab"]'));
      if (i >= 0) select(i, false);
    });
    list.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      select((tabs.indexOf(document.activeElement) + step + tabs.length) % tabs.length, true);
    });
    list.hidden = false;
    list.parentElement.setAttribute("data-tabs-active", "");
    select(0, false);
  });
})();
