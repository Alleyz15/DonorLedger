// routes/vendor.routes.js
//
// POST /api/vendor/submit  — NGO submits a candidate vendor (Section 12)
//
// Approval lives in admin.routes.js (requires Bank Islam wallet to call
// Campaign.addApprovedVendor).

import { Router } from 'express'
import vendorService from '../services/vendor.service.js'
import storageService from '../services/storage.service.js'
import { validate } from '../middleware/validate.middleware.js'

const router = Router()

const submitSchema = {
  ngoId: { type: 'string', required: true },
  name: { type: 'string', required: true, min: 2, max: 200 },
  ssmNumber: { type: 'string', required: true, min: 3 },
  serviceType: {
    type: 'string',
    required: true,
    enum: ['FOOD', 'LOGISTICS', 'MEDICAL', 'CONSTRUCTION', 'OTHER'],
  },
  bankAccount: { type: 'string', required: true, min: 5 },
  walletAddress: { type: 'address', required: true },
}

router.post(
  '/submit',
  // Single optional file under field name "registrationDoc"
  storageService.uploader.single('registrationDoc'),
  validate(submitSchema),
  async (req, res, next) => {
    try {
      const vendor = await vendorService.submitVendor({
        ...req.body,
        registrationDoc: req.file ? req.file.path : null,
      })
      res.status(201).json({
        id: vendor.id,
        status: vendor.status,
        message: 'Vendor submitted. Awaiting Bank Islam KYC review.',
      })
    } catch (e) {
      next(e)
    }
  }
)

export default router
