// services/vendor.service.js
//
// Section 12 — vendor KYC. Without this, an NGO could create a shell
// company and route every donated ringgit back to themselves through it.
// Vendor KYC plus the on-chain `approvedVendors` list closes that hole.

import prisma from '../config/database.js'
import contractService from './contract.service.js'

/** NGO submits a new vendor — status PENDING_KYC until Bank Islam acts. */
export async function submitVendor({
  ngoId,
  name,
  ssmNumber,
  serviceType,
  bankAccount,
  walletAddress,
  registrationDoc,
}) {
  const ngo = await prisma.nGO.findUnique({ where: { id: ngoId } })
  if (!ngo || ngo.status !== 'APPROVED') {
    const err = new Error('Submitting NGO must be Bank Islam-approved')
    err.status = 403
    throw err
  }
  return prisma.vendor.create({
    data: {
      ngoId,
      name,
      ssmNumber,
      serviceType,
      bankAccount,
      walletAddress,
      registrationDoc,
      status: 'PENDING_KYC',
    },
  })
}

/**
 * Bank Islam approves a vendor → addApprovedVendor() is called on every
 * Campaign contract owned by the same NGO that should be able to release
 * to this vendor. For the hackathon we attach to a single campaign
 * passed in by the admin.
 */
export async function approveVendor({
  vendorId,
  campaignId,
  adminUserId,
}) {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
  if (!vendor) {
    const err = new Error('Vendor not found')
    err.status = 404
    throw err
  }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  })
  if (!campaign) {
    const err = new Error('Campaign not found')
    err.status = 404
    throw err
  }

  // Section 12 — on-chain whitelist. Funds can now release to this address.
  await contractService.addApprovedVendor(
    campaign.contractAddress,
    vendor.walletAddress
  )

  return prisma.vendor.update({
    where: { id: vendorId },
    data: {
      status: 'APPROVED',
      approvedBy: adminUserId,
      approvedAt: new Date(),
      campaigns: { connect: { id: campaignId } },
    },
  })
}

export async function rejectVendor({ vendorId, reason, adminUserId }) {
  return prisma.vendor.update({
    where: { id: vendorId },
    data: {
      status: 'REJECTED',
      rejectedReason: reason,
      approvedBy: adminUserId,
    },
  })
}

export default { submitVendor, approveVendor, rejectVendor }
