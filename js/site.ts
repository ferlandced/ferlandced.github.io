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
// starts a step after the previous one. About has its own sequence (About story, below).
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

// About story. About holds on screen while the visitor scrolls a few short steps (css/site.css,
// About story). The photo always changes on a timer: reaching a part starts its wipe, which then
// plays on its own, one change at a time. Part 1 brings the paramedic, who then stays at least
// PARAMEDIC_SHOWN_MS; part 2 brings the agent back; part 3, a step later, the link and contact.
// Pinned (phones and desktop): the text follows the scroll itself, forwards and back, so it is there
// however fast the visitor scrolls; on phones the blur overlay too. The photo follows where the
// scroll is. Short screens, not pinned: each part's text plays on a timer with its photo, one after
// the other. The state lives on .stage, which also holds the desktop's pinned copy of the photo. Without JS or with reduced motion, all of it shows.
(() => {
  const FIRST_PART_DELAY_MS = 150; // part 1 right after the title
  const PHOTO_CHANGE_MS = 900; // the wipe's transition in site.css
  const PARAMEDIC_SHOWN_MS = 2000; // once in, he stays at least this long before the agent returns
  const STEP_MS = 400;
  const LAST_PART = 3;
  // The pinned layouts in css/site.css (About story)
  const PINNED = "(height >= 600px)";
  const PINNED_PHONE = `(width <= 767.98px) and ${PINNED}`;

  const stage = document.querySelector<HTMLElement>(".stage");
  const about = stage?.querySelector<HTMLElement>(".about");
  if (!stage || !about) {
    return;
  }
  if (!("IntersectionObserver" in window && "ResizeObserver" in window)) {
    return;
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const steps = [...about.querySelectorAll<HTMLElement>(".about__step")];
  const triggers = [...about.querySelectorAll<HTMLElement>("[data-story-trigger]")];
  const stepsOfPart = (part: number) =>
    steps.filter((step) => step.dataset.storyPart === String(part));
  const title = steps.find((step) => !step.dataset.storyPart);

  // Applies a state at once, without transitions from the one before (e.g. the no-JS one, seen
  // after a reload in the middle of the page)
  const applyInstantly = (apply: () => void) => {
    stage.toggleAttribute("data-story-instant", true);
    apply();
    stage.getBoundingClientRect(); // applies the styles before transitions come back
    stage.toggleAttribute("data-story-instant", false);
  };

  const show = (step: HTMLElement, delayMs: number) => {
    step.style.setProperty("--reveal-delay", `${delayMs}ms`);
    step.dataset.reveal = "in";
  };

  const showAll = () => {
    stage.toggleAttribute("data-story-scroll", false);
    stage.dataset.story = "done";
    for (const step of steps) {
      show(step, 0);
    }
  };

  const progress = (position: number, from: number, to: number) =>
    Math.min(1, Math.max(0, (position - from) / (to - from)));

  // Where the scroll is, in steps from where About pins (0). One step is the scroll between the
  // first two triggers.
  const stepSize = () => (triggers[1]?.offsetTop ?? 0) - (triggers[0]?.offsetTop ?? 0);
  const position = () => -about.getBoundingClientRect().top / Math.max(1, stepSize());

  // Pinned layouts. Where each block plays, in steps of scroll from where About pins (0) to where it
  // moves on (4): the title as About settles, each paragraph over most of its step, then, after a
  // pause to read, the link and the contact. On phones the overlay rises with each paragraph; its
  // white base comes in with the link and contact.
  // Each value goes from 0 to 1 (css/site.css, About story). Each part's photo change starts as its
  // text starts to show (on phones, once its first line is in), so the photo matches what is being
  // read. Returns a function that stops it.
  const followScroll = () => {
    const [firstText] = stepsOfPart(1);
    const [secondText] = stepsOfPart(2);
    const [link, contact] = stepsOfPart(3);
    const firstPart = { step: firstText, from: 0, to: 0.8 };
    const secondPart = { step: secondText, from: 1, to: 1.8 };
    const blocks = [
      { step: title, from: -0.5, to: 0 },
      firstPart,
      secondPart,
      { step: link, from: 2.4, to: 2.7 },
      { step: contact, from: 2.7, to: 3 },
    ];
    const overlay = [
      { property: "--overlay-first", from: 0, to: 0.8 },
      { property: "--overlay-second", from: 1, to: 1.8 },
      { property: "--overlay-base", from: 2.4, to: 3 },
    ];
    const photos = ["start", "paramedic", "agent"];

    // On phones a block grows from the top, so its first line is in once it is one line tall: that
    // share of its full height, measured below. Until measured, the whole text. On desktop the
    // whole block fades in at once.
    const growsLineByLine = matchMedia(PINNED_PHONE).matches;
    const firstLineShares = new Map<Element, number>();
    const firstLineIn = ({ step, from, to }: typeof firstPart) => {
      if (!growsLineByLine) {
        return from;
      }
      const text = step?.firstElementChild;
      const share = (text && firstLineShares.get(text)) ?? 1;
      return from + share * (to - from);
    };

    const onScreen = () => {
      const bounds = about.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < innerHeight;
    };

    // The photo goes one change at a time towards the one for where the scroll is, the paramedic
    // held for his minimum time. Out of sight (e.g. opened at #services), it goes there at once.
    let wantedPhoto = 0;
    let shownPhoto = -1;
    let photoTimer: ReturnType<typeof setTimeout> | undefined;
    const changePhoto = () => {
      if (photoTimer !== undefined || shownPhoto === wantedPhoto) {
        return;
      }
      if (shownPhoto < 0 || !onScreen()) {
        shownPhoto = wantedPhoto;
        applyInstantly(() => {
          stage.dataset.story = photos[shownPhoto];
        });
        return;
      }
      shownPhoto += Math.sign(wantedPhoto - shownPhoto);
      stage.dataset.story = photos[shownPhoto];
      const holdMs = photos[shownPhoto] === "paramedic" ? PARAMEDIC_SHOWN_MS : 0;
      photoTimer = setTimeout(() => {
        photoTimer = undefined;
        changePhoto();
      }, PHOTO_CHANGE_MS + holdMs);
    };

    const update = () => {
      const now = position();
      for (const { step, from, to } of blocks) {
        const shown = progress(now, from, to);
        step?.style.setProperty("--story-progress", String(shown));
        step?.toggleAttribute("data-story-shown", shown === 1);
      }
      for (const { property, from, to } of overlay) {
        stage.style.setProperty(property, String(progress(now, from, to)));
      }
      wantedPhoto = [firstPart, secondPart].filter((part) => now >= firstLineIn(part)).length;
      changePhoto();
    };

    let frame = 0;
    const requestUpdate = () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    // Each block of text takes its height as it comes in, so its full height is measured
    const heights = new ResizeObserver((entries) => {
      for (const { target, borderBoxSize } of entries) {
        const height = borderBoxSize[0]?.blockSize ?? target.getBoundingClientRect().height;
        target.parentElement?.style.setProperty("--step-height", `${height}px`);
        const lineHeight = Number.parseFloat(getComputedStyle(target).lineHeight);
        if (height > 0 && lineHeight > 0) {
          firstLineShares.set(target, Math.min(1, lineHeight / height));
        }
      }
      requestUpdate();
    });
    for (const step of about.querySelectorAll(".about__stack .about__step > *")) {
      heights.observe(step);
    }

    stage.toggleAttribute("data-story-scroll", true);
    update();
    const listening = new AbortController();
    addEventListener("scroll", requestUpdate, { passive: true, signal: listening.signal });
    addEventListener("resize", requestUpdate, { signal: listening.signal });

    return () => {
      listening.abort();
      heights.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(photoTimer);
    };
  };

  // Short screens, not pinned. Returns a function that stops it.
  const playOnTimers = () => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (callback: () => void, delayMs: number) => {
      timers.push(setTimeout(callback, delayMs));
    };

    applyInstantly(() => {
      stage.dataset.story = "start";
      for (const step of steps) {
        step.setAttribute("data-reveal", "");
      }
    });

    // Part 1: its text and the paramedic. Part 2: its text and the agent back. Part 3, once his
    // photo has settled: the link and contact, one after the other.
    const playPart = (part: number) => {
      const blocks = stepsOfPart(part);
      if (part < LAST_PART) {
        stage.dataset.story = part === 1 ? "paramedic" : "agent";
      } else {
        stage.dataset.story = "done";
      }
      blocks.forEach((step, index) => {
        show(step, index * STEP_MS);
      });
    };

    let partsStarted = 0;
    let nextFreeAt = 0;
    const playUpTo = (lastPart: number) => {
      if (title) {
        show(title, 0);
      }
      while (partsStarted < lastPart) {
        partsStarted += 1;
        const part = partsStarted;
        const now = performance.now();
        const earliest = part === 1 ? now + FIRST_PART_DELAY_MS : now;
        const start = Math.max(earliest, nextFreeAt);
        nextFreeAt = start + PHOTO_CHANGE_MS + (part === 1 ? PARAMEDIC_SHOWN_MS : STEP_MS);
        later(() => {
          playPart(part);
        }, start - now);
      }
    };

    // A trigger fires when it reaches the top of the screen: the first one as About pins, bringing
    // the title and part 1. Each one runs to the end of About, so it cannot be scrolled past between
    // two checks. Already above on load (e.g. opened at #services): everything shows at once.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const part = Number(entry.target.getAttribute("data-story-trigger"));
          if (entry.isIntersecting) {
            playUpTo(part);
            observer.unobserve(entry.target);
          } else if (entry.boundingClientRect.top < 0 && partsStarted === 0) {
            partsStarted = LAST_PART;
            showAll();
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: "0px 0px -99% 0px" },
    );
    triggers.forEach((trigger) => {
      observer.observe(trigger);
    });

    return () => {
      observer.disconnect();
      timers.forEach((timer) => {
        clearTimeout(timer);
      });
    };
  };

  // Crossing between layouts (a phone turned, a window resized) ends the story: all shows
  const pinnedPhone = matchMedia(PINNED_PHONE);
  const pinned = matchMedia(PINNED);
  const stop = pinned.matches ? followScroll() : playOnTimers();
  const layoutChanged = new AbortController();
  for (const layout of [pinnedPhone, pinned]) {
    layout.addEventListener(
      "change",
      () => {
        layoutChanged.abort();
        stop();
        showAll();
      },
      { signal: layoutChanged.signal },
    );
  }
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

// iPhones: the page has a runway at each end (--top-runway, --footer-runway, css/site.css). It opens
// past the top one, and whenever it comes to rest inside one it glides back out, so Safari keeps
// showing the page under the status bar and the toolbar.
(() => {
  const rootStyle = getComputedStyle(document.documentElement);
  const runway = (name: string) => Number.parseFloat(rootStyle.getPropertyValue(name)) || 0;
  if (runway("--top-runway") > 0 && scrollY === 0 && !location.hash) {
    scrollTo({ top: runway("--top-runway"), behavior: "instant" });
  }

  const settle = () => {
    const top = runway("--top-runway");
    const bottom = document.documentElement.scrollHeight - innerHeight - runway("--footer-runway");
    const target = scrollY < top ? top : Math.min(scrollY, Math.max(bottom, top));
    if (target !== scrollY) {
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollTo({ top: target, behavior: reduce ? "instant" : "smooth" });
    }
  };
  if ("onscrollend" in window) {
    addEventListener("scrollend", settle);
  } else {
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    addEventListener(
      "scroll",
      () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(settle, 150);
      },
      { passive: true },
    );
  }
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
