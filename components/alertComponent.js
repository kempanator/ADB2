class AlertComponent {
  constructor() {
    this.alertHost = document.querySelector("#alert-host");
    this.wireEvents();
  }

  // Wire up UI event listeners
  wireEvents() {
    // Alert events
    eventBus.on("ui:show-alert", (data) => this.showAlert(data.message, data.type));
    eventBus.on("search:submit", () => this.hideAlert());
  }

  // Shows an alert message with the specified type
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

const alertComponent = new AlertComponent();
