export interface BrandColor {
  name: string; // e.g., 'Primary', 'Secondary', 'Accent'
  value: string; // e.g., '#FF0000'
}

export interface BrandColors extends Record<string, string> {}
// Example: { 'Primary': '#FFFFFF', 'Secondary': '#000000' }

export interface BrandFont {
  name: string; // e.g., 'Heading', 'Body', 'Caption'
  family: string; // e.g., 'Arial', 'Roboto'
  weight?: string; // e.g., '400', '700', 'bold'
  style?: string; // e.g., 'normal', 'italic'
}

export interface BrandFonts extends Record<string, Omit<BrandFont, 'name'>> {}
// Example: { 'Heading': { family: 'Inter', weight: '700' }, 'Body': { family: 'Arial' } }

export interface TargetAudienceDemographics {
  age_range?: string;
  gender?: string;
  location?: string;
  occupation?: string;
  income_level?: string;
  // ... other demographic fields
}

export interface TargetAudiencePsychographics {
  interests?: string[];
  lifestyle?: string;
  values?: string[];
  pain_points?: string[];
  // ... other psychographic fields
}

export interface TargetAudienceProfile {
  name: string; // Name for this audience segment, e.g., "Tech Savvy Millennials"
  description?: string;
  demographics?: TargetAudienceDemographics;
  psychographics?: TargetAudiencePsychographics;
  // ... other profile fields
}

export type KeyMessage = string; // Simple for now, could be { id: string, text: string, audience?: string } for more complexity

export interface Competitor {
  id?: string; // Optional, if stored with UUIDs
  name: string;
  website?: string;
  strengths?: string[];
  weaknesses?: string[];
  notes?: string;
  // ... other competitor fields
}

export interface Goal {
  id?: string; // Optional
  name: string;
  description?: string;
  status?: 'To Do' | 'In Progress' | 'On Hold' | 'Complete' | string; // Allow for custom statuses too
  target_date?: string; // ISO date string
  // ... other goal fields
}

// This will be used in ClientDetailsPage.tsx
export interface ClientSpecificTypes {
  brand_colors?: BrandColors | null;
  brand_fonts?: BrandFonts | null;
  target_audience?: TargetAudienceProfile | null; // Changed from target_audience_profiles: TargetAudienceProfile[]
  key_messages?: KeyMessage[] | null;
  competitors?: Competitor[] | null;
  goals?: Goal[] | null;
  ethos?: string[] | null; // Add specific type for ethos
}

// --- Sales Data Types ---
export interface SalesContact {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string | null;
  status: 'Lead' | 'Prospect' | 'Customer' | 'Other' | string; // Allow flexibility
  source?: string | null;
  tags?: string[];
  notes?: string | null;
  lastContactedDate?: string | null; // ISO Date string
  nextFollowUpDate?: string | null; // ISO Date string
  nextFollowUpTask?: string | null;
}

export interface DealActivityLog {
  date: string; // ISO Date string
  activity: string;
}

export interface Deal {
  id: string;
  dealName: string;
  associatedContactId?: string | null;
  associatedCompanyName?: string | null;
  value: number;
  currency: string;
  stage: string; // e.g., 'Discovery', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'
  probability?: number | null; // Percentage
  expectedCloseDate?: string | null; // ISO Date string
  ownerName?: string | null;
  notes?: string | null;
  activityLog?: DealActivityLog[];
}

export interface CrmDataFetched {
  totalContacts: number;
  totalDeals: number;
  recentActivities: number;
}

export interface CrmIntegration {
  isConnected: boolean;
  crmName?: string | null;
  lastSync?: string | null; // ISO Date string
  syncStatus?: string | null;
  dataFetched?: CrmDataFetched | null;
}

export interface SalesActivity {
  id: string;
  type: string; // e.g., 'Email', 'Call', 'Meeting'
  subject?: string | null;
  date: string; // ISO Date string
  associatedContactId?: string | null;
  durationMinutes?: number | null; // For calls/meetings
  notes?: string | null;
}

export interface SalesData {
  contacts?: SalesContact[];
  deals?: Deal[];
  crmIntegration?: CrmIntegration | null;
  activityFeed?: SalesActivity[];
}

// --- Finance Data Types ---
export interface OperatingExpenses {
  marketing: number;
  sales: number;
  rnd: number; // Research & Development
  ga: number;  // General & Administrative
  total: number;
}

export interface FinancialMetricPeriod {
  year: number;
  grossRevenue: number;
  cogs: number; // Cost of Goods Sold
  grossProfit: number;
  operatingExpenses: OperatingExpenses;
  netProfit: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  churnRate: number; // Percentage
  customerLifetimeValue: number;
  customerAcquisitionCost: number;
  currency?: string; // Added currency here
}

export interface FinancialMetricQuarterly extends FinancialMetricPeriod {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | string;
}

export interface KeyFinancialMetrics {
  annual?: FinancialMetricPeriod[];
  quarterly?: FinancialMetricQuarterly[];
  // monthly?: FinancialMetricPeriod[]; // Placeholder if needed
}

export interface MarketingRoi {
  id: string;
  campaignName: string;
  spend: number;
  currency: string;
  leadsAttributed: number;
  customersAttributed: number;
  averageRevenuePerCustomer: number;
  calculatedRoi: string; // e.g., "20.00%"
}

export interface Expense {
  id: string;
  category: string;
  vendor: string;
  amount: number;
  currency: string;
  date: string; // ISO Date string
  notes?: string | null;
  receiptUrl?: string | null;
  recurring?: 'annual' | 'monthly' | 'ad-hoc' | string; // Flexible
}

export interface FinanceData {
  keyMetrics?: KeyFinancialMetrics | null;
  marketingRoi?: MarketingRoi[];
  expenses?: Expense[];
}

// --- HR Data Types ---
export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface Employee {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  employeeId: string;
  jobRoleTitle: string;
  department: string;
  reportingManagerId?: string | null;
  email: string;
  phone?: string | null;
  startDate: string; // ISO Date string
  employmentType: 'Full-time' | 'Part-time' | 'Contract' | string;
  location?: string | null;
  emergencyContact?: EmergencyContact | null;
}

export interface JobRole {
  id: string;
  roleTitle: string;
  responsibilities?: string[];
  skillsQualifications?: string[];
  kpis?: string[]; // Key Performance Indicators
}

export interface PerformanceGoal {
  id: string;
  employeeId: string;
  ownerName?: string | null; // Added from dummy data
  description: string;
  dueDate: string; // ISO Date string
  status: 'To Do' | 'In Progress' | 'On Track' | 'Completed' | 'Blocked' | string;
  progress?: number | null; // Percentage
}

export interface PerformanceFeedback {
  id: string;
  fromEmployeeId: string;
  fromEmployeeName?: string; // Added from dummy data
  toEmployeeId: string;
  toEmployeeName?: string; // Added from dummy data
  date: string; // ISO Date string
  feedbackText: string;
  type: 'Positive' | 'Constructive' | 'Neutral' | string;
  visibility?: 'Public' | 'ManagerOnly' | 'Private' | string;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName?: string; // Added from dummy data
  reviewerId: string;
  reviewerName?: string; // Added from dummy data
  date: string; // ISO Date string
  period: string; // e.g., "H1 2024"
  overallRating: number; // e.g., 1-5 scale
  summary: string;
}

export interface PerformanceManagement {
  goals?: PerformanceGoal[];
  feedback?: PerformanceFeedback[];
  reviews?: PerformanceReview[];
}

export interface HrDocument {
  id: string;
  docName: string;
  type: string; // e.g., 'Offer Letter', 'Policy'
  uploadDate: string; // ISO Date string
  fileUrl: string;
  version?: number | string;
  tags?: string[];
}

export interface HrTemplate {
  id: string;
  templateName: string;
  category: string;
  lastUpdated: string; // ISO Date string
  description?: string | null;
}

export interface OnboardingTask {
  taskId: string;
  task: string;
  status: 'To Do' | 'In Progress' | 'Completed' | string;
  assigneeId?: string | null;
  assigneeName?: string | null; // If displaying name
  dueDate?: string | null; // ISO Date string
}

export interface OnboardingChecklist {
  id: string;
  checklistName: string;
  employeeId?: string | null;
  employeeName?: string | null; // Added from dummy data
  status: 'Pending' | 'In Progress' | 'Completed' | string;
  items?: OnboardingTask[];
}

export interface HrData {
  employees?: Employee[];
  jobRoles?: JobRole[];
  performance?: PerformanceManagement | null;
  documents?: HrDocument[];
  templates?: HrTemplate[];
  onboardingChecklists?: OnboardingChecklist[];
}

// --- Technology Data Types ---
export interface TechnologyInventoryItem {
  id: string;
  technologyName: string;
  vendor?: string | null;
  category: string;
  purpose?: string | null;
  usersLicenses?: string | null; // e.g., "Project-wide", "3 Designer Seats", "50 Licenses"
  subscriptionTier?: string | null;
  cost: number;
  costFrequency: 'month' | 'year' | 'user/month' | string; // Flexible
  currency?: string; // Added currency
  renewalDate?: string | null; // ISO Date string
  ownerName?: string | null;
  notes?: string | null;
}

export interface TechnologyUsageAdoption {
  toolId: string; // Corresponds to id in TechnologyInventoryItem
  toolName: string;
  activeUsersPercent?: number | null;
  keyFeaturesUsed?: string[];
  underutilizedFeatures?: string[];
  lastReviewDate?: string | null; // ISO Date string
}

export interface TechnologyIntegration {
  id: string;
  name: string;
  tool1Name: string;
  tool2Name: string;
  status: 'Active' | 'Inactive' | 'Pending' | string;
  description?: string | null;
  type: 'API' | 'OAuth App' | 'Webhook' | string; // Flexible
  lastChecked?: string | null; // ISO Date string
}

export interface TechnologyCompliance {
  techId: string; // Corresponds to id in TechnologyInventoryItem
  technologyName: string;
  complianceStandardsMet?: string[]; // e.g., 'SOC2 Type 2', 'GDPR'
  dataResidencyOptions?: string[];
  notes?: string | null;
}

export interface TechnologyData {
  inventory?: TechnologyInventoryItem[];
  usageAdoption?: TechnologyUsageAdoption[];
  integrations?: TechnologyIntegration[];
  compliance?: TechnologyCompliance[];
}

// --- Operations Data Types ---
export interface OperationalKeyMetric {
  id: string;
  metricName: string;
  currentValue: number | string; // Can be numeric or textual (e.g. "N/A")
  targetValue?: number | string | null;
  unit: string;
  period: string; // e.g., "Q2 2024", "June 2024"
  trend?: 'improving' | 'stable' | 'needs_attention' | string;
  notes?: string | null;
}

export interface SopStep {
  stepNumber: number;
  description: string;
  status?: 'Documented' | 'In Review' | 'Implemented' | string;
  responsibleRole?: string | null;
}

export interface StandardOperatingProcedure {
  id: string;
  sopName: string;
  department?: string | null;
  version?: string | number;
  lastUpdated: string; // ISO Date string
  ownerName?: string | null;
  steps?: SopStep[];
}

export interface ProjectTask {
  taskId: string;
  taskName: string;
  assigneeName?: string | null;
  status: 'To Do' | 'In Progress' | 'Completed' | 'Blocked' | string;
  deadline?: string | null; // ISO Date string
}

export interface Project {
  id: string;
  projectName: string;
  status: 'Planning' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled' | string;
  overallProgress?: number | null; // Percentage
  dueDate?: string | null; // ISO Date string
  ownerName?: string | null;
  team?: string[]; // Array of names or IDs
  budget?: number | null;
  currency?: string | null;
  tasks?: ProjectTask[];
}

export interface OperationsData {
  keyMetrics?: OperationalKeyMetric[];
  sops?: StandardOperatingProcedure[];
  projects?: Project[];
} 