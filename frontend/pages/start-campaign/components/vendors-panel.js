export function createVendorsPanel() {
  const section = document.createElement('div')
  section.className = 'vendors-panel'
  section.innerHTML = `
    <label class="field">
      <span>Approved Vendor</span>
      <select name="vendorId" data-vendors-list required>
        <option value="">Loading vendors...</option>
      </select>
    </label>
  `
  return section
}

export function renderVendors(panel, vendors) {
  const list = panel.querySelector('[data-vendors-list]')
  if (!list) return

  if (!vendors || vendors.length === 0) {
    list.innerHTML = '<option value="">No approved vendors available</option>'
    return
  }

  list.innerHTML = '<option value="">Select an approved vendor...</option>'
  vendors.forEach((vendor) => {
    const option = document.createElement('option')
    option.value = vendor.id
    option.textContent = vendor.name
    list.append(option)
  })
}

export function renderVendorsError(panel, _message) {
  const list = panel.querySelector('[data-vendors-list]')
  if (!list) return
  list.innerHTML = `<option value="">No approved vendors available</option>`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
