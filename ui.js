"use strict";

// Small, synchronous controls for the page's dialogs, menus, panels and tabs.
const ui = (() => {
  let openModal = null;
  let returnFocus = null;
  const pendingCollapseTransitions = new WeakMap();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  function hideModal(modal = openModal) {
    if (!modal || !modal.classList.contains("show")) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    if (openModal === modal) {
      openModal = null;
      backdrop.remove();
      document.body.classList.remove("modal-open");
      if (returnFocus?.isConnected) returnFocus.focus();
      returnFocus = null;
    }
    modal.dispatchEvent(new Event("hidden.ui.modal"));
  }

  function showModal(modal) {
    if (typeof modal === "string") modal = document.querySelector(modal);
    if (!modal || modal === openModal) return;
    if (openModal) hideModal(openModal);
    returnFocus = document.activeElement;
    openModal = modal;
    document.body.append(backdrop);
    document.body.classList.add("modal-open");
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    (modal.querySelector("[autofocus], .btn-close, button, input, select") || modal).focus();
    modal.dispatchEvent(new Event("shown.ui.modal"));
  }

  function closeDropdowns(except = null) {
    document.querySelectorAll(".dropdown-menu.show").forEach(menu => {
      if (menu === except) return;
      menu.classList.remove("show");
      menu.previousElementSibling?.setAttribute("aria-expanded", "false");
    });
  }

  function activateTab(tab) {
    const target = tab && document.querySelector(tab.dataset.uiTarget);
    if (!target) return;
    tab.closest("[role=tablist]")?.querySelectorAll("[role=tab]").forEach(item => {
      item.classList.toggle("active", item === tab);
      item.setAttribute("aria-selected", String(item === tab));
    });
    target.parentElement.querySelectorAll(".tab-pane").forEach(pane => {
      pane.classList.toggle("active", pane === target);
      pane.classList.toggle("show", pane === target);
    });
  }

  function toggleCollapse(target, trigger) {
    pendingCollapseTransitions.get(target)?.();
    pendingCollapseTransitions.delete(target);
    const opening = !target.classList.contains("show");
    target.classList.toggle("is-expanding", opening);
    target.classList.toggle("show", opening);
    trigger.setAttribute("aria-expanded", String(opening));
    if (!opening) return;

    let timer;
    const cleanup = () => {
      target.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
    };
    const finish = () => {
      cleanup();
      pendingCollapseTransitions.delete(target);
      target.classList.remove("is-expanding");
    };
    const onEnd = event => {
      if (event.target === target && event.propertyName === "grid-template-rows") finish();
    };
    target.addEventListener("transitionend", onEnd);
    timer = setTimeout(finish, 250);
    pendingCollapseTransitions.set(target, cleanup);
  }

  document.addEventListener("click", event => {
    const trigger = event.target.closest("[data-ui-toggle]");
    const dismiss = event.target.closest("[data-ui-dismiss]");
    if (dismiss) {
      const type = dismiss.dataset.uiDismiss;
      if (type === "modal") hideModal(dismiss.closest(".modal"));
      if (type === "alert") {
        const alert = dismiss.closest(".alert");
        if (alert?.parentElement?.id === "alert-host") alert.parentElement.replaceChildren();
        else alert?.remove();
      }
      return;
    }
    if (!trigger) {
      if (event.target === backdrop || event.target === openModal) hideModal();
      if (event.target.closest(".results-options-menu")) return;
      closeDropdowns();
      return;
    }

    const type = trigger.dataset.uiToggle;
    const target = document.querySelector(trigger.dataset.uiTarget || "#missing-ui-target");
    if (type === "modal") {
      closeDropdowns();
      showModal(target);
    } else if (type === "collapse" && target) {
      toggleCollapse(target, trigger);
    } else if (type === "dropdown") {
      const menu = trigger.parentElement.querySelector(".dropdown-menu");
      const opening = !menu?.classList.contains("show");
      closeDropdowns();
      menu?.classList.toggle("show", opening);
      trigger.setAttribute("aria-expanded", String(opening));
    } else if (type === "tab" && target) {
      activateTab(trigger);
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (openModal) hideModal();
      else closeDropdowns();
    }
    const tab = event.target.closest?.('[role="tab"]');
    if (tab && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
      const index = tabs.indexOf(tab);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
        : (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    }
    if (event.key !== "Tab" || !openModal) return;
    const focusable = [...openModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]')]
      .filter(element => element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  let copyToastTimer;
  function showCopyToast(message, point) {
    let toast = document.querySelector("#copy-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "copy-toast";
      toast.className = "copy-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.append(toast);
    }
    clearTimeout(copyToastTimer);
    toast.textContent = message;
    const gap = 12;
    const x = Math.max(8, Math.min(point.x + gap, window.innerWidth - toast.offsetWidth - 8));
    const below = point.y + gap;
    const y = below + toast.offsetHeight <= window.innerHeight - 8
      ? below : point.y - toast.offsetHeight - gap;
    toast.style.left = `${x}px`;
    toast.style.top = `${Math.max(8, y)}px`;
    toast.classList.add("show");
    copyToastTimer = setTimeout(() => toast.classList.remove("show"), 700);
  }

  async function copyValue(value, point) {
    const text = String(value ?? "");
    if (!text) return;
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch { /* file:// can need the selection fallback. */ }
    }
    if (!copied) {
      const previousFocus = document.activeElement;
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.append(input);
      input.select();
      try { copied = document.execCommand("copy"); } catch { copied = false; }
      input.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
    }
    showCopyToast(copied ? "Copied" : "Copy failed", point);
  }

  document.addEventListener("click", event => {
    const target = event.target.closest?.("[data-copy]");
    if (!target || event.target.closest("a, button, .song-info-search-link")) return;
    copyValue(target.dataset.copy, { x: event.clientX, y: event.clientY });
  });
  document.addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key) || !event.target.matches?.("[data-copy]")) return;
    event.preventDefault();
    const rect = event.target.getBoundingClientRect();
    copyValue(event.target.dataset.copy, { x: rect.left + rect.width / 2, y: rect.bottom });
  });

  return { showModal, hideModal, activateTab };
})();
