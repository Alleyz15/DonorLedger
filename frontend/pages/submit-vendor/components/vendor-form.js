const serviceOptions = [
  { value: 'FOOD', label: 'Food' },
  { value: 'LOGISTICS', label: 'Logistics' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'OTHER', label: 'Other' },
]

export function createVendorForm() {
  const form = document.createElement('form')
  form.className = 'vendor-review-card'
  form.noValidate = true
  form.innerHTML = `
    <header class="vendor-review-header">
      <div>
        <h1>Submit New Vendor for Review</h1>
        <p>Registration for the DonorLedger Institutional Portal</p>
      </div>
    </header>

    <section class="vendor-review-body">
      <label class="field vendor-field-full">
        <span>Vendor Name</span>
        <input name="name" type="text" placeholder="e.g. Global Logistics Solutions" />
      </label>

      <div class="vendor-form-grid">
        <label class="field">
          <span>SSM Number</span>
          <input name="ssmNumber" type="text" placeholder="202301XXXXXX" />
        </label>

        <div class="field">
          <span>Service Type</span>
          <div class="custom-select-wrapper" data-custom-select>
            <select name="serviceType" class="native-service-select" aria-label="Service type">
              <option value=""></option>
              ${serviceOptions.map((option) => (
                `<option value="${option.value}">${option.label}</option>`
              )).join('')}
            </select>
            <button class="custom-select-trigger" type="button" data-custom-select-trigger>
              <span class="placeholder" data-custom-select-label>Select service...</span>
              <i class="custom-select-arrow" aria-hidden="true"></i>
            </button>
            <div class="custom-options-menu" data-custom-options>
              ${serviceOptions.map((option) => (
                `<button class="custom-option" type="button" data-value="${option.value}">${option.label}</button>`
              )).join('')}
            </div>
          </div>
        </div>

        <label class="field">
          <span>Bank Account Number</span>
          <input name="bankAccount" type="text" placeholder="Standard Chartered/Maybank..." />
        </label>

        <label class="field">
          <span>Wallet Address (Blockchain)</span>
          <input name="walletAddress" type="text" placeholder="0x..." />
        </label>
      </div>

      <div class="vendor-upload-wrapper">
        <span class="vendor-upload-label-text">Registration Document</span>
        <label class="vendor-dropzone-box" for="vendor-reg-doc-input">
          <span class="vendor-dropzone-icon-area" aria-hidden="true">
            <i class="vendor-dropzone-icon-svg"></i>
          </span>
          <strong class="vendor-dropzone-heading">Click to upload or drag and drop</strong>
          <span class="vendor-dropzone-sub" data-default="PDF, JPG or PNG (max. 10MB)">PDF, JPG or PNG (max. 10MB)</span>
          <input
            id="vendor-reg-doc-input"
            name="registrationDoc"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
          />
        </label>
      </div>

      <section class="vendor-protocol-note">
        <i aria-hidden="true"></i>
        <div>
          <strong>By submitting, you agree to DonorLedger's transparency protocols.</strong>
          <span>All transactions with this vendor will be recorded on the public ledger for donor verification.</span>
        </div>
      </section>

      <div class="vendor-form-actions">
        <a class="vendor-cancel-button" href="./my-campaigns.html">Cancel</a>
        <button class="vendor-submit-button" type="submit">
          Submit Vendor for Review
        </button>
      </div>

      <div class="form-status" role="status" aria-live="polite"></div>
    </section>
  `
  return form
}

export function getVendorPayload(form, ngoId) {
  const formData = new FormData(form)
  const registrationDoc = formData.get('registrationDoc')
  return {
    ngoId,
    name: String(formData.get('name') || '').trim(),
    ssmNumber: String(formData.get('ssmNumber') || '').trim(),
    serviceType: String(formData.get('serviceType') || ''),
    bankAccount: String(formData.get('bankAccount') || '').trim(),
    walletAddress: String(formData.get('walletAddress') || '').trim(),
    registrationDoc: registrationDoc instanceof File && registrationDoc.size > 0
      ? registrationDoc
      : null,
  }
}

export function bindVendorUploadFeedback(form) {
  const input = form.querySelector('input[name="registrationDoc"]')
  const dropzone = form.querySelector('.vendor-dropzone-box')
  const hint = dropzone?.querySelector('.vendor-dropzone-sub')
  if (!input || !dropzone || !hint) return

  const setFile = (file) => {
    if (!file) return
    const transfer = new DataTransfer()
    transfer.items.add(file)
    input.files = transfer.files
    updateFileState(input, dropzone, hint)
  }

  input.addEventListener('change', () => updateFileState(input, dropzone, hint))
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault()
    dropzone.classList.add('is-dragging')
  })
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragging')
  })
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault()
    dropzone.classList.remove('is-dragging')
    setFile(event.dataTransfer?.files?.[0])
  })
}

export function bindVendorServiceSelect(form) {
  const wrapper = form.querySelector('[data-custom-select]')
  const trigger = form.querySelector('[data-custom-select-trigger]')
  const label = form.querySelector('[data-custom-select-label]')
  const select = form.querySelector('select[name="serviceType"]')
  const options = Array.from(form.querySelectorAll('.custom-option'))
  if (!wrapper || !trigger || !label || !select || !options.length) return

  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    wrapper.classList.toggle('is-open')
  })

  options.forEach((option) => {
    option.addEventListener('click', (event) => {
      event.stopPropagation()
      const value = option.dataset.value || ''
      select.value = value
      label.textContent = option.textContent || 'Select service...'
      label.classList.remove('placeholder')
      options.forEach((item) => item.classList.toggle('is-selected', item === option))
      wrapper.classList.remove('is-open')
    })
  })

  document.addEventListener('click', () => wrapper.classList.remove('is-open'))
}

function updateFileState(input, dropzone, hint) {
  const fileName = input.files?.[0]?.name
  dropzone.classList.toggle('has-file', !!fileName)
  hint.textContent = fileName || hint.dataset.default || 'PDF, JPG or PNG (max. 10MB)'
}
