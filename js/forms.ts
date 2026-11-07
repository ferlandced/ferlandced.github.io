// Multi-step forms. Everything the visitor sees lives in the HTML (see _includes/forms/).
// Without JS the HTML is one long form with browser validation that posts straight to Web3Forms.
// This file turns it into steps: shows/hides steps, validates, submits and shows the success or error message.
(() => {
  type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

  const FIELDS = "input, select, textarea";

  const isField = (element: unknown): element is Field =>
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement;

  const intentOf = (event: Event): string | undefined => {
    const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
    if (typeof detail === "object" && detail !== null && "intent" in detail) {
      return typeof detail.intent === "string" ? detail.intent : undefined;
    }
    return undefined;
  };

  const isSuccessResponse = (json: unknown) =>
    typeof json === "object" && json !== null && "success" in json && json.success === true;

  const wire = (form: HTMLFormElement) => {
    const steps = [...form.querySelectorAll<HTMLElement>("[data-step]")];
    const progress = form.querySelector<HTMLElement>("[data-progress]");
    const error = form.querySelector<HTMLElement>("[data-error]");
    const success = form.querySelector<HTMLElement>("[data-success]");
    if (!success) {
      return;
    }
    const last = steps.length - 1;
    let current = 0;
    let pending = false;

    const fieldNamed = (name: string | undefined) => {
      const field = name ? form.elements.namedItem(name) : null;
      return isField(field) ? field : null;
    };

    const show = (index: number, focus: boolean) => {
      steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== index;
      });
      current = index;
      if (progress && steps.length > 1) {
        const currentLabel = progress.querySelector("[data-current]");
        const totalLabel = progress.querySelector("[data-total]");
        if (currentLabel) {
          currentLabel.textContent = String(index + 1);
        }
        if (totalLabel) {
          totalLabel.textContent = String(steps.length);
        }
        progress.style.setProperty("--progress", String((index + 1) / steps.length)); // bar width, see css/forms.css
        progress.hidden = false;
      }
      if (focus) {
        steps[index]?.querySelector<HTMLElement>("h2")?.focus();
      }
    };

    // data-gte="<field name>": a number that must not be lower than the other field's.
    // The message comes from the HTML (data-gte-message).
    const checkGte = () => {
      form.querySelectorAll<HTMLInputElement>("[data-gte]").forEach((element) => {
        const other = fieldNamed(element.dataset.gte);
        const low =
          element.value !== "" &&
          other !== null &&
          other.value !== "" &&
          Number(element.value) < Number(other.value);
        element.setCustomValidity(low ? element.dataset.gteMessage || element.title || "​" : "");
      });
    };

    // data-one-of="<group>": at least one field of the group must be filled (e.g. phone or email).
    // The message is set on the group's first field and comes from the HTML (data-one-of-message).
    const checkOneOf = () => {
      const groups = new Map<string, Field[]>();
      form.querySelectorAll<Field>("[data-one-of]").forEach((element) => {
        const group = element.dataset.oneOf ?? "";
        groups.set(group, [...(groups.get(group) ?? []), element]);
      });
      groups.forEach((fields) => {
        const [first] = fields;
        if (!first) {
          return;
        }
        const empty = fields.every((element) => element.value.trim() === "");
        first.setCustomValidity(empty ? first.dataset.oneOfMessage || first.title || "​" : "");
      });
    };

    const checkCustom = () => {
      checkGte();
      checkOneOf();
    };

    const firstInvalid = (step: HTMLElement | undefined) =>
      [...(step?.querySelectorAll<Field>(FIELDS) ?? [])].find(
        (element) => element.willValidate && !element.checkValidity(),
      );

    const next = () => {
      checkCustom();
      const bad = firstInvalid(steps[current]);
      if (bad) {
        bad.reportValidity();
        return;
      }
      if (current < last) {
        show(current + 1, true);
      }
    };

    const setBusy = (busy: boolean) => {
      pending = busy;
      form.querySelectorAll("button").forEach((button) => {
        button.disabled = busy;
      });
    };

    const done = () => {
      steps.forEach((step) => {
        step.hidden = true;
      });
      if (progress) {
        progress.hidden = true;
      }
      if (error) {
        error.hidden = true;
      }
      success.hidden = false;
      success.focus();
    };

    // One readable line per checkbox group, no empty file entries.
    const payload = () => {
      const data = new FormData(form);
      const checkboxCounts = new Map<string, number>();
      form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
        checkboxCounts.set(checkbox.name, (checkboxCounts.get(checkbox.name) ?? 0) + 1);
      });
      const submission = new FormData();
      const joined = new Set<string>();
      for (const [key, value] of data) {
        if (value instanceof File && value.size === 0) {
          continue;
        }
        if ((checkboxCounts.get(key) ?? 0) > 1) {
          if (joined.has(key)) {
            continue;
          }
          joined.add(key);
          const checked = data.getAll(key).filter((entry) => typeof entry === "string");
          submission.append(key, [...new Set(checked)].join(", "));
        } else {
          submission.append(key, value);
        }
      }
      return submission;
    };

    const submit = async () => {
      checkCustom();
      for (let index = 0; index <= last; index++) {
        const bad = firstInvalid(steps[index]);
        if (bad) {
          show(index, false);
          bad.reportValidity();
          return;
        }
      }
      const botcheck = fieldNamed("botcheck");
      if (botcheck instanceof HTMLInputElement && botcheck.checked) {
        done();
        return;
      }

      if (error) {
        error.hidden = true;
      }
      setBusy(true);
      let ok: boolean;
      try {
        const response = await fetch(form.action, { method: "POST", body: payload() });
        const json: unknown = await response.json();
        ok = response.ok && isSuccessResponse(json);
      } catch {
        ok = false;
      }
      setBusy(false);
      if (ok) {
        done();
        return;
      }
      if (error) {
        error.hidden = false;
      }
    };

    form.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!button || pending) {
        return;
      }
      if (button.hasAttribute("data-next")) {
        next();
      } else if (button.hasAttribute("data-back") && current > 0) {
        show(current - 1, true);
      }
    });

    // Enter on a step before the last one moves to the next step, it never submits.
    form.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing || current === last) {
        return;
      }
      if (event.target instanceof Element && event.target.matches("textarea, button, a")) {
        return;
      }
      event.preventDefault();
      next();
    });

    // A submit button sends from any step (e.g. "skip and send" on optional steps).
    // Without one (Enter in a field), a step before the last one moves on instead.
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (pending) {
        return;
      }
      if (event.submitter || current === last) {
        void submit();
      } else {
        next();
      }
    });

    // data-allow="<character class>": characters outside it are dropped while typing or pasting.
    const filter = (element: HTMLInputElement | HTMLTextAreaElement, allow: string) => {
      const allowed = new RegExp(allow, "g");
      const value = (element.value.match(allowed) ?? []).join("");
      if (value === element.value) {
        return;
      }
      // The caret stays after the same allowed characters it was after
      const before = element.value.slice(0, element.selectionStart ?? element.value.length);
      const caret = (before.match(allowed) ?? []).length;
      element.value = value;
      element.setSelectionRange(caret, caret);
    };

    // Intent (e.g. rental): ?intent=<name> on the page URL, or "wizard:open" with { intent } from the home page
    // dialog (js/site.ts). Applied only when the subject field has data-subject-<name>: the intent field is
    // set and that subject is used. Anything else falls back to the default subject and an empty intent.
    // The original subject is kept here: on a hidden input, setting .value also changes its default value.
    const subject = fieldNamed("subject");
    const baseSubject = subject?.value ?? "";
    const setIntent = (intent: string | null | undefined) => {
      const intentField = fieldNamed("intent");
      const key = intent ? `subject${intent.charAt(0).toUpperCase()}${intent.slice(1)}` : "";
      const intentSubject = key ? subject?.dataset[key] : undefined;
      if (intentField) {
        intentField.value = intentSubject && intent ? intent : "";
      }
      if (subject) {
        subject.value = intentSubject || baseSubject;
      }
    };

    // Reset (e.g. reopening a dialog after a sent request): back to step 1, messages hidden.
    form.addEventListener("reset", () => {
      if (error) {
        error.hidden = true;
      }
      success.hidden = true;
      show(0, false);
    });

    // Opened from a link. A sent form starts over; one being filled in, sending or failed is kept as is.
    form.addEventListener("wizard:open", (event) => {
      if (!success.hidden) {
        form.reset();
      }
      setIntent(intentOf(event));
    });

    form.addEventListener("input", (event) => {
      const target = event.target;
      if (!isField(target)) {
        return;
      }
      const allow = target.dataset.allow;
      if (allow && !(target instanceof HTMLSelectElement)) {
        filter(target, allow);
      }
      if (target.matches("[data-gte]") || form.querySelector(`[data-gte="${target.name}"]`)) {
        checkGte();
      }
      if (target.matches("[data-one-of]")) {
        checkOneOf();
      }
    });

    form.noValidate = true; // validation is run per step above
    form.setAttribute("data-wizard-ready", ""); // css/forms.css shows the step buttons
    setIntent(new URLSearchParams(location.search).get("intent"));
    show(0, false);
  };

  document.querySelectorAll<HTMLFormElement>("form[data-wizard]").forEach(wire);
})();
