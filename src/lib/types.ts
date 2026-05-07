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
  summaryStartDate?: string;
  summaryEndDate?: string;
  // News Ticker Configuration
  isTickerActiveVisible?: boolean;
  isTickerDonationVisible?: boolean;
  isTickerCompletedVisible?: boolean;
  tickerMaxDonations?: number;
  tickerMaxCompleted?: number;
  tickerSkipIds?: string[];
  // Role & Features Toggles
  isDonorLoginEnabled?: boolean;
  isBeneficiaryLoginEnabled?: boolean;
  isDonorSelfRecordPaymentEnabled?: boolean;
  portalAuthMethod?: 'OTP' | 'Password';
  isPortalPasswordEnabled?: boolean;
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

export interface ResourceSettings extends DocumentData {
  // WhatsApp Provider Selection
  activeWhatsAppProvider?: 'whapi' | 'meta';

  // WhatsApp (Whapi) Configuration
  whatsappApiUrl?: string;
  whatsappApiKey?: string;
  isAutoWhatsAppEnabled?: boolean;
  
  // WhatsApp (Meta Cloud API) Configuration
  metaAccessToken?: string;
  metaPhoneNumberId?: string;
  metaWabaId?: string; // WhatsApp Business Account ID

  // Telegram Configuration
  telegramBotToken?: string;
  telegramBotUsername?: string;
  telegramBotId?: string;
  telegramChatId?: string; // Default chat ID for alerts
  isTelegramEnabled?: boolean;
  portalOtpValidityMinutes?: number;
  
  // Email Configuration
  isEmailEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail?: string;
  fromName?: string;

  // Base URLs
  baseUrl?: string;

  // AI & Analytics
  geminiApiKey?: string;
  googleApiKey?: string;

  // Infrastructure (Reference)
  firebaseConfig?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    measurementId?: string;
  };

  // WhatsApp Plan Tracking
  waPlanDetails?: {
    planName: string;
    price: number;
    currency: string;
    expiryDate: string;
    status: 'Active' | 'Expired' | 'Not Purchased';
    usageLimit?: number;
    currentUsage?: number;
  };
}

export interface AppSubscription extends DocumentData {
  id: string;
  resourceName: string; // e.g. "WhatsApp API (Whapi)", "Firebase Storage", "Gemini Pro"
  provider: string;
  planDetails: string;
  price: number;
  currency: string;
  billingCycle: 'Monthly' | 'Yearly' | 'One-time';
  purchaseDate: string;
  expiryDate: string;
  status: 'Active' | 'Expired' | 'Canceled' | 'Pending';
  leadContact?: string; // Person responsible for this resource
  notes?: string;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface InternalFundraising extends DocumentData {
  id: string;
  title: string;
  purpose: string; // e.g. "WhatsApp API Subscription 2026"
  targetAmount: number;
  collectedAmount: number;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Completed' | 'On Hold';
  relatedResourceId?: string; // Link to AppSubscription
  contributions: {
    userId: string;
    userName: string;
    amount: number;
    date: string;
    status: 'Verified' | 'Pending';
  }[];
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface NotificationGroup extends DocumentData {
  id: string;
  name: string;
  type: 'Telegram' | 'WhatsApp';
  channelType: 'Group' | 'Individual';
  targetId?: string; // Telegram Chat ID
  memberIds: string[]; // List of User Profile IDs
  enabledModules: ('leads' | 'campaigns' | 'donations' | 'beneficiaries' | 'users' | 'approvals')[];
  isActive: boolean;
  updatedAt?: Timestamp | FieldValue;
}

export interface MessageTemplate extends DocumentData {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'WhatsApp' | 'Email' | 'SMS' | 'Telegram' | 'MultiChannel';
  category: string;
  profileType?: 'Member' | 'Donor' | 'Beneficiary' | 'Admin' | 'General' | 'All';
  variables: string[]; // e.g. ["name", "recordId", "module", "url"]
  isActive: boolean;
  updatedAt?: Timestamp | FieldValue;
}

export interface MessageLog extends DocumentData {
  id: string;
  recipient: string;
  content: string;
  type: 'WhatsApp' | 'Email' | 'SMS' | 'Telegram';
  status: 'Sent' | 'Failed' | 'Pending';
  error?: string;
  timestamp: Timestamp | FieldValue;
  metadata?: {
    moduleId?: string;
    recordId?: string;
    userId?: string;
    templateId?: string;
    type?: string;
    [key: string]: any;
  };
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
  beneficiaryCount?: number;
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
  showCustomImage?: boolean;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  createdById?: string;
  createdByName?: string;
  updatedById?: string;
  updatedByName?: string;
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
  beneficiaryStats?: {
    total: number;
    given: number;
    pending: number;
    zakatEligible: number;
  };
  allowedDonationTypes?: DonationCategory[];
  showCustomImage?: boolean;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  createdById?: string;
  createdByName?: string;
  updatedById?: string;
  updatedByName?: string;
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
    telegramChatId?: string;
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
    aadhaarNumber?: string;
    aadhaarName?: string;
    aadhaarDob?: string;
    aadhaarGender?: string;
    aadhaarAddress?: string;
    aadhaarProofUrl?: string;
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
    bankDetails?: BankDetail[];
    upiIds?: string[];
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
  phones?: string[]; // Flattened array of all associated phone numbers
  email?: string;
  address?: string;
  telegramChatId?: string;
  aadhaarNumber?: string;
  aadhaarName?: string;
  aadhaarDob?: string;
  aadhaarGender?: string;
  aadhaarAddress?: string;
  aadhaarProofUrl?: string;
  bankDetails?: BankDetail[];
  idProofType?: string;
  idNumber?: string;
  idProofUrl?: string;
  accountNumbers?: string[]; // Flattened for querying
  upiIds?: string[]; // Flattened for querying
  status: 'Active' | 'Inactive';
  notes?: string;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  createdById?: string;
  createdByName?: string;
  updatedById?: string;
  updatedByName?: string;
  panNumber?: string;
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
  receiverUpiId?: string;
  receiverBankDetails?: string;
  amount: number;
  type?: DonationCategory;
  typeSplit: { category: DonationCategory; amount: number, forFundraising?: boolean }[];
  linkSplit?: DonationLink[];
  donationType: 'Cash' | 'Online Payment' | 'Check' | 'Other';
  onlineProvider?: 'Google Pay' | 'PhonePe' | 'Paytm' | 'Amazon Pay' | 'WhatsApp Pay' | 'Bank Transfer' | 'Other';
  referral: string;
  donationDate: string;
  status: 'Verified' | 'Pending' | 'Canceled' | 'Rejected';
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
  updatedById?: string;
  updatedByName?: string;
  updatedAt?: Timestamp | FieldValue;
}

export interface UserProfile extends DocumentData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  loginId: string;
  userKey: string;
  role: 'Admin' | 'User' | 'Donor' | 'Beneficiary';
  status: 'Active' | 'Inactive';
  permissions: UserPermissions;
  createdAt?: Timestamp | FieldValue;
  createdById?: string;
  createdByName?: string;
  idProofType?: string;
  idNumber?: string;
  idProofUrl?: string;
  aadhaarNumber?: string;
  aadhaarName?: string;
  aadhaarDob?: string;
  aadhaarGender?: string;
  aadhaarAddress?: string;
  aadhaarProofUrl?: string;
  organizationGroup?: GroupId | null;
  organizationRole?: string;
  linkedDonorId?: string;
  linkedBeneficiaryId?: string;
  password?: string; // Encrypted/Hashed password for manual login
  telegramChatId?: string; // Telegram Chat ID for individual alerts
  notificationsEnabled?: boolean;
  whatsappNotificationsEnabled?: boolean;
  bankDetails?: BankDetail[];
  upiIds?: string[];
  updatedAt?: Timestamp | FieldValue;
  updatedById?: string;
  updatedByName?: string;
}
 
export interface PendingVerification extends DocumentData {
  id: string;
  targetId: string;
  targetCollection: string;
  revalidatePath: string;
  newValue: any;
  originalValue?: any;
  requestedBy: { id: string, name: string };
  assignedVerifiers: { id: string, name: string, status: 'Pending' | 'Approved' | 'Rejected', updatedAt?: any }[];
  assignedVerifierIds: string[]; // NEW: Indexed array for secure filtering
  status: 'Pending' | 'Partially Approved' | 'Approved' | 'Rejected';
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  module: 'donations' | 'beneficiaries' | 'campaigns' | 'leads' | 'donors' | 'users';
  description?: string;
  requesterComment?: string;
  approverComments?: { 
    verifierId: string, 
    verifierName: string, 
    comment: string, 
    status: 'Approved' | 'Rejected', 
    updatedAt: any 
  }[];
}
 
export interface InAppNotification extends DocumentData {
  id: string;
  userId: string; // Recipient user ID
  title: string;
  body: string;
  module: 'donations' | 'beneficiaries' | 'campaigns' | 'leads' | 'donors' | 'users' | 'approvals' | 'system';
  linkUrl?: string;
  isRead: boolean;
  createdAt: Timestamp | FieldValue;
  metadata?: Record<string, any>;
}

export interface AuditLog extends DocumentData {
  id: string;
  targetId: string;
  targetCollection: string;
  module: 'donations' | 'beneficiaries' | 'campaigns' | 'leads' | 'donors' | 'users';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LINK' | 'UNLINK' | 'SPLIT' | 'MAP' | 'UNMAP' | 'APPROVE' | 'REJECT' | 'OTHER';
  description: string;
  performedBy: { id: string, name: string };
  changes?: { field: string, old: any, new: any }[];
  originalValue?: any;
  newValue?: any;
  timestamp: Timestamp | FieldValue;
  metadata?: any;
}
