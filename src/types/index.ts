// Core User and Authentication Types
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  must_change_password?: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  THERAPIST = 'therapist',
  STAFF = 'staff',
  CLIENT = 'client'
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Patient/Client Types
export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  email: string;
  phone: string;
  address: Address;
  emergencyContact: EmergencyContact;
  insuranceInfo: InsuranceInfo;
  medicalHistory: string;
  allergies: string[];
  medications: Medication[];
  assignedTherapist?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  groupNumber?: string;
  copay?: number;
  deductible?: number;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  startDate: Date;
  endDate?: Date;
}

// Session Invitation Types
export interface SessionInvitation {
  id: string;
  sessionId: string;
  patientId: string;
  therapistId: string;
  invitedAt: Date;
  expiresAt: Date;
  status: InvitationStatus;
  sessionDetails: {
    title: string;
    description?: string;
    scheduledFor: Date;
    estimatedDuration: number; // minutes
  };
  invitationLink: string;
  accessCode?: string;
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface PatientSessionInfo {
  patient: Patient;
  activeInvitation?: SessionInvitation;
  lastSession?: Date;
  upcomingAppointments: Appointment[];
  canStartSession: boolean;
  sessionHistory: SessionSummary[];
}

export interface SessionInitiationRequest {
  patientId: string;
  therapistId: string;
  title: string;
  description?: string;
  estimatedDuration?: number; // minutes
  notifyPatient?: boolean;
  requiresConfirmation?: boolean;
}

// Appointment Types
export interface Appointment {
  id: string;
  patientId: string;
  therapistId: string;
  startTime: Date;
  endTime: Date;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
  telehealthLink?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum AppointmentType {
  INITIAL_CONSULTATION = 'initial_consultation',
  THERAPY_SESSION = 'therapy_session',
  FOLLOW_UP = 'follow_up',
  GROUP_THERAPY = 'group_therapy',
  TELEHEALTH = 'telehealth',
  ASSESSMENT = 'assessment'
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled'
}

// SOAP Note Types
export interface SOAPNote {
  id: string;
  patientId: string;
  therapistId: string;
  appointmentId?: string;
  date: Date;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  signature?: string;
  signatureDate?: Date;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Billing Types
export interface Invoice {
  id: string;
  patientId: string;
  appointmentId?: string;
  invoiceNumber: string;
  date: Date;
  dueDate: Date;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  paymentDate?: Date;
  paymentMethod?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  cptCode?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export interface Claim {
  id: string;
  patientId: string;
  invoiceId: string;
  claimNumber: string;
  insuranceProvider: string;
  submissionDate: Date;
  status: ClaimStatus;
  amount: number;
  approvedAmount?: number;
  denialReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ClaimStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  PAID = 'paid'
}

// Message Types
export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  threadId: string;
  subject: string;
  content: string;
  attachments: MessageAttachment[];
  isRead: boolean;
  isEncrypted: boolean;
  sentAt: Date;
  readAt?: Date;
}

export interface MessageThread {
  id: string;
  participants: string[];
  subject: string;
  lastMessage?: Message;
  lastActivity: Date;
  isArchived: boolean;
  createdAt: Date;
}

export interface MessageAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isEncrypted: boolean;
  uploadedAt: Date;
}

// Audit Types
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Dashboard Types
export interface DashboardStats {
  totalPatients: number;
  appointmentsToday: number;
  pendingClaims: number;
  unreadMessages: number;
  revenue: {
    thisMonth: number;
    lastMonth: number;
    percentChange: number;
  };
}

// Form Types
export interface LoginForm {
  username: string;
  password: string;
}

export interface PatientForm {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: Address;
  emergencyContact: EmergencyContact;
  insuranceInfo: InsuranceInfo;
}

export interface AppointmentForm {
  patientId: string;
  therapistId: string;
  startTime: string;
  endTime: string;
  type: AppointmentType;
  notes?: string;
}

// Telehealth Types
export interface SessionDetails {
  id: number;
  title: string;
  room_id: string;
  session_url: string;
  patient_details: {
    id: number;
    first_name: string;
    last_name: string;
  };
  therapist_details: {
    id: number;
    first_name: string;
    last_name: string;
  };
  status: string;
  duration: number;
}

export interface TelehealthSession {
  id: string;
  appointmentId: string;
  roomId: string;
  sessionUrl: string;
  status: TelehealthStatus;
  participants: SessionParticipant[];
  startedAt?: Date;
  endedAt?: Date;
  scheduledDuration: number; // minutes
  actualDuration?: number; // minutes
  platform: TelehealthPlatform;
  features: SessionFeatures;
  recording: RecordingSettings;
  chat: ChatSettings;
  security: SecuritySettings;
  quality: QualityMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export enum TelehealthStatus {
  SCHEDULED = 'scheduled',
  WAITING_ROOM = 'waiting_room',
  CONNECTING = 'connecting',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

export enum TelehealthPlatform {
  WEBRTC = 'webrtc',
  ZOOM = 'zoom',
  TEAMS = 'teams',
  GOOGLE_MEET = 'google_meet',
  CUSTOM = 'custom'
}

export interface SessionParticipant {
  id: string;
  userId: string;
  userName: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joinedAt?: Date;
  leftAt?: Date;
  connectionQuality: ConnectionQuality;
  permissions: ParticipantPermissions;
  devices: DeviceInfo;
}

export enum ParticipantRole {
  HOST = 'host',
  THERAPIST = 'therapist',
  PATIENT = 'patient',
  OBSERVER = 'observer',
  SUPERVISOR = 'supervisor'
}

export enum ParticipantStatus {
  INVITED = 'invited',
  WAITING = 'waiting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  LEFT = 'left',
  REMOVED = 'removed'
}

export enum ConnectionQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  FAILED = 'failed'
}

export interface ParticipantPermissions {
  canShareScreen: boolean;
  canUseCamera: boolean;
  canUseMicrophone: boolean;
  canChat: boolean;
  canRecord: boolean;
  canInviteOthers: boolean;
  canControlSession: boolean;
  canMuteParticipants: boolean;
  canRemoveParticipants: boolean;
  canStartBreakoutRooms: boolean;
  canLockSession: boolean;
  canEndSession: boolean;
  canControlRecording: boolean;
  canViewAllChats: boolean;
  canModerateChat: boolean;
  canAssignRoles: boolean;
}

export interface DeviceInfo {
  camera: MediaDeviceInfo | null;
  microphone: MediaDeviceInfo | null;
  speakers: MediaDeviceInfo | null;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  speakersEnabled: boolean;
}

export interface SessionFeatures {
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenSharingEnabled: boolean;
  chatEnabled: boolean;
  recordingEnabled: boolean;
  whiteboardEnabled: boolean;
  fileShareEnabled: boolean;
  breakoutRoomsEnabled: boolean;
  waitingRoomEnabled: boolean;
}

export interface RecordingSettings {
  enabled: boolean;
  autoStart: boolean;
  includeAudio: boolean;
  includeVideo: boolean;
  includeScreenShare: boolean;
  includeChat: boolean;
  storageLocation: StorageLocation;
  retention: RecordingRetention;
  downloadUrl?: string;
  fileSize?: number;
  duration?: number;
}

export enum StorageLocation {
  LOCAL = 'local',
  CLOUD = 'cloud',
  SECURE_SERVER = 'secure_server'
}

export interface RecordingRetention {
  days: number;
  autoDelete: boolean;
  notifyBeforeDelete: boolean;
}

// Enhanced Recording and Transcription Types
export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  startTime?: Date;
  pausedDuration: number; // in milliseconds
  currentDuration: number; // in milliseconds
  filePath?: string;
  fileSize: number; // in bytes
  quality: RecordingQuality;
}

export enum RecordingQuality {
  LOW = 'low',      // 480p, 32kbps audio
  MEDIUM = 'medium', // 720p, 64kbps audio
  HIGH = 'high',    // 1080p, 128kbps audio
  ULTRA = 'ultra'   // 4K, 256kbps audio
}

export interface TranscriptionSettings {
  enabled: boolean;
  autoStart: boolean;
  language: string;
  realTimeTranscription: boolean;
  speakerIdentification: boolean;
  confidenceThreshold: number; // 0.0 to 1.0
  customVocabulary: string[];
  medicalTermsEnabled: boolean;
  punctuationEnabled: boolean;
  profanityFilter: boolean;
  saveTranscript: boolean;
  provider: TranscriptionProvider;
}

export enum TranscriptionProvider {
  AZURE_SPEECH = 'azure_speech',
  GOOGLE_CLOUD = 'google_cloud',
  AWS_TRANSCRIBE = 'aws_transcribe',
  OPENAI_WHISPER = 'openai_whisper',
  BUILT_IN = 'built_in'
}

export interface TranscriptionState {
  isTranscribing: boolean;
  currentText: string;
  confidence: number;
  speaker?: string;
  timestamp: Date;
  language: string;
  wordCount: number;
}

export interface TranscriptEntry {
  id: string;
  sessionId: string;
  speakerId?: string;
  speakerName?: string;
  text: string;
  confidence: number;
  startTime: Date;
  endTime: Date;
  duration: number; // in milliseconds
  isInterim: boolean; // true for partial, false for final
  keywords: string[];
  sentiment?: TranscriptSentiment;
}

export interface TranscriptSentiment {
  score: number; // -1.0 (negative) to 1.0 (positive)
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface SessionTranscript {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalDuration: number;
  participants: TranscriptParticipant[];
  entries: TranscriptEntry[];
  summary?: TranscriptSummary;
  keywords: string[];
  wordCount: number;
  speakingTime: { [participantId: string]: number }; // milliseconds per participant
}

export interface TranscriptParticipant {
  id: string;
  name: string;
  role: ParticipantRole;
  voiceProfile?: VoiceProfile;
  speakingTime: number; // in milliseconds
  wordCount: number;
}

export interface VoiceProfile {
  id: string;
  participantId: string;
  characteristics: {
    pitch: number;
    tone: number;
    pace: number;
    volume: number;
  };
  isCalibrated: boolean;
  accuracy: number; // 0.0 to 1.0
}

export interface TranscriptSummary {
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  followUpTasks: string[];
  overallSentiment: TranscriptSentiment;
  topicAnalysis: TopicAnalysis[];
  therapeuticInsights?: TherapeuticInsights;
}

export interface TopicAnalysis {
  topic: string;
  relevance: number; // 0.0 to 1.0
  timeSpent: number; // milliseconds
  sentiment: TranscriptSentiment;
  keywords: string[];
}

export interface TherapeuticInsights {
  sessionType: string;
  patientEngagement: number; // 0.0 to 1.0
  therapeuticProgress: string[];
  concernsRaised: string[];
  goalsDiscussed: string[];
  nextSteps: string[];
  riskFactors: string[];
}

export interface RecordingControls {
  canStart: boolean;
  canStop: boolean;
  canPause: boolean;
  canResume: boolean;
  canDelete: boolean;
  canDownload: boolean;
  canShare: boolean;
  canTranscribe: boolean;
}

export interface ChatSettings {
  enabled: boolean;
  allowPrivateMessages: boolean;
  allowFileSharing: boolean;
  moderationEnabled: boolean;
  saveHistory: boolean;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  isPrivate: boolean;
  recipientId?: string;
  attachments: ChatAttachment[];
}

export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  IMAGE = 'image',
  SYSTEM = 'system'
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
}

export interface SecuritySettings {
  encryptionEnabled: boolean;
  passwordProtected: boolean;
  waitingRoomEnabled: boolean;
  allowAnonymousJoin: boolean;
  requireApproval: boolean;
  sessionLockEnabled: boolean;
  endToEndEncryption: boolean;
  complianceLevel: ComplianceLevel;
}

export enum ComplianceLevel {
  BASIC = 'basic',
  HIPAA = 'hipaa',
  SOC2 = 'soc2',
  GDPR = 'gdpr'
}

export interface QualityMetrics {
  videoQuality: VideoQuality;
  audioQuality: AudioQuality;
  connectionStability: number; // 0-100
  latency: number; // milliseconds
  bandwidth: BandwidthInfo;
  packetLoss: number; // percentage
  jitter: number; // milliseconds
}

export interface AudioQuality {
  bitrate: number;
  sampleRate: number;
  channels: number;
  codec: string;
}

export interface BandwidthInfo {
  upload: number; // kbps
  download: number; // kbps
  available: number; // kbps
}

export interface WaitingRoom {
  enabled: boolean;
  maxWaitTime: number; // minutes
  welcomeMessage?: string;
  musicEnabled: boolean;
  participantsList: WaitingParticipant[];
}

export interface WaitingParticipant {
  id: string;
  name: string;
  joinedAt: Date;
  status: WaitingStatus;
}

export enum WaitingStatus {
  WAITING = 'waiting',
  APPROVED = 'approved',
  DENIED = 'denied'
}

export interface BreakoutRoom {
  id: string;
  name: string;
  participants: string[];
  isOpen: boolean;
  createdAt: Date;
  duration?: number; // minutes
}

export interface TelehealthTechnicalCheck {
  id: string;
  userId: string;
  timestamp: Date;
  browserInfo: BrowserInfo;
  deviceCapabilities: DeviceCapabilities;
  networkTest: NetworkTest;
  overallStatus: TechnicalStatus;
  recommendations: string[];
}

export interface BrowserInfo {
  name: string;
  version: string;
  webRtcSupported: boolean;
  webCamSupported: boolean;
  microphoneSupported: boolean;
  screenShareSupported: boolean;
}

export interface DeviceCapabilities {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  permissions: MediaPermissions;
}

export interface MediaPermissions {
  camera: PermissionState;
  microphone: PermissionState;
  screenShare: PermissionState;
}

export enum PermissionState {
  GRANTED = 'granted',
  DENIED = 'denied',
  PROMPT = 'prompt',
  UNKNOWN = 'unknown'
}

export interface NetworkTest {
  downloadSpeed: number; // mbps
  uploadSpeed: number; // mbps
  latency: number; // ms
  jitter: number; // ms
  packetLoss: number; // percentage
  connectionType: string;
}

export enum TechnicalStatus {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  FAILED = 'failed'
}

// Session Control Types for Therapists and Admins
export interface SessionControl {
  sessionId: string;
  controllerId: string;
  controllerRole: ParticipantRole;
  actions: SessionAction[];
  policies: SessionPolicy;
  moderationTools: ModerationTools;
}

export interface SessionAction {
  id: string;
  type: SessionActionType;
  targetId?: string; // participant ID if action targets specific participant
  parameters?: unknown;
  timestamp: Date;
  performedBy: string;
  reason?: string;
}

export enum SessionActionType {
  // Participant Management
  MUTE_PARTICIPANT = 'mute_participant',
  UNMUTE_PARTICIPANT = 'unmute_participant',
  DISABLE_VIDEO = 'disable_video',
  ENABLE_VIDEO = 'enable_video',
  REMOVE_PARTICIPANT = 'remove_participant',
  ADMIT_FROM_WAITING = 'admit_from_waiting',
  SEND_TO_WAITING = 'send_to_waiting',
  ASSIGN_ROLE = 'assign_role',
  
  // Session Management  
  START_SESSION = 'start_session',
  END_SESSION = 'end_session',
  PAUSE_SESSION = 'pause_session',
  RESUME_SESSION = 'resume_session',
  LOCK_SESSION = 'lock_session',
  UNLOCK_SESSION = 'unlock_session',
  EXTEND_SESSION = 'extend_session',
  
  // Recording Control
  START_RECORDING = 'start_recording',
  STOP_RECORDING = 'stop_recording',
  PAUSE_RECORDING = 'pause_recording',
  RESUME_RECORDING = 'resume_recording',
  
  // Breakout Rooms
  CREATE_BREAKOUT = 'create_breakout',
  CLOSE_BREAKOUT = 'close_breakout',
  ASSIGN_TO_BREAKOUT = 'assign_to_breakout',
  
  // Screen Sharing
  ALLOW_SCREEN_SHARE = 'allow_screen_share',
  STOP_SCREEN_SHARE = 'stop_screen_share',
  
  // Chat Moderation
  DISABLE_CHAT = 'disable_chat',
  ENABLE_CHAT = 'enable_chat',
  DELETE_MESSAGE = 'delete_message',
  WARN_PARTICIPANT = 'warn_participant',
  
  // Technical Control
  FORCE_RECONNECT = 'force_reconnect',
  ADJUST_QUALITY = 'adjust_quality'
}

export interface SessionPolicy {
  autoAdmitFromWaiting: boolean;
  allowPatientScreenShare: boolean;
  allowPatientRecording: boolean;
  requireTherapistApproval: boolean;
  maxSessionDuration: number; // minutes
  chatModeration: ChatModerationLevel;
  recordingPolicy: RecordingPolicy;
  participantLimits: ParticipantLimits;
}

export enum ChatModerationLevel {
  NONE = 'none',
  FILTER_PROFANITY = 'filter_profanity',
  THERAPIST_APPROVAL = 'therapist_approval',
  DISABLED = 'disabled'
}

export enum RecordingPolicy {
  DISABLED = 'disabled',
  THERAPIST_ONLY = 'therapist_only',
  WITH_CONSENT = 'with_consent',
  AUTOMATIC = 'automatic'
}

export interface ParticipantLimits {
  maxTotal: number;
  maxObservers: number;
  allowGuests: boolean;
}

export interface ModerationTools {
  participantControls: ParticipantControls[];
  sessionSettings: SessionSettings;
  recordingControls: RecordingControls;
  qualityMonitoring: QualityMonitoring;
  emergencyControls: EmergencyControls;
}

export interface ParticipantControls {
  participantId: string;
  canMute: boolean;
  canDisableVideo: boolean;
  canRemove: boolean;
  canSendToWaiting: boolean;
  canAssignRole: boolean;
  canViewPrivateInfo: boolean;
}

export interface SessionSettings {
  canLockSession: boolean;
  canEndSession: boolean;
  canExtendTime: boolean;
  canControlRecording: boolean;
  canManageBreakouts: boolean;
  canModifyPermissions: boolean;
}

export interface RecordingControls {
  canStart: boolean;
  canStop: boolean;
  canPause: boolean;
  canDelete: boolean;
  canDownload: boolean;
  canShareLink: boolean;
  retentionPeriod: number; // days
}

export interface QualityMonitoring {
  canViewAllStats: boolean;
  canForceReconnect: boolean;
  canAdjustQuality: boolean;
  canKickLowQuality: boolean;
  autoOptimization: boolean;
}

export interface EmergencyControls {
  canImmediateEnd: boolean;
  canEmergencyMute: boolean;
  canLockdown: boolean;
  canContactSecurity: boolean;
  emergencyContacts: EmergencyContact[];
}

export interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
  emailAddress: string;
  priority: number;
}

// Therapist Session Dashboard
export interface TherapistDashboard {
  activeSession: TelehealthSession | null;
  upcomingSessions: TelehealthSession[];
  sessionHistory: SessionSummary[];
  patientConnections: PatientConnection[];
  alerts: SessionAlert[];
  tools: TherapistTools;
}

export interface SessionSummary {
  sessionId: string;
  patientName: string;
  duration: number;
  quality: ConnectionQuality;
  recordingAvailable: boolean;
  notes: string;
  outcome: SessionOutcome;
  date: Date;
}

export enum SessionOutcome {
  COMPLETED = 'completed',
  CANCELLED_THERAPIST = 'cancelled_therapist',
  CANCELLED_PATIENT = 'cancelled_patient',
  TECHNICAL_ISSUES = 'technical_issues',
  NO_SHOW = 'no_show',
  INTERRUPTED = 'interrupted'
}

export interface PatientConnection {
  patientId: string;
  patientName: string;
  connectionQuality: ConnectionQuality;
  deviceStatus: DeviceStatus;
  waitingTime?: number; // minutes
  needsAssistance: boolean;
}

export interface DeviceStatus {
  camera: DeviceState;
  microphone: DeviceState;
  speakers: DeviceState;
  browser: BrowserCompatibility;
}

export enum DeviceState {
  WORKING = 'working',
  ISSUES = 'issues',
  UNAVAILABLE = 'unavailable',
  TESTING = 'testing'
}

export enum BrowserCompatibility {
  FULLY_SUPPORTED = 'fully_supported',
  PARTIALLY_SUPPORTED = 'partially_supported',
  NOT_SUPPORTED = 'not_supported',
  OUTDATED = 'outdated'
}

export interface SessionAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  participantId?: string;
  timestamp: Date;
  acknowledged: boolean;
  autoResolve: boolean;
}

export enum AlertType {
  CONNECTION_ISSUE = 'connection_issue',
  AUDIO_PROBLEM = 'audio_problem',
  VIDEO_PROBLEM = 'video_problem',
  PARTICIPANT_LEFT = 'participant_left',
  RECORDING_FAILED = 'recording_failed',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  SESSION_TIMEOUT = 'session_timeout',
  EMERGENCY = 'emergency'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TherapistTools {
  canControlAllParticipants: boolean;
  canAccessRecordings: boolean;
  canViewAnalytics: boolean;
  canScheduleSessions: boolean;
  canInviteCollaborators: boolean;
  emergencyProtocols: EmergencyProtocol[];
}

export interface EmergencyProtocol {
  name: string;
  description: string;
  triggers: string[];
  actions: string[];
  contacts: string[];
}

// Document Types
export interface Document {
  id: string;
  patientId: string;
  uploadedBy: string;
  category: DocumentCategory;
  type: DocumentType;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isEncrypted: boolean;
  isPatientVisible: boolean;
  requiresSignature: boolean;
  signatureStatus?: SignatureStatus;
  signedAt?: Date;
  signedBy?: string;
  tags: string[];
  metadata: DocumentMetadata;
  accessLog: DocumentAccess[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum DocumentCategory {
  TREATMENT_PLAN = 'treatment_plan',
  ASSESSMENT = 'assessment',
  CONSENT_FORM = 'consent_form',
  INSURANCE = 'insurance',
  INTAKE_FORM = 'intake_form',
  PROGRESS_NOTE = 'progress_note',
  DISCHARGE_SUMMARY = 'discharge_summary',
  LAB_RESULT = 'lab_result',
  PRESCRIPTION = 'prescription',
  REFERRAL = 'referral',
  EDUCATIONAL = 'educational',
  LEGAL = 'legal',
  OTHER = 'other'
}

export enum DocumentType {
  PDF = 'pdf',
  WORD = 'word',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  FORM = 'form',
  SPREADSHEET = 'spreadsheet',
  TEXT = 'text'
}

export enum SignatureStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

export interface DocumentMetadata {
  version: number;
  lastModifiedBy?: string;
  checksum: string;
  originalFileName: string;
  compressionType?: string;
  pageCount?: number;
  duration?: number; // for audio/video files
  resolution?: string; // for images/videos
}

export interface DocumentAccess {
  id: string;
  userId: string;
  userName: string;
  action: DocumentAction;
  ipAddress: string;
  userAgent: string;
  accessedAt: Date;
}

export enum DocumentAction {
  VIEWED = 'viewed',
  DOWNLOADED = 'downloaded',
  PRINTED = 'printed',
  SHARED = 'shared',
  UPDATED = 'updated',
  DELETED = 'deleted'
}

export interface DocumentShare {
  id: string;
  documentId: string;
  sharedBy: string;
  sharedWith: string[];
  shareType: ShareType;
  expiresAt?: Date;
  accessCount: number;
  maxAccessCount?: number;
  message?: string;
  createdAt: Date;
}

export enum ShareType {
  VIEW_ONLY = 'view_only',
  DOWNLOAD = 'download',
  EDIT = 'edit'
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: DocumentCategory;
  fields: DocumentField[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  validation?: FieldValidation;
  defaultValue?: unknown;
  placeholder?: string;
}

export enum FieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  DATE = 'date',
  EMAIL = 'email',
  PHONE = 'phone',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  SIGNATURE = 'signature',
  FILE_UPLOAD = 'file_upload'
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customValidator?: string;
}

export interface DocumentFolder {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  patientId: string;
  color?: string;
  icon?: string;
  documentCount: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Settings Types
export interface PatientSettings {
  id: string;
  patientId: string;
  profile: ProfileSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  preferences: UserPreferences;
  security: SecuritySettings;
  accessibility: AccessibilitySettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  address: Address;
  emergencyContact: EmergencyContact;
  preferredName?: string;
  pronouns?: string;
  language: string;
  timezone: string;
  profilePhoto?: string;
}

export interface NotificationSettings {
  email: EmailNotifications;
  sms: SMSNotifications;
  push: PushNotifications;
  inApp: InAppNotifications;
  quietHours: QuietHours;
}

export interface EmailNotifications {
  enabled: boolean;
  appointments: boolean;
  appointmentReminders: boolean;
  messages: boolean;
  documentUpdates: boolean;
  treatmentPlanUpdates: boolean;
  billingUpdates: boolean;
  promotionalEmails: boolean;
  weeklyReports: boolean;
  reminderFrequency: ReminderFrequency;
}

export interface SMSNotifications {
  enabled: boolean;
  appointments: boolean;
  appointmentReminders: boolean;
  emergencyAlerts: boolean;
  reminderFrequency: ReminderFrequency;
}

export interface PushNotifications {
  enabled: boolean;
  appointments: boolean;
  messages: boolean;
  documentUpdates: boolean;
  emergencyAlerts: boolean;
}

export interface InAppNotifications {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  showPreviews: boolean;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  weekendsOnly: boolean;
}

export enum ReminderFrequency {
  FIFTEEN_MINUTES = '15_minutes',
  THIRTY_MINUTES = '30_minutes',
  ONE_HOUR = '1_hour',
  TWO_HOURS = '2_hours',
  FOUR_HOURS = '4_hours',
  ONE_DAY = '1_day',
  TWO_DAYS = '2_days'
}

export interface PrivacySettings {
  profileVisibility: ProfileVisibility;
  dataSharing: DataSharingSettings;
  communicationPreferences: CommunicationPreferences;
  recordAccess: RecordAccessSettings;
}

export enum ProfileVisibility {
  PRIVATE = 'private',
  CARE_TEAM_ONLY = 'care_team_only',
  PUBLIC = 'public'
}

export interface DataSharingSettings {
  shareWithCareTeam: boolean;
  shareWithInsurance: boolean;
  shareForResearch: boolean;
  shareAnonymizedData: boolean;
  marketingCommunications: boolean;
}

export interface CommunicationPreferences {
  preferredContactMethod: ContactMethod;
  allowAfterHoursContact: boolean;
  shareContactWithEmergencyServices: boolean;
}

export enum ContactMethod {
  EMAIL = 'email',
  PHONE = 'phone',
  SMS = 'sms',
  IN_APP = 'in_app'
}

export interface RecordAccessSettings {
  allowFamilyAccess: boolean;
  familyAccessLevel: FamilyAccessLevel;
  authorizedUsers: AuthorizedUser[];
  accessLogging: boolean;
}

export enum FamilyAccessLevel {
  NONE = 'none',
  VIEW_ONLY = 'view_only',
  LIMITED = 'limited',
  FULL = 'full'
}

export interface AuthorizedUser {
  id: string;
  name: string;
  relationship: string;
  email: string;
  accessLevel: FamilyAccessLevel;
  expiresAt?: Date;
}

export interface UserPreferences {
  theme: ThemePreference;
  dashboard: DashboardPreferences;
  appointments: AppointmentPreferences;
  documents: DocumentPreferences;
  billing: BillingPreferences;
}

export enum ThemePreference {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',
  HIGH_CONTRAST = 'high_contrast'
}

export interface DashboardPreferences {
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  defaultView: string;
  showWelcomeMessage: boolean;
  compactMode: boolean;
}

export enum DashboardLayout {
  GRID = 'grid',
  LIST = 'list',
  CARDS = 'cards'
}

export interface DashboardWidget {
  id: string;
  name: string;
  enabled: boolean;
  position: number;
  size: WidgetSize;
}

export enum WidgetSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large'
}

export interface AppointmentPreferences {
  defaultDuration: number;
  preferredTimeSlots: TimeSlot[];
  autoConfirm: boolean;
  rescheduleNotice: number; // hours
  preferredAppointmentType: AppointmentType;
  telehealthPreferences: TelehealthPreferences;
}

export interface TimeSlot {
  dayOfWeek: number; // 0-6, 0 = Sunday
  startTime: string;
  endTime: string;
}

export interface TelehealthPreferences {
  defaultPlatform: string;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  screenSharing: boolean;
  recordingSessions: boolean;
  qualityPreference: VideoQuality;
}

export enum VideoQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  AUTO = 'auto'
}

export interface DocumentPreferences {
  defaultView: DocumentView;
  autoDownload: boolean;
  showPreviews: boolean;
  sortBy: DocumentSortBy;
  sortOrder: SortOrder;
}

export enum DocumentView {
  LIST = 'list',
  GRID = 'grid',
  TABLE = 'table'
}

export enum DocumentSortBy {
  DATE_CREATED = 'date_created',
  DATE_MODIFIED = 'date_modified',
  NAME = 'name',
  SIZE = 'size',
  TYPE = 'type',
  CATEGORY = 'category'
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export interface BillingPreferences {
  paperlessStatements: boolean;
  autoPayEnabled: boolean;
  paymentMethod: PaymentMethod;
  billingCycle: BillingCycle;
  reminderDays: number[];
}

export interface PaymentMethod {
  id: string;
  type: PaymentType;
  isDefault: boolean;
  lastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export enum PaymentType {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_ACCOUNT = 'bank_account',
  PAYPAL = 'paypal',
  APPLE_PAY = 'apple_pay',
  GOOGLE_PAY = 'google_pay'
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semi_annual',
  ANNUAL = 'annual'
}

export interface SecuritySettings {
  twoFactorAuth: TwoFactorAuthSettings;
  loginAlerts: LoginAlertSettings;
  sessionManagement: SessionManagementSettings;
  passwordPolicy: PasswordPolicySettings;
}

export interface TwoFactorAuthSettings {
  enabled: boolean;
  method: TwoFactorMethod;
  backupCodes: string[];
  trustedDevices: TrustedDevice[];
}

export enum TwoFactorMethod {
  SMS = 'sms',
  EMAIL = 'email',
  AUTHENTICATOR_APP = 'authenticator_app',
  HARDWARE_KEY = 'hardware_key'
}

export interface TrustedDevice {
  id: string;
  name: string;
  deviceType: string;
  lastUsed: Date;
  ipAddress: string;
  location?: string;
}

export interface LoginAlertSettings {
  enabled: boolean;
  newDeviceAlert: boolean;
  suspiciousLocationAlert: boolean;
  multipleFailedAttempts: boolean;
  emailAlerts: boolean;
  smsAlerts: boolean;
}

export interface SessionManagementSettings {
  sessionTimeout: number; // minutes
  concurrentSessions: number;
  autoLogoutInactive: boolean;
  rememberDevice: boolean;
  rememberDuration: number; // days
}

export interface PasswordPolicySettings {
  requireComplexPassword: boolean;
  minimumLength: number;
  requireSpecialCharacters: boolean;
  requireNumbers: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  passwordExpiryDays: number;
  preventReuse: number; // number of previous passwords to prevent reuse
}

export interface AccessibilitySettings {
  fontSize: FontSize;
  colorScheme: ColorScheme;
  animations: AnimationSettings;
  keyboard: KeyboardSettings;
  screen: ScreenReaderSettings;
  motor: MotorSettings;
}

export enum FontSize {
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  EXTRA_LARGE = 'extra_large'
}

export enum ColorScheme {
  NORMAL = 'normal',
  HIGH_CONTRAST = 'high_contrast',
  MONOCHROME = 'monochrome',
  PROTANOPIA = 'protanopia',
  DEUTERANOPIA = 'deuteranopia',
  TRITANOPIA = 'tritanopia'
}

export interface AnimationSettings {
  reducedMotion: boolean;
  autoplayVideos: boolean;
  transitionSpeed: TransitionSpeed;
}

export enum TransitionSpeed {
  SLOW = 'slow',
  NORMAL = 'normal',
  FAST = 'fast',
  DISABLED = 'disabled'
}

export interface KeyboardSettings {
  keyboardNavigation: boolean;
  stickyKeys: boolean;
  slowKeys: boolean;
  bounceKeys: boolean;
  mouseKeys: boolean;
}

export interface ScreenReaderSettings {
  enabled: boolean;
  verbosity: ScreenReaderVerbosity;
  speakPasswords: boolean;
  speakTyping: boolean;
  announceNotifications: boolean;
}

export enum ScreenReaderVerbosity {
  MINIMAL = 'minimal',
  NORMAL = 'normal',
  VERBOSE = 'verbose'
}

export interface MotorSettings {
  clickDelay: number;
  hoverDelay: number;
  largeClickTargets: boolean;
  gestureAlternatives: boolean;
}

// Notification Types
export interface Notification {
  id: string;
  notification_type: 'message' | 'appointment' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  related_object_id?: string;
  created_at: string;
  read_at?: string;
}

export interface NotificationCount {
  count: number;
}