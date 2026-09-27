class AlertView {
  constructor({ events }) {
    Object.assign(this, { events });
    this.alertHost = document.querySelector("#alert-host");
    this.wireEvents();
  }

  wireEvents() {
    this.events.on("ui:show-alert", (data) => this.showAlert(data.message, data.type));
    this.events.on("results:loading-changed", ({ loading }) => { if (loading) this.hideAlert(); });
  }

  showAlert(msg, type = "info") {
    if (type === "error") type = "danger";
    this.alertHost.innerHTML = `
      <div class="alert alert-${type} alert-dismissible" role="alert">
        ${escapeHtml(String(msg))}
        <button type="button" class="btn-close" data-ui-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  hideAlert() {
    this.alertHost.replaceChildren();
  }
}
