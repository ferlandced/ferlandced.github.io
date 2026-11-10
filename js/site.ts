// Burger menu below the desktop breakpoint. Without JS the nav stays visible (see .js-nav in site.css).
(() => {
  const root = document.querySelector<HTMLElement>("[data-nav-root]");
  const toggle = root?.querySelector<HTMLButtonElement>(".nav-toggle");
  const label = toggle?.querySelector(".visually-hidden");
  if (!root || !toggle || !label) {
    return;
  }
  document.documentElement.classList.add("js-nav");

  // Phones: the burger's circle grows just past the menu's farthest corner (css/site.css, Phone menu)
  const nav = root.querySelector<HTMLElement>(".site-nav");
  const fitCircleToMenu = () => {
    if (!nav) {
      return;
    }
    const toggleBox = toggle.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    const centreX = toggleBox.left + toggleBox.width / 2;
    const centreY = toggleBox.top + toggleBox.height / 2;
    const radius = Math.hypot(centreX - navBox.left, centreY - navBox.top) + 32;
    document.documentElement.style.setProperty(
      "--menu-circle-open-radius",
      `${Math.ceil(radius)}px`,
    );
  };

  // Measured once open, when the menu shows all its items
  const setOpen = (open: boolean) => {
    root.toggleAttribute("data-open", open);
    if (open) {
      fitCircleToMenu();
    }
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
  addEventListener("resize", () => {
    if (root.hasAttribute("data-open")) {
      fitCircleToMenu();
    }
  });
})();

// Home page scroll effects: GSAP and ScrollTrigger, which only the home page loads (before this
// script). Without them, without JS or with reduced motion, everything shows in place.
const hasScrollEffects = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
if (hasScrollEffects) {
  gsap.registerPlugin(ScrollTrigger);

  // ScrollTrigger measures the page as it loads, which can cancel the browser's jump to a
  // #section: once measured, the page goes there.
  const landOnSection = () => {
    ScrollTrigger.removeEventListener("refresh", landOnSection);
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    target?.scrollIntoView({ behavior: "instant" });
  };
  if (location.hash) {
    ScrollTrigger.addEventListener("refresh", landOnSection);
  }
}

// Home page blocks fade in and rise into place as their section arrives, and then stay. Blocks that
// arrive together play one after the other. About has its own sequence (About story, below).
(() => {
  if (!hasScrollEffects) {
    return;
  }
  const stacks = ".service__content";
  const singles =
    "#services-heading, #properties-heading, .properties .card, .properties .container > p";
  const groups = gsap.utils.toArray<HTMLElement>(`${stacks}, ${singles}`);
  if (!groups.length) {
    return;
  }
  const itemsOf = (group: Element): HTMLElement[] =>
    group.matches(stacks)
      ? gsap.utils.toArray<HTMLElement>(group.children)
      : [group as HTMLElement];
  const items = groups.flatMap(itemsOf);

  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    gsap.set(items, { opacity: 0, y: 30 });
    ScrollTrigger.batch(groups, {
      start: "top 70%",
      once: true,
      onEnter: (arriving) => {
        const blocks = arriving.flatMap(itemsOf);
        const passed = blocks.filter((block) => block.getBoundingClientRect().bottom < 0);
        gsap.set(passed, { opacity: 1, y: 0 });
        gsap.to(
          blocks.filter((block) => !passed.includes(block)),
          { opacity: 1, y: 0, duration: 0.8, ease: "power2.out", stagger: 0.15, overwrite: true },
        );
      },
    });

    // A block reached with the keyboard shows at once
    const showFocused = (event: FocusEvent) => {
      const block = items.find(
        (item) => event.target instanceof Node && item.contains(event.target),
      );
      if (block) {
        gsap.to(block, { opacity: 1, y: 0, duration: 0.2, overwrite: true });
      }
    };
    document.addEventListener("focusin", showFocused);
    return () => {
      document.removeEventListener("focusin", showFocused);
    };
  });
})();

// About story. About holds on screen (sticky, css/site.css, About story) while the visitor scrolls
// four short steps. Screens 600px tall or more: the text follows the scroll, forwards and back; on
// phones each block also grows line by line and the overlay rises with it. Shorter screens: About
// is not held and its parts play one after the other once it arrives.
// The photo changes on its own clock either way, one change at a time: part 1 brings the paramedic,
// who then stays at least PARAMEDIC_HELD_S; part 2 brings the agent back, who then stays.
// The state lives on .stage (data-story: start, paramedic, agent, done), which also holds the
// desktop's pinned copy of the photo.
(() => {
  const stage = document.querySelector<HTMLElement>(".stage");
  const about = stage?.querySelector<HTMLElement>(".about");
  if (!hasScrollEffects || !stage || !about) {
    return;
  }

  const PHOTO_CHANGE_S = 0.9;
  const PARAMEDIC_HELD_S = 1;
  const FIRST_PART_DELAY_S = 0.15;
  const STEP_S = 0.4;
  const photos = ["start", "paramedic", "agent"];

  const steps = gsap.utils.toArray<HTMLElement>(".about__step", about);
  const title = steps.find((step) => !step.dataset.storyPart);
  const stepsOfPart = (part: number) =>
    steps.filter((step) => step.dataset.storyPart === String(part));
  const [firstText] = stepsOfPart(1);
  const [secondText] = stepsOfPart(2);
  const [link, contact] = stepsOfPart(3);

  const onScreen = () => {
    const bounds = about.getBoundingClientRect();
    return bounds.bottom > 0 && bounds.top < innerHeight;
  };

  // The photo change. Each layer clips its photo, so moving the layer one way and its photo the
  // other way sweeps a straight edge across a still picture. Labels: the three photos.
  // Returns want(index): the photo the story has reached. The photo goes there one change at a
  // time; out of sight it goes there at once; once the agent is back he stays.
  const createPhotoChanges = () => {
    const layers = (name: string) =>
      gsap.utils.toArray<HTMLElement>(`.agent-photos--swap .agent-photos__layer--${name}`, stage);
    const images = (name: string) =>
      gsap.utils.toArray<HTMLElement>(
        `.agent-photos--swap .agent-photos__layer--${name} > img`,
        stage,
      );
    gsap.set([...layers("agent"), ...images("agent")], { xPercent: 0 });
    gsap.set([...layers("paramedic"), ...images("return")], { xPercent: 100 });
    gsap.set([...images("paramedic"), ...layers("return")], { xPercent: -100 });

    const wipe = { duration: PHOTO_CHANGE_S, ease: "power1.inOut" };
    const timeline = gsap
      .timeline({ paused: true })
      .addLabel("start")
      .to(layers("agent"), { xPercent: -100, ...wipe }, "start")
      .to(images("agent"), { xPercent: 100, ...wipe }, "start")
      .to([...layers("paramedic"), ...images("paramedic")], { xPercent: 0, ...wipe }, "start")
      .addLabel("paramedic")
      .to([...layers("return"), ...images("return")], { xPercent: 0, ...wipe }, "paramedic")
      .to(layers("paramedic"), { xPercent: 100, ...wipe }, "paramedic")
      .to(images("paramedic"), { xPercent: -100, ...wipe }, "paramedic")
      .addLabel("agent");

    let wanted = 0;
    let shown = -1;
    let changing = false;
    const settle = () => {
      const agentBack = photos[shown] === "agent";
      if (changing || shown === wanted || agentBack) {
        return;
      }
      if (shown < 0 || !onScreen()) {
        shown = wanted;
        stage.dataset.story = photos[shown];
        timeline.seek(photos[shown] ?? "start");
        return;
      }
      shown += Math.sign(wanted - shown);
      const photo = photos[shown] ?? "start";
      stage.dataset.story = photo;
      timeline.tweenTo(photo);
      changing = true;
      const holdS = photo === "paramedic" ? PARAMEDIC_HELD_S : 0;
      gsap.delayedCall(PHOTO_CHANGE_S + holdS, () => {
        changing = false;
        settle();
      });
    };

    return (index: number) => {
      wanted = index;
      settle();
    };
  };

  // Screens 600px tall or more. Positions are in steps of scroll from where About pins (0) to
  // where it moves on (4); one step is a quarter of About's runway (css/site.css, About story).
  // The title comes in as About settles, each paragraph over most of its step, then, after a pause
  // to read, the link and the contact. Each part's photo change starts as its text starts to show
  // (on phones, once its first line is in), so the photo matches what is being read.
  const followScroll = (growsLineByLine: boolean, want: (index: number) => void) => {
    const FIRST = -0.5;
    const LAST = 4;
    const stepSize = () => Number.parseFloat(getComputedStyle(about, "::before").height) / 4;

    const story = gsap.timeline({ defaults: { ease: "none" } });
    // On phones a block grows clipped; fully in, it takes its own height, unclipped (css/site.css)
    const growing: { step: HTMLElement; to: number }[] = [];
    const comeIn = (step: HTMLElement | undefined, from: number, to: number, rises = true) => {
      if (!step) {
        return;
      }
      const grows = growsLineByLine && rises;
      if (grows) {
        growing.push({ step, to });
      }
      const start = { opacity: 0, y: rises ? 30 : 0, ...(grows && { height: 0 }) };
      const end = { opacity: 1, y: 0, ...(grows && { height: "auto" }) };
      story.fromTo(step, start, { ...end, duration: to - from }, from - FIRST);
    };
    comeIn(title, -0.5, 0, false);
    const parts = [
      { step: firstText, from: 0, to: 0.8 },
      { step: secondText, from: 1, to: 1.8 },
    ];
    for (const { step, from, to } of parts) {
      comeIn(step, from, to);
    }
    comeIn(link, 2.4, 2.7);
    comeIn(contact, 2.7, 3);
    if (growsLineByLine) {
      const overlay = [
        { property: "--overlay-first", from: 0, to: 0.8 },
        { property: "--overlay-second", from: 1, to: 1.8 },
        { property: "--overlay-base", from: 2.4, to: 3 },
      ];
      for (const { property, from, to } of overlay) {
        story.fromTo(
          stage,
          { [property]: 0 },
          { [property]: 1, duration: to - from },
          from - FIRST,
        );
      }
    }
    story.set({}, {}, LAST - FIRST);

    // On phones a part's first line is in once that share of its full height shows
    const firstLineShares = new Map<HTMLElement, number>();
    const measureFirstLines = () => {
      for (const { step } of parts) {
        const text = step?.firstElementChild;
        if (step && text instanceof HTMLElement) {
          const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight);
          firstLineShares.set(step, Math.min(1, lineHeight / Math.max(1, text.offsetHeight)));
        }
      }
    };
    const firstLineIn = ({ step, from, to }: (typeof parts)[number]) =>
      growsLineByLine && step ? from + (firstLineShares.get(step) ?? 1) * (to - from) : from;

    ScrollTrigger.create({
      trigger: about,
      start: () => `top top+=${-FIRST * stepSize()}`,
      end: () => `+=${(LAST - FIRST) * stepSize()}`,
      scrub: true,
      animation: story,
      invalidateOnRefresh: true,
      onRefresh: measureFirstLines,
      onUpdate: (self) => {
        const position = FIRST + self.progress * (LAST - FIRST);
        for (const { step, to } of growing) {
          step.toggleAttribute("data-story-shown", position >= to);
        }
        want(parts.filter((part) => part.step && position >= firstLineIn(part)).length);
      },
    });
  };

  // Shorter screens: once About is near, its parts play one after the other, each with its photo.
  // Already past it (e.g. opened at #services): everything shows at once.
  const playOnArrival = (want: (index: number) => void) => {
    const story = gsap.timeline({ paused: true, defaults: { duration: 0.8, ease: "power2.out" } });
    const comeIn = (step: HTMLElement | undefined, at: number, rises = true) => {
      if (step) {
        story.fromTo(step, { opacity: 0, y: rises ? 30 : 0 }, { opacity: 1, y: 0 }, at);
      }
    };
    const secondAt = FIRST_PART_DELAY_S + PHOTO_CHANGE_S + PARAMEDIC_HELD_S;
    const lastAt = secondAt + PHOTO_CHANGE_S + STEP_S;
    comeIn(title, 0, false);
    story.call(want, [1], FIRST_PART_DELAY_S);
    comeIn(firstText, FIRST_PART_DELAY_S);
    story.call(want, [2], secondAt);
    comeIn(secondText, secondAt);
    comeIn(link, lastAt);
    comeIn(contact, lastAt + STEP_S);
    story.call(() => {
      stage.dataset.story = "done";
    });

    ScrollTrigger.create({
      trigger: about,
      start: "top 70%",
      once: true,
      onEnter: () => {
        if (about.getBoundingClientRect().bottom < 0) {
          want(2);
          story.progress(1);
        } else {
          story.play();
        }
      },
    });
  };

  gsap.matchMedia().add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      held: "(height >= 600px)",
      phone: "(width <= 767.98px)",
    },
    (context) => {
      const { motion, held, phone } = context.conditions ?? {};
      if (!motion) {
        return;
      }
      const want = createPhotoChanges();
      want(0);
      if (held) {
        followScroll(Boolean(phone), want);
      } else {
        playOnArrival(want);
      }
      return () => {
        delete stage.dataset.story;
      };
    },
  );
})();

// The header is past the hero once About reaches it: from there it is white, with the dark logo and
// the contact icons.
(() => {
  const header = document.querySelector<HTMLElement>(".site-header");
  const next = document.querySelector(".hero ~ section");
  if (!hasScrollEffects || !header || !next) {
    return;
  }
  ScrollTrigger.create({
    trigger: next,
    start: () => `top ${header.offsetHeight}px`,
    end: "max",
    onToggle: (self) => {
      header.toggleAttribute("data-past-hero", self.isActive);
    },
  });
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
