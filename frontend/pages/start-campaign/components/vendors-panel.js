export function createVendorsPanel() {
  const section = document.createElement('div')
  section.className = 'vendors-panel'
  section.innerHTML = `
    <label class="field">
      <span>Approved Vendors</span>
      <select name="vendorId" data-vendors-list required>
        <option value="">Select from Approved List</option>
      </select>
    </label>
    <a class="submit-vendor-placeholder" href="./submit-vendor.html">
      <span aria-hidden="true"></span>
      Submit New Vendor for Review
    </a>
  `
  return section
}

export function renderVendors(panel, vendors) {
  const list = panel.querySelector('[data-vendors-list]')
  if (!list) return

  list.innerHTML = '<option value="">Select from Approved List</option>'
  vendors.forEach((vendor) => {
    const option = document.createElement('option')
    option.value = vendor.id
    option.textContent = vendor.name
    list.append(option)
  })
}

export function renderVendorsError(panel, message) {
  const list = panel.querySelector('[data-vendors-list]')
  if (!list) return
  list.innerHTML = `<option value="">${escapeHtml(message)}</option>`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
