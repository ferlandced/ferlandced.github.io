// Burger menu below the desktop breakpoint. Without JS the nav stays visible (see .js-nav in site.css).
(() => {
  const root = document.querySelector<HTMLElement>("[data-nav-root]");
  const toggle = root?.querySelector<HTMLButtonElement>(".nav-toggle");
  const label = toggle?.querySelector(".visually-hidden");
  if (!root || !toggle || !label) {
    return;
  }
  document.documentElement.classList.add("js-nav");

  const setOpen = (open: boolean) => {
    root.toggleAttribute("data-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    label.textContent = (open ? toggle.dataset.labelClose : toggle.dataset.labelOpen) ?? "";
  };

  toggle.addEventListener("click", () => {
    setOpen(!root.hasAttribute("data-open"));
  });
  root.querySelectorAll(".site-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      setOpen(false);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.hasAttribute("data-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
})();

// Home page blocks fade in and rise into place as their section arrives, on a timer like Apple's
// product pages, and then stay. Blocks side by side (a row of cards) appear together, and each row
// starts a step after the previous one. About is driven by the scroll instead (css/site.css, Motion).
// Without JS or with reduced motion everything just shows (see [data-reveal] in site.css).
(() => {
  const STEP_MS = 150;
  const stacks = ".service__content";
  const singles =
    "#services-heading, #properties-heading, .properties .card, .properties .container > p";

  const groups = [...document.querySelectorAll<HTMLElement>(`${stacks}, ${singles}`)];
  if (!groups.length) {
    return;
  }
  if (!("IntersectionObserver" in window)) {
    return;
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const itemsOf = (group: Element): HTMLElement[] => {
    if (group.matches(stacks)) {
      return [...group.children].filter((child) => child instanceof HTMLElement);
    }
    return group instanceof HTMLElement ? [group] : [];
  };

  for (const group of groups) {
    for (const item of itemsOf(group)) {
      item.setAttribute("data-reveal", "");
    }
  }

  const show = (item: HTMLElement, delayMs: number) => {
    item.style.setProperty("--reveal-delay", `${Math.round(delayMs)}ms`);
    item.dataset.reveal = "in";
  };

  const sameRow = (first: IntersectionObserverEntry, second: IntersectionObserverEntry) =>
    Math.abs(first.boundingClientRect.top - second.boundingClientRect.top) < 4;

  // Start time of the last block scheduled, so a row that arrives just after another waits its turn
  let lastStart = -Infinity;

  const observer = new IntersectionObserver(
    (entries) => {
      const arriving: IntersectionObserverEntry[] = [];
      for (const entry of entries) {
        const alreadyPassed = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        if (alreadyPassed) {
          itemsOf(entry.target).forEach((item) => {
            show(item, 0);
          });
          observer.unobserve(entry.target);
        } else if (entry.isIntersecting) {
          arriving.push(entry);
        }
      }
      arriving.sort(
        (first, second) => first.boundingClientRect.top - second.boundingClientRect.top,
      );

      const rows: IntersectionObserverEntry[][] = [];
      for (const entry of arriving) {
        const row = rows.at(-1);
        const rowStart = row?.[0];
        if (row && rowStart && sameRow(rowStart, entry)) {
          row.push(entry);
        } else {
          rows.push([entry]);
        }
      }

      const now = performance.now();
      for (const row of rows) {
        const start = Math.max(now, lastStart + STEP_MS);
        let longest = 1;
        for (const { target } of row) {
          const items = itemsOf(target);
          items.forEach((item, index) => {
            show(item, start - now + index * STEP_MS);
          });
          longest = Math.max(longest, items.length);
          observer.unobserve(target);
        }
        lastStart = start + (longest - 1) * STEP_MS;
      }
    },
    { rootMargin: "0px 0px -30% 0px" },
  );

  groups.forEach((group) => {
    observer.observe(group);
  });
})();

// The header is past the hero once About reaches it: from there it is white, with the dark logo and
// the contact icons. On desktop the hero holds still under About, so this follows About, not the hero.
(() => {
  const header = document.querySelector<HTMLElement>(".site-header");
  const next = document.querySelector(".hero ~ section");
  if (!header || !next) {
    return;
  }
  const update = () =>
    header.toggleAttribute(
      "data-past-hero",
      next.getBoundingClientRect().top <= header.offsetHeight,
    );
  update();
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
})();

// Form dialogs: a link with data-dialog="<id>" opens that <dialog> on the home page. Without JS
// (or without <dialog> support) the link opens the form page. [data-close] links and the backdrop close it.
// The form inside gets "wizard:open" with the link's data-intent (see js/forms.ts).
(() => {
  document.querySelectorAll<HTMLAnchorElement>("a[data-dialog]").forEach((link) => {
    const dialog = document.getElementById(link.dataset.dialog ?? "");
    if (!(dialog instanceof HTMLDialogElement) || typeof dialog.showModal !== "function") {
      return;
    }
    link.addEventListener("click", (event) => {
      event.preventDefault();
      link.closest("dialog")?.close();
      link.focus({ preventScroll: true }); // Safari does not focus links on click, and the dialog returns focus here
      dialog
        .querySelector("form[data-wizard]")
        ?.dispatchEvent(
          new CustomEvent("wizard:open", { detail: { intent: link.dataset.intent } }),
        );
      dialog.showModal();
    });
  });
  // Backdrop: only a click outside the dialog's box closes it. Clicks on the dialog's own empty
  // area (e.g. below the form on a full-screen phone dialog) also target the <dialog>, so check the position.
  const outside = (dialog: HTMLDialogElement, event: MouseEvent) => {
    const bounds = dialog.getBoundingClientRect();
    return (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );
  };
  document.querySelectorAll<HTMLDialogElement>("dialog.form-dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("[data-close]")) {
        event.preventDefault();
        dialog.close();
      } else if (event.target === dialog && outside(dialog, event)) {
        dialog.close();
      }
    });
  });
})();

// "More info" on a property card: one shared dialog, filled from the clicked button.
(() => {
  const dialog = document.getElementById("dialog-propertyInfo");
  if (!(dialog instanceof HTMLDialogElement) || typeof dialog.showModal !== "function") {
    return;
  }
  const form = dialog.querySelector<HTMLFormElement>("form[data-wizard]");
  const propertyLabel = dialog.querySelector("[data-property-label]");
  if (!form || !propertyLabel) {
    return;
  }
  const setField = (name: string, value = "") => {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement) {
      field.value = value;
    }
  };
  document.querySelectorAll<HTMLButtonElement>("[data-property-info]").forEach((button) => {
    button.addEventListener("click", () => {
      form.dispatchEvent(new CustomEvent("wizard:open"));
      setField("listing_number", button.dataset.listingNumber);
      setField("property_address", button.dataset.propertyAddress);
      setField("subject", button.dataset.subject);
      propertyLabel.textContent = button.dataset.propertyLabel ?? "";
      button.focus({ preventScroll: true });
      dialog.showModal();
    });
  });
})();

// Copy buttons: shown only where the clipboard is available. CSS hides them on touch screens, which can call.
(() => {
  if (!("clipboard" in navigator)) {
    return;
  }
  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
    const label = button.querySelector("[aria-live]");
    if (!label) {
      return;
    }
    button.hidden = false;
    const original = label.textContent;
    const copy = async () => {
      await navigator.clipboard.writeText(button.dataset.copy ?? "");
      label.textContent = button.dataset.copied ?? "";
      setTimeout(() => {
        label.textContent = original;
      }, 2500);
    };
    button.addEventListener("click", () => {
      void copy();
    });
  });
})();

// Tabs (property alert regions): one panel at a time. Without JS the tab list stays hidden and every panel shows.
(() => {
  document.querySelectorAll<HTMLElement>("[data-tabs]").forEach((list) => {
    const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
    const panels = tabs.map((tab) =>
      document.getElementById(tab.getAttribute("aria-controls") ?? ""),
    );
    const select = (index: number, focus: boolean) => {
      tabs.forEach((tab, position) => {
        tab.setAttribute("aria-selected", String(position === index));
        tab.tabIndex = position === index ? 0 : -1;
        const panel = panels[position];
        if (panel) {
          panel.hidden = position !== index;
        }
      });
      if (focus) {
        tabs[index]?.focus();
      }
    };
    list.addEventListener("click", (event) => {
      const tab =
        event.target instanceof Element ? event.target.closest<HTMLElement>('[role="tab"]') : null;
      const index = tab ? tabs.indexOf(tab) : -1;
      if (index >= 0) {
        select(index, false);
      }
    });
    const steps: Partial<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };
    list.addEventListener("keydown", (event) => {
      const step = steps[event.key];
      if (!step) {
        return;
      }
      event.preventDefault();
      const current =
        document.activeElement instanceof HTMLElement ? tabs.indexOf(document.activeElement) : -1;
      select((current + step + tabs.length) % tabs.length, true);
    });
    list.hidden = false;
    list.parentElement?.setAttribute("data-tabs-active", "");
    select(0, false);
  });
})();
