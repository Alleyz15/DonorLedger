// routes/donate.routes.js
//
// POST /api/donate
//
// Section 10, Steps 1-2 of the bridge flow. Frontend hits this when the
// donor clicks "Donate via DuitNow". In the demo we accept the payload
// directly; in production a Bank Islam webhook calls /api/demo/simulate-duitnow
// which proxies into this same code path.

import { Router } from 'express'
import { validate } from '../middleware/validate.middleware.js'
import bridgeService from '../services/bridge.service.js'

const router = Router()

const donateSchema = {
  campaignId: { type: 'string', required: true, min: 1 },
  donorEmail: { type: 'email', required: true },
  donorName: { type: 'string', required: false, max: 200 },
  amount: { type: 'number', required: true, min: 1 },
  vendorId: { type: 'string', required: false },
}

router.post('/', validate(donateSchema), async (req, res, next) => {
  try {
    const result = await bridgeService.processDuitNowPayment(req.body)
    res.status(201).json(result)
  } catch (e) {
    next(e)
  }
})

export default router
