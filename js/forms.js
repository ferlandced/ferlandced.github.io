// Multi-step forms. Everything the visitor sees lives in the HTML (see _includes/forms/).
// Without JS the HTML is one long form with browser validation that posts straight to Web3Forms.
// This file turns it into steps: shows/hides steps, validates, submits and shows the success or error message.
(() => {
  const FIELDS = "input, select, textarea";

  const wire = (form) => {
    const steps = [...form.querySelectorAll("[data-step]")];
    const progress = form.querySelector("[data-progress]");
    const error = form.querySelector("[data-error]");
    const success = form.querySelector("[data-success]");
    const last = steps.length - 1;
    let current = 0;
    let pending = false;

    const show = (i, focus) => {
      steps.forEach((s, n) => (s.hidden = n !== i));
      current = i;
      if (progress && steps.length > 1) {
        progress.querySelector("[data-current]").textContent = i + 1;
        progress.querySelector("[data-total]").textContent = steps.length;
        progress.style.setProperty("--progress", (i + 1) / steps.length);   // bar width, see css/forms.css
        progress.hidden = false;
      }
      if (focus) steps[i].querySelector("h2")?.focus();
    };

    // data-gte="<field name>": a number that must not be lower than the other field's.
    // The message comes from the HTML (data-gte-message).
    const checkGte = () => form.querySelectorAll("[data-gte]").forEach((el) => {
      const other = form.elements[el.dataset.gte];
      const low = el.value !== "" && other && other.value !== "" && Number(el.value) < Number(other.value);
      el.setCustomValidity(low ? el.dataset.gteMessage || el.title || "​" : "");
    });

    // data-one-of="<group>": at least one field of the group must be filled (e.g. phone or email).
    // The message is set on the group's first field and comes from the HTML (data-one-of-message).
    const checkOneOf = () => {
      const groups = {};
      form.querySelectorAll("[data-one-of]").forEach((el) => (groups[el.dataset.oneOf] ||= []).push(el));
      Object.values(groups).forEach((fields) => {
        const empty = fields.every((el) => el.value.trim() === "");
        fields[0].setCustomValidity(empty ? fields[0].dataset.oneOfMessage || fields[0].title || "​" : "");
      });
    };

    const checkCustom = () => { checkGte(); checkOneOf(); };

    const firstInvalid = (step) => [...step.querySelectorAll(FIELDS)].find((el) => el.willValidate && !el.checkValidity());

    const next = () => {
      checkCustom();
      const bad = firstInvalid(steps[current]);
      if (bad) return bad.reportValidity();
      if (current < last) show(current + 1, true);
    };

    const setBusy = (busy) => {
      pending = busy;
      form.querySelectorAll("button").forEach((b) => (b.disabled = busy));
    };

    const done = () => {
      steps.forEach((s) => (s.hidden = true));
      if (progress) progress.hidden = true;
      if (error) error.hidden = true;
      success.hidden = false;
      success.focus();
    };

    // One readable line per checkbox group, no empty file entries.
    const payload = () => {
      const data = new FormData(form);
      const groups = {};
      form.querySelectorAll('input[type="checkbox"]').forEach((c) => (groups[c.name] = (groups[c.name] || 0) + 1));
      const out = new FormData();
      const joined = new Set();
      for (const [key, value] of data) {
        if (value instanceof File && value.size === 0) continue;
        if (groups[key] > 1) {
          if (joined.has(key)) continue;
          joined.add(key);
          out.append(key, [...new Set(data.getAll(key))].join(", "));
        } else {
          out.append(key, value);
        }
      }
      return out;
    };

    const submit = async () => {
      checkCustom();
      for (let i = 0; i <= last; i++) {
        const bad = firstInvalid(steps[i]);
        if (bad) {
          show(i, false);
          return bad.reportValidity();
        }
      }
      if (form.elements.botcheck?.checked) return done();

      if (error) error.hidden = true;
      setBusy(true);
      let ok = false;
      try {
        const res = await fetch(form.action, { method: "POST", body: payload() });
        const json = await res.json();
        ok = res.ok && json.success === true;
      } catch {
        ok = false;
      }
      setBusy(false);
      if (ok) return done();
      if (error) error.hidden = false;
    };

    form.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn || pending) return;
      if (btn.hasAttribute("data-next")) next();
      else if (btn.hasAttribute("data-back") && current > 0) show(current - 1, true);
    });

    // Enter on a step before the last one moves to the next step, it never submits.
    form.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing || current === last) return;
      if (e.target.matches("textarea, button, a")) return;
      e.preventDefault();
      next();
    });

    // A submit button sends from any step (e.g. "skip and send" on optional steps).
    // Without one (Enter in a field), a step before the last one moves on instead.
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (pending) return;
      if (e.submitter || current === last) submit();
      else next();
    });

    // data-allow="<character class>": characters outside it are dropped while typing or pasting.
    const filter = (el) => {
      const allowed = new RegExp(el.dataset.allow, "g");
      const value = (el.value.match(allowed) || []).join("");
      if (value === el.value) return;
      const caret = el.selectionStart - (el.value.slice(0, el.selectionStart).length - (el.value.slice(0, el.selectionStart).match(allowed) || []).length);
      el.value = value;
      el.setSelectionRange(caret, caret);
    };

    // Intent (e.g. rental): ?intent=<name> on the page URL, or "wizard:open" with { intent } from the home page
    // dialog (js/site.js). Applied only when the subject field has data-subject-<name>: the intent field is
    // set and that subject is used. Anything else falls back to the default subject and an empty intent.
    // The original subject is kept here: on a hidden input, setting .value also changes its default value.
    const subject = form.elements.subject;
    const baseSubject = subject?.value;
    const setIntent = (intent) => {
      const field = form.elements.intent;
      const key = intent ? `subject${intent[0].toUpperCase()}${intent.slice(1)}` : "";
      const known = !!(key && subject?.dataset[key]);
      if (field) field.value = known ? intent : "";
      if (subject) subject.value = known ? subject.dataset[key] : baseSubject;
    };

    // Reset (e.g. reopening a dialog after a sent request): back to step 1, messages hidden.
    form.addEventListener("reset", () => {
      if (error) error.hidden = true;
      success.hidden = true;
      show(0, false);
    });

    // Opened from a link. A sent form starts over; one being filled in, sending or failed is kept as is.
    form.addEventListener("wizard:open", (e) => {
      if (!success.hidden) form.reset();
      setIntent(e.detail?.intent);
    });

    form.addEventListener("input", (e) => {
      if (e.target.dataset.allow) filter(e.target);
      if (e.target.matches("[data-gte]") || form.querySelector(`[data-gte="${e.target.name}"]`)) checkGte();
      if (e.target.matches("[data-one-of]")) checkOneOf();
    });

    form.noValidate = true;                     // validation is run per step above
    form.setAttribute("data-wizard-ready", ""); // css/forms.css shows the step buttons
    setIntent(new URLSearchParams(location.search).get("intent"));
    show(0, false);
  };

  document.querySelectorAll("form[data-wizard]").forEach(wire);
})();
