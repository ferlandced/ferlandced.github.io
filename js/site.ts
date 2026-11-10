// Burger menu below the desktop breakpoint: a full-screen menu over the page (css/site.css, Phone
// menu). Opening it moves focus to its first link; while it is open the rest of the page is inert,
// so focus stays in the menu. Without JS the nav stays visible (see .js-nav in site.css).
(() => {
  const root = document.querySelector<HTMLElement>("[data-nav-root]");
  const toggle = root?.querySelector<HTMLButtonElement>(".nav-toggle");
  const nav = root?.querySelector<HTMLElement>(".site-nav");
  const label = toggle?.querySelector(".visually-hidden");
  if (!root || !toggle || !nav || !label) {
    return;
  }
  document.documentElement.classList.add("js-nav");

  const outsideMenu = [
    ...[...document.body.children].filter((element) => element !== root),
    ...[...root.children].filter((element) => element !== toggle && element !== nav),
  ];

  const setOpen = (open: boolean) => {
    root.toggleAttribute("data-open", open);
    for (const element of outsideMenu) {
      if (element instanceof HTMLElement) {
        element.inert = open;
      }
    }
    toggle.setAttribute("aria-expanded", String(open));
    label.textContent = (open ? toggle.dataset.labelClose : toggle.dataset.labelOpen) ?? "";
  };

  toggle.addEventListener("click", () => {
    const open = !root.hasAttribute("data-open");
    setOpen(open);
    if (open) {
      nav.querySelector("a")?.focus();
    }
  });
  nav.querySelectorAll("a").forEach((link) => {
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
  matchMedia("(width >= 1024px)").addEventListener("change", () => {
    setOpen(false);
  });
})();

// Home page animations: GSAP, ScrollTrigger and SplitText, which only the home page loads (before
// this script): the About story, then the reveals of the other sections. Without the libraries,
// without JS or with reduced motion, everything shows in its final place.
const hasScrollEffects =
  typeof gsap !== "undefined" &&
  typeof ScrollTrigger !== "undefined" &&
  typeof SplitText !== "undefined";

if (hasScrollEffects) {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: "power3.out" });

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

// About story. About holds on screen (sticky, css/site.css, About story) while the visitor scrolls
// four short steps. Screens 600px tall or more: the text follows the scroll, forwards and back; on
// phones each block also grows line by line, its blur rising with it. Shorter screens: About
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
      phone: "(width <= 1023.98px)",
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

// Reveals of the other sections. Each one is triggered and scoped by its own section, with its
// timings in one CONFIG, so sections can be added, removed or reordered. A reveal plays once, when
// its trigger's top reaches 70% of the screen height, and never hides content again.
(() => {
  if (!hasScrollEffects) {
    return;
  }
  const LAYOUTS = {
    desktop: "(width >= 1024px)",
    phone: "(width <= 1023.98px)",
    motion: "(prefers-reduced-motion: no-preference)",
  };
  // Sections whose reveal has played: never hidden again, even when the layout changes
  const revealed = new WeakSet<Element>();

  interface LineReveal {
    x: number;
    duration: number;
    stagger: number;
  }

  // Text comes in line by line: each line slides in from x and fades in, inside its own mask. The
  // lines are measured as they play, and put back to plain text once in.
  const revealLines = (
    timeline: gsap.core.Timeline,
    elements: Element[],
    { x, duration, stagger }: LineReveal,
    position?: gsap.Position,
  ) => {
    const split = SplitText.create(elements, { type: "lines", mask: "lines" });
    timeline
      .set(elements, { opacity: 1 }, position)
      .from(split.lines, { x, opacity: 0, duration, stagger }, "<")
      .call(() => {
        split.revert();
      });
  };

  // A section's reveal: `hidden` waits faded out (still read by screen readers) until `trigger`
  // reaches `start`, then `build` plays it, once. A section already above the screen (opened at a
  // later section) shows at once, as does one where the keyboard brings focus.
  const revealOnce = (
    context: gsap.Context,
    section: HTMLElement,
    {
      trigger,
      start,
      hidden,
      build,
    }: {
      trigger: Element;
      start: string;
      hidden: Element[];
      build: (timeline: gsap.core.Timeline) => void;
    },
  ) => {
    if (revealed.has(section)) {
      return;
    }
    gsap.set(hidden, { opacity: 0 });
    let timeline: gsap.core.Timeline | undefined;
    const play = () => {
      if (timeline) {
        return;
      }
      revealed.add(section);
      const played = context.add(() => {
        const steps = gsap.timeline();
        build(steps);
        return steps;
      });
      timeline = played;
      if (section.getBoundingClientRect().bottom < 0) {
        played.progress(1);
      }
    };
    ScrollTrigger.create({ trigger, start, once: true, onEnter: play });
    const showAtOnce = () => {
      play();
      timeline?.progress(1);
    };
    section.addEventListener("focusin", showAtOnce);
    return () => {
      section.removeEventListener("focusin", showAtOnce);
    };
  };

  // Hero. Desktop: still on load; as the hero scrolls away the slash moves out to the right, with the
  // scroll. Phones: on load, the lockup rises in, one part after the other.
  const revealHero = () => {
    const hero = document.querySelector<HTMLElement>(".hero");
    if (!hero) {
      return;
    }
    const CONFIG = {
      band: { start: "top top", end: "bottom top" },
      lockup: { y: 24, duration: 0.8, stagger: 0.1, delay: 0.2 },
    };
    gsap.matchMedia().add(
      LAYOUTS,
      (context) => {
        const { desktop, phone, motion } = context.conditions ?? {};
        if (!motion) {
          return;
        }
        if (desktop) {
          gsap.to(".hero__band", {
            xPercent: 100,
            ease: "none",
            scrollTrigger: { trigger: hero, ...CONFIG.band, scrub: true },
          });
        }
        if (phone && !revealed.has(hero)) {
          revealed.add(hero);
          gsap.from(".hero__signature, .hero__name, .hero__role, .hero__tagline, .hero__cta", {
            y: CONFIG.lockup.y,
            opacity: 0,
            duration: CONFIG.lockup.duration,
            stagger: CONFIG.lockup.stagger,
            delay: CONFIG.lockup.delay,
          });
        }
      },
      hero,
    );
  };

  // Services: each block on its own, once its top reaches 70% of the screen. Desktop: the picture
  // comes in from its outer side (looking from the left, selling from the right), then the text, line
  // by line. Phones (Figma enter states 126:413, 126:415): the picture fades in at the centre, holds,
  // then moves aside to rest at the screen edge (css/site.css), then the text comes in line by line.
  const revealServices = () => {
    const blocks = [...document.querySelectorAll<HTMLElement>(".service")];
    if (!blocks.length) {
      return;
    }
    const CONFIG = {
      start: "top 70%",
      desktop: { mediaX: 80, mediaDuration: 0.9 },
      phone: { scale: 0.92, enterDuration: 0.6, hold: 0.3, moveDuration: 0.9 },
      line: { x: 24, duration: 0.8, stagger: 0.08 },
      item: { duration: 0.6, stagger: 0.08 },
    };

    for (const block of blocks) {
      const media = block.querySelector<HTMLElement>(".service__media");
      const lines = [...block.querySelectorAll<HTMLElement>(".service__title, .service__body")];
      const items = [...block.querySelectorAll<HTMLElement>(".service__action, .service__links")];
      if (!media) {
        continue;
      }
      // The picture's side: -1 left (looking for a property), 1 right (sell); the text comes in from that side
      const side = block.classList.contains("service--sell") ? 1 : -1;
      const fromCentre = () => block.clientWidth / 2 - (media.offsetLeft + media.offsetWidth / 2);

      gsap.matchMedia().add(
        LAYOUTS,
        (context) => {
          const { desktop, motion } = context.conditions ?? {};
          if (!motion) {
            return;
          }
          return revealOnce(context, block, {
            trigger: block,
            start: CONFIG.start,
            hidden: [media, ...lines, ...items],
            build: (timeline) => {
              if (desktop) {
                timeline.fromTo(
                  media,
                  { x: side * CONFIG.desktop.mediaX, opacity: 0 },
                  { x: 0, opacity: 1, duration: CONFIG.desktop.mediaDuration },
                );
              } else {
                timeline
                  .fromTo(
                    media,
                    { x: fromCentre(), scale: CONFIG.phone.scale, opacity: 0 },
                    { scale: 1, opacity: 1, duration: CONFIG.phone.enterDuration },
                  )
                  .to(media, {
                    x: 0,
                    duration: CONFIG.phone.moveDuration,
                    ease: "power3.inOut",
                    delay: CONFIG.phone.hold,
                  });
              }
              revealLines(timeline, lines, { ...CONFIG.line, x: side * CONFIG.line.x });
              timeline.fromTo(
                items,
                { x: side * CONFIG.line.x, opacity: 0 },
                { x: 0, opacity: 1, ...CONFIG.item },
                "-=0.4",
              );
            },
          });
        },
        block,
      );
    }
  };

  // My properties: once the title reaches 70% of the screen, the cards come into place one after the
  // other. Desktop: they rise; phones: they slide in from the right, into the rail.
  const revealProperties = () => {
    const section = document.querySelector<HTMLElement>(".properties");
    const title = section?.querySelector(".properties__title");
    const cards = [...(section?.querySelectorAll<HTMLElement>(".card") ?? [])];
    if (!section || !title || !cards.length) {
      return;
    }
    const CONFIG = {
      start: "top 70%",
      desktop: { y: 48, stagger: 0.2 },
      phone: { x: 64, stagger: 0.15 },
      duration: 0.9,
    };
    gsap.matchMedia().add(
      LAYOUTS,
      (context) => {
        const { desktop, motion } = context.conditions ?? {};
        if (!motion) {
          return;
        }
        const from = desktop ? { y: CONFIG.desktop.y } : { x: CONFIG.phone.x };
        const stagger = desktop ? CONFIG.desktop.stagger : CONFIG.phone.stagger;
        return revealOnce(context, section, {
          trigger: title,
          start: CONFIG.start,
          hidden: cards,
          build: (timeline) => {
            timeline.fromTo(
              cards,
              { ...from, opacity: 0 },
              { x: 0, y: 0, opacity: 1, duration: CONFIG.duration, stagger },
            );
          },
        });
      },
      section,
    );
  };

  revealHero();
  revealServices();
  revealProperties();
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
