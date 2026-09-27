"use strict";

// Notifications only. Commands call their owning controller directly.
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, listener) {
    const listeners = this.listeners.get(event) || new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size && this.listeners.get(event) === listeners) this.listeners.delete(event);
    };
  }

  emit(event, data) {
    // Subscription changes during delivery affect the next notification.
    for (const listener of [...(this.listeners.get(event) || [])]) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
  }
}
