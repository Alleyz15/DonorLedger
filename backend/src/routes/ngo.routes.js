// routes/ngo.routes.js
//
// POST /api/ngo/register  — public application submission (Section 11)
// GET  /api/ngo/:id       — public-safe NGO profile
//
// Approval / renewal / revocation live in admin.routes.js because they
// require the Bank Islam wallet (Section 9).

import { Router } from 'express'
import prisma from '../config/database.js'
import kycService from '../services/kyc.service.js'
import { validate } from '../middleware/validate.middleware.js'

const router = Router()

const registerSchema = {
  name: { type: 'string', required: true, min: 2, max: 200 },
  registrationNum: { type: 'string', required: true, min: 3, max: 50 },
  walletAddress: { type: 'address', required: true },
  contactEmail: { type: 'email', required: true },
  contactPhone: { type: 'string', required: false },
}

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const ngo = await kycService.submitNGOApplication(req.body)
    res.status(201).json({
      id: ngo.id,
      status: ngo.status,
      riskTier: ngo.riskTier,
      message:
        'Application received. Bank Islam will complete KYC verification.',
    })
  } catch (e) {
    next(e)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const ngo = await prisma.nGO.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        registrationNum: true,
        riskTier: true,
        status: true,
        onChainExpiry: true,
        createdAt: true,
        // Never expose kycNotes (PDPA-sensitive director details), contact
        // email, or wallet revocation reason here. Admin route exposes those.
      },
    })
    if (!ngo) {
      const err = new Error('NGO not found')
      err.status = 404
      throw err
    }
    res.json(ngo)
  } catch (e) {
    next(e)
  }
})

export default router
