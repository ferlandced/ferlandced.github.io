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

// Home page blocks fade in and rise into place as their section arrives, on a timer like Apple's
// product pages, and then stay. Blocks side by side (Services columns, a row of cards) appear
// together, and each row starts a step after the previous one. Without JS or with reduced motion
// everything just shows (see [data-reveal] in site.css).
(() => {
  const STEP_MS = 150;
  const stacks = ".about__body, .service";
  const singles = "#services-heading, #properties-heading, .properties .card, .properties .container > p";

  const groups = [...document.querySelectorAll(`${stacks}, ${singles}`)];
  if (!groups.length) return;
  if (!("IntersectionObserver" in window)) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const itemsOf = (group) => (group.matches(stacks) ? [...group.children] : [group]);

  for (const group of groups) {
    for (const item of itemsOf(group)) item.setAttribute("data-reveal", "");
  }

  const show = (item, delayMs) => {
    item.style.setProperty("--reveal-delay", `${Math.round(delayMs)}ms`);
    item.dataset.reveal = "in";
  };

  const sameRow = (a, b) => Math.abs(a.boundingClientRect.top - b.boundingClientRect.top) < 4;

  // Start time of the last block scheduled, so a row that arrives just after another waits its turn
  let lastStart = -Infinity;

  const observer = new IntersectionObserver((entries) => {
    const arriving = [];
    for (const entry of entries) {
      const alreadyPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      if (alreadyPassed) {
        itemsOf(entry.target).forEach((item) => show(item, 0));
        observer.unobserve(entry.target);
      } else if (entry.isIntersecting) {
        arriving.push(entry);
      }
    }
    arriving.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

    const rows = [];
    for (const entry of arriving) {
      const row = rows.at(-1);
      if (row && sameRow(row[0], entry)) row.push(entry);
      else rows.push([entry]);
    }

    const now = performance.now();
    for (const row of rows) {
      const start = Math.max(now, lastStart + STEP_MS);
      let longest = 1;
      for (const { target } of row) {
        const items = itemsOf(target);
        items.forEach((item, i) => show(item, start - now + i * STEP_MS));
        longest = Math.max(longest, items.length);
        observer.unobserve(target);
      }
      lastStart = start + (longest - 1) * STEP_MS;
    }
  }, { rootMargin: "0px 0px -30% 0px" });

  groups.forEach((group) => observer.observe(group));
})();

// The header is past the hero once About reaches it: from there it is white, with the dark logo and
// the contact icons. On desktop the hero holds still under About, so this follows About, not the hero.
(() => {
  const header = document.querySelector(".site-header");
  const next = document.querySelector(".hero ~ section");
  if (!header || !next) return;
  const update = () => header.toggleAttribute("data-past-hero", next.getBoundingClientRect().top <= header.offsetHeight);
  update();
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
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
      link.closest("dialog")?.close();
      link.focus({ preventScroll: true });   // Safari does not focus links on click, and the dialog returns focus here
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

// "More info" on a property card: one shared dialog, filled from the clicked button.
(() => {
  const dialog = document.getElementById("dialog-propertyInfo");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const form = dialog.querySelector("form[data-wizard]");
  document.querySelectorAll("[data-property-info]").forEach((button) => {
    button.addEventListener("click", () => {
      form.dispatchEvent(new CustomEvent("wizard:open"));
      form.elements.listing_number.value = button.dataset.listingNumber;
      form.elements.property_address.value = button.dataset.propertyAddress;
      form.elements.subject.value = button.dataset.subject;
      dialog.querySelector("[data-property-label]").textContent = button.dataset.propertyLabel;
      button.focus({ preventScroll: true });
      dialog.showModal();
    });
  });
})();

// Copy buttons: shown only where the clipboard is available. CSS hides them on touch screens, which can call.
(() => {
  if (!navigator.clipboard) return;
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.hidden = false;
    const label = button.querySelector("[aria-live]");
    const original = label.textContent;
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(button.dataset.copy);
      label.textContent = button.dataset.copied;
      setTimeout(() => { label.textContent = original; }, 2500);
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
