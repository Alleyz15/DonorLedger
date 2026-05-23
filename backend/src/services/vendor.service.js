// services/vendor.service.js
//
// Section 12 - vendor KYC. Without this, an NGO could create a shell
// company and route every donated ringgit back to themselves through it.
// Vendor KYC plus the on-chain approved vendor list closes that hole.

import prisma from '../config/database.js'
import contractService from './contract.service.js'

/** NGO submits a new vendor. Status stays PENDING_KYC until Bank Islam acts. */
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

  let campaign = null
  if (campaignId) {
    campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    })
    if (!campaign) {
      const err = new Error('Campaign not found')
      err.status = 404
      throw err
    }

    if (campaign.status !== 'ACTIVE' || !campaign.contractAddress) {
      const err = new Error('Campaign must be approved before vendor approval')
      err.status = 400
      throw err
    }

    await contractService.addApprovedVendor(
      campaign.contractAddress,
      vendor.walletAddress
    )
  }

  return prisma.vendor.update({
    where: { id: vendorId },
    data: {
      status: 'APPROVED',
      approvedBy: adminUserId,
      approvedAt: new Date(),
      ...(campaignId ? { campaigns: { connect: { id: campaignId } } } : {}),
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
