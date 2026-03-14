import type { DocumentData, Timestamp, FieldValue } from 'firebase/firestore';
import type { UserPermissions, GroupId, PriorityLevel } from './modules';
import { donationCategories } from './modules';

export type DonationCategory = typeof donationCategories[number];

export interface BrandingSettings extends DocumentData {
  name?: string;
  logoUrl?: string;
  loadingAnimationUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  heroTitle?: string;
  heroDescription?: string;
  isHeroVisible?: boolean;
  isNewsTickerVisible?: boolean;
  isWisdomVisible?: boolean;
  isOverallSummaryVisible?: boolean;
  isDonationSummaryVisible?: boolean;
  isPurposeSummaryVisible?: boolean;
  isInitiativeSummaryVisible?: boolean;
  isRecentVerificationVisible?: boolean;
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
  // Bank Details
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
}

export interface InfoSettings extends DocumentData {
  isDonationInfoPublic?: boolean;
  isGuidingPrinciplesPublic?: boolean;
  isGuidanceDirectoryPublic?: boolean;
}

export interface ExternalResource {
  id: string;
  name: string;
  subtitle?: string; // e.g. Doctor name, type of NGO
  description?: string;
  phone?: string;
  address?: string;
  link?: string;
  isHidden?: boolean;
}

export interface ResourceCategory {
  id: string;
  name: string;
  description?: string;
  resources: ExternalResource[];
}

export interface GuidanceData extends DocumentData {
  title: string;
  description: string;
  categories: ResourceCategory[];
  isPublic?: boolean;
}

export interface UseCase {
  id: string;
  title: string;
  description: string;
  isAllowed: boolean;
  isHidden?: boolean;
  quranVerse?: string;
  quranSource?: string;
}

export interface QAItem {
  id: string;
  question: string;
  answer: string;
  reference?: string;
  isHidden?: boolean;
  quranVerse?: string;
  quranSource?: string;
}

export interface DonationTypeInfo {
  id: string;
  title: string;
  description: string;
  quranVerse?: string;
  quranSource?: string;
  purposePoints?: string[];
  useCasesHeading?: string;
  useCases: UseCase[];
  qaItems: QAItem[];
  usage: string;
  restrictions?: string;
  imageUrl?: string;
  imageUrlFilename?: string;
  // Visibility Flags
  hideKeyHighlights?: boolean;
  hideUseCases?: boolean;
  hideQA?: boolean;
  hideUsage?: boolean;
  hideRestrictions?: boolean;
}

export interface DonationInfoData extends DocumentData {
  types: DonationTypeInfo[];
}

export interface GuidingPrinciple {
  id: string;
  text: string;
  isHidden?: boolean;
}

export interface FocusArea {
  id: string;
  title: string;
  description: string;
  icon: 'Education' | 'Healthcare' | 'Relief' | 'Other';
  isHidden?: boolean;
}

export interface GuidingPrinciplesData extends DocumentData {
  title: string;
  description: string;
  principles: GuidingPrinciple[];
  focusAreas?: FocusArea[];
  isGuidingPrinciplesPublic?: boolean;
}

export interface CampaignDocument {
  name: string;
  url: string;
  uploadedAt: string;
  isPublic?: boolean;
}

export interface RationItem {
  id: string;
  name: string;
  quantity: number;
  quantityType?: string;
  price: number;
  notes: string;
}

export interface ItemCategory {
  id: string;
  name: string;
  minMembers?: number;
  maxMembers?: number;
  items: RationItem[];
}

export interface Campaign extends DocumentData {
  id: string;
  campaignNumber?: number;
  name: string;
  imageUrl?: string;
  imageUrlFilename?: string;
  category: 'Ration' | 'Relief' | 'General';
  description?: string;
  targetAmount?: number;
  startDate: string;
  endDate: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  priority?: PriorityLevel;
  authenticityStatus?: 'Pending Verification' | 'Verified' | 'Rejected' | 'On Hold' | 'Need More Details';
  publicVisibility?: 'Hold' | 'Ready to Publish' | 'Published';
  priceDate: string;
  shopName: string;
  shopContact: string;
  shopAddress: string;
  documents?: CampaignDocument[];
  itemCategories: ItemCategory[];
  allowedDonationTypes?: DonationCategory[];
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  createdById?: string;
  createdByName?: string;
}

export interface Lead extends DocumentData {
  id: string;
  leadNumber?: number;
  name: string;
  imageUrl?: string;
  imageUrlFilename?: string;
  purpose: 'Relief' | 'General' | 'Education' | 'Medical' | 'Other';
  category: string;
  purposeDetails?: string;
  categoryDetails?: string;
  description?: string;
  notes?: string;
  targetAmount?: number;
  requiredAmount?: number;
  startDate: string;
  endDate: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  priority?: PriorityLevel;
  authenticityStatus?: 'Pending Verification' | 'Verified' | 'Rejected' | 'On Hold' | 'Need More Details';
  publicVisibility?: 'Hold' | 'Ready to Publish' | 'Published';
  priceDate: string;
  shopName: string;
  shopContact: string;
  shopAddress: string;
  documents?: CampaignDocument[];
  itemCategories: ItemCategory[];
  allowedDonationTypes?: DonationCategory[];
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  createdById?: string;
  createdByName?: string;
  // Education fields
  degree?: string;
  year?: string;
  semester?: string;
  // Medical fields
  diseaseIdentified?: string;
  diseaseStage?: string;
  seriousness?: 'High' | 'Moderate' | 'Low' | null;
}

export interface Beneficiary extends DocumentData {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    occupation?: string;
    age?: number;
    members?: number;
    earningMembers?: number;
    male?: number;
    female?: number;
    addedDate: string;
    idProofType?: string;
    idNumber?: string;
    referralBy?: string;
    kitAmount?: number;
    /**
     * In Master List: Represents Verification Status (Pending, Verified, etc.)
     * In Initiative Subcollection: Represents Disbursement Status (Pending, Verified, Given)
     */
    status?: 'Given' | 'Pending' | 'Hold' | 'Need More Details' | 'Verified';
    /**
     * Specifically tracks the Master Profile verification status within an initiative list.
     */
    verificationStatus?: 'Pending' | 'Hold' | 'Need More Details' | 'Verified';
    idProofUrl?: string;
    idProofFilename?: string;
    idProofIsPublic?: boolean;
    notes?: string;
    isEligibleForZakat?: boolean;
    zakatAllocation?: number;
    itemCategoryId?: string;
    itemCategoryName?: string;
    createdAt?: Timestamp | FieldValue;
    createdById?: string;
    createdByName?: string;
    updatedAt?: Timestamp | FieldValue;
    updatedById?: string;
    updatedByName?: string;
}

export interface BankDetail {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

export interface Donor extends DocumentData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  bankDetails?: BankDetail[];
  accountNumbers?: string[]; // Flattened for querying
  upiIds?: string[]; // Flattened for querying
  status: 'Active' | 'Inactive';
  notes?: string;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  createdById?: string;
  createdByName?: string;
}

export interface DonationLink {
  linkId: string;
  linkName: string;
  linkType: 'campaign' | 'lead' | 'general';
  amount: number;
}

export interface TransactionDetail {
  id: string;
  amount: number;
  transactionId?: string;
  screenshotUrl?: string;
  screenshotFilename?: string;
  screenshotIsPublic?: boolean;
  date?: string;
  upiId?: string;
}

export interface Donation extends DocumentData {
  id: string;
  donorName: string;
  donorPhone: string;
  donorId?: string; // Linked Donor Profile ID
  receiverName: string;
  amount: number;
  type?: DonationCategory;
  typeSplit: { category: DonationCategory; amount: number, forFundraising?: boolean }[];
  linkSplit?: DonationLink[];
  donationType: 'Cash' | 'Online Payment' | 'Check' | 'Other';
  referral: string;
  donationDate: string;
  status: 'Verified' | 'Pending' | 'Canceled';
  comments?: string;
  suggestions?: string;
  uploadedBy: string;
  uploadedById: string;
  createdAt?: Timestamp | FieldValue;
  transactions?: TransactionDetail[];
  campaignId?: string;
  campaignName?: string;
  contributionFromDate?: string;
  contributionToDate?: string;
}

export interface UserProfile extends DocumentData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  loginId: string;
  userKey: string;
  role: 'Admin' | 'User';
  status: 'Active' | 'Inactive';
  permissions: UserPermissions;
  createdAt?: Timestamp | FieldValue;
  createdById?: string;
  createdByName?: string;
  idProofType?: string;
  idNumber?: string;
  idProofUrl?: string;
  organizationGroup?: GroupId | null;
  organizationRole?: string;
}
