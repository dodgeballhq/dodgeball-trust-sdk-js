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
}

export interface IVerification {
  id: string;
  status: VerificationStatus;
  outcome: VerificationOutcome;
  nextSteps: IVerificationStep[];
  error?: string;
}

export interface IVerificationContext {
  onVerified: (verification: IVerification) => Promise<void>;
  onApproved: () => Promise<void>;
  onDenied: (verification: IVerification) => Promise<void>;
  onBlocked: (verification: IVerification) => Promise<void>;
  onError: (error: string) => Promise<void>;
}

export interface ILibConfig {
  name: IntegrationName;
  url: string;
  config: any;
}

export interface IVerificationStep extends ILibConfig {
  id: string;
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
  FINGERPRINTJS = "FINGERPRINTJS",
  STRIPE_IDENTITY = "STRIPE_IDENTITY",
  TWILIO = "TWILIO",
}

export enum IntegrationPurpose {
  IDENTIFY = "IDENTIFY",
  OBSERVE = "OBSERVE",
  QUALIFY = "QUALIFY",
}

export interface IIntegrationConfig {
  [key: string]: any;
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
