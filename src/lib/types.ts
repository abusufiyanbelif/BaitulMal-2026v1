

import type { DocumentData } from 'firebase/firestore';
import type { UserPermissions } from './modules';
import { donationCategories } from './modules';

export type DonationCategory = typeof donationCategories[number];

export interface BrandingSettings extends DocumentData {
  name?: string;
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
}

export interface PaymentSettings extends DocumentData {
  qrCodeUrl?: string;
  qrWidth?: number;
  qrHeight?: number;
  upiId?: string;
  paymentMobileNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  regNo?: string;
  pan?: string;
  address?: string;
  website?: string;
  copyright?: string;
}

export interface CampaignDocument {
  name: string;
  url: string;
  isPublic: boolean;
}

export interface RationItem {
  id: string;
  name: string;
  quantity: number;
  quantityType?: string;
  price: number;
  notes: string;
}

export interface RationList {
  [members: string]: RationItem[];
}

export interface Campaign extends DocumentData {
  id: string;
  name: string;
  category: 'Ration' | 'Relief' | 'General';
  description?: string;
  targetAmount?: number;
  startDate: string;
  endDate: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  authenticityStatus?: 'Pending Verification' | 'Verified' | 'Rejected' | 'On Hold' | 'Need More Details';
  publicVisibility?: 'Hold' | 'Ready to Publish' | 'Published';
  priceDate: string;
  shopName: string;
  shopContact: string;
  shopAddress: string;
  documents?: CampaignDocument[];
  rationLists: RationList;
  allowedDonationTypes?: DonationCategory[];
  createdAt?: any;
  createdById?: string;
  createdByName?: string;
}

export interface Lead extends DocumentData {
  id: string;
  name: string;
  category: 'Ration' | 'Relief' | 'General';
  description?: string;
  notes?: string;
  targetAmount?: number;
  startDate: string;
  endDate: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  authenticityStatus?: 'Pending Verification' | 'Verified' | 'Rejected' | 'On Hold' | 'Need More Details';
  publicVisibility?: 'Hold' | 'Ready to Publish' | 'Published';
  priceDate: string;
  shopName: string;
  shopContact: string;
  shopAddress: string;
  documents?: CampaignDocument[];
  rationLists: RationList;
  allowedDonationTypes?: DonationCategory[];
  createdAt?: any;
  createdById?: string;
  createdByName?: string;
}

export interface Beneficiary extends DocumentData {
    id: string;
    name: string;
    address: string;
    phone: string;
    members: number;
    earningMembers: number;
    male: number;
    female: number;
    addedDate: string;
    idProofType: string;
    idNumber: string;
    referralBy: string;
    kitAmount: number;
    status: 'Given' | 'Pending' | 'Hold' | 'Need More Details' | 'Verified';
    idProofUrl?: string;
    idProofIsPublic?: boolean;
    notes?: string;
    isEligibleForZakat?: boolean;
    zakatAllocation?: number;
    createdAt?: any;
    createdById?: string;
    createdByName?: string;
}

export interface UserProfile extends DocumentData {
  id: string;
  name: string;
  email: string;
  phone: string;
  loginId: string;
  userKey: string;
  role: 'Admin' | 'User';
  status: 'Active' | 'Inactive';
  permissions?: UserPermissions;
  idProofType?: string;
  idNumber?: string;
  idProofUrl?: string;
  createdAt?: any;
  createdById?: string;
  createdByName?: string;
}

export interface Donation extends DocumentData {
  id: string;
  donorName: string;
  donorPhone: string;
  receiverName: string;
  amount: number;
  type?: DonationCategory | 'General'; // Legacy field for old data
  typeSplit: { category: DonationCategory; amount: number }[];
  donationType: 'Cash' | 'Online Payment' | 'Check' | 'Other';
  referral: string;
  donationDate: string;
  status: 'Verified' | 'Pending' | 'Canceled';
  transactionId?: string;
  screenshotUrl?: string;
  screenshotIsPublic?: boolean;
  comments?: string;
  suggestions?: string;
  uploadedBy: string;
  uploadedById: string;
  campaignId?: string;
  campaignName?: string;
  createdAt?: any;
}
