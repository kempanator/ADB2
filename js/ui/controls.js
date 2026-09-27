"use strict";

function initializeControls() {
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

  return { showModal, hideModal, activateTab };
}
