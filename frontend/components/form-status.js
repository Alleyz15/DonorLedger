export function setFormStatus(element, message, type = 'idle') {
  element.textContent = message
  element.dataset.status = type
}
