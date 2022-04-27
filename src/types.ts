export enum ApiVersion {
  v1 = "v1",
}

export enum VerificationStatus {
  PENDING = "PENDING",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED",
}

export enum VerificationOutcome {
  APPROVED = "APPROVED",
  DENIED = "DENIED",
  PENDING = "PENDING",
  ERROR = "ERROR",
  BLOCKED = "BLOCKED",
  WAITING = "WAITING",

  // Processing is complete, but no decision
  // was taken.  Clients should only perform
  // safe actions in this case.
  COMPLETE = "COMPLETE"
}

export interface IVerification {
  id: string;
  status: VerificationStatus;
  outcome: VerificationOutcome;
  stepData: IVerificationStepData;
  nextSteps: IVerificationStep[];
  error?: string;
}

export interface IVerificationContext {
  onPending?: (verification: IVerification) => Promise<void>;
  onVerified: (verification: IVerification) => Promise<void>;
  onApproved: (verification: IVerification) => Promise<void>;
  onDenied: (verification: IVerification) => Promise<void>;
  onBlocked: (verification: IVerification) => Promise<void>;
  onError: (error: string) => Promise<void>;
  onComplete: (verification: IVerification)=>Promise<void>
}

export interface ILibConfig {
  name: IntegrationName;
  url: string;
  config: any;
  method?: string;
}

export interface IVerificationStep extends ILibConfig {
  id: string;
  verificationStepId: string;
}

export interface IVerificationStepData {
  customMessage?: string;
}

export interface IStepResponse{
  pluginName: string;
  methodName: string;
  data?: any
}

export interface IInitConfig {
  requestId: string;
  libs: ILibConfig[];
}

export enum FingerprintSource {
  DODGEBALL = "DODGEBALL",
  FINGERPRINTJS = "FINGERPRINTJS",
}

export interface IFingerprint {
  source: FingerprintSource;
  props: { [key: string]: any };
  hash?: string;
  error?: string;
}

export enum IntegrationName {
  SIFT = "SIFT",
  SIFT_SCORE = "SIFT SCORE",
  FINGERPRINTJS = "FINGERPRINTJS",
  STRIPE_IDENTITY = "STRIPE_IDENTITY",
  MFA_TWILIO = "MFA_TWILIO"
}

export enum IntegrationPurpose {
  IDENTIFY = "IDENTIFY",
  OBSERVE = "OBSERVE",
  QUALIFY = "QUALIFY",
  EXECUTE = "EXECUTE",
}

export interface IIntegrationConfig {
  [key: string]: any;
}

export interface IReconfigureIntegrationProps {
  config: IIntegrationConfig;
  url: string;
  purposes?: IntegrationPurpose[];
  requestId: string;
}

export interface IIntegrationProps {
  config: IIntegrationConfig;
  url: string;
  name: IntegrationName;
  purposes: IntegrationPurpose[];
  requestId: string;
}

export interface IIdentifierIntegration {
  identify(): Promise<IFingerprint>;
}

export interface IObserverIntegration {
  observe(sourceId: string): void;
}



export interface IExecutionIntegration{
  execute(step: IVerificationStep,
          context: IVerificationContext,
          responseCallback: (stepResponse: IStepResponse)=>Promise<void>): Promise<any>
}


export interface IQualifierIntegration {
  qualify(context: IVerificationContext): Promise<any>;
}

export interface IDodgeballApiError {
  code: number;
  message: string;
}

export interface IDodgeballTrackResponse {
  success: boolean;
  errors: IDodgeballApiError[];
  version: ApiVersion;
}

export interface IDodgeballVerifyResponse {
  success: boolean;
  errors: IDodgeballApiError[];
  version: ApiVersion;
  verification: IVerification;
}

export interface IDodgeballConfig {
  apiVersion: ApiVersion;
  apiUrl?: string; // For customers with completely isolated (self-hosted) distributions, they will need to supply a URL to the API.
  disableCookies?: boolean; // Some customers may not want to use cookies.
}

// export interface IStripeIdentityConfig {
//   scriptUrl: string; // https://js.stripe.com/v3/
//   publicKey: string;
//   verificationSessionClientSecret: string; // Generated server-side (on Dodgeball's servers) by stripe.identity.verificationSessions.create() call
// }
