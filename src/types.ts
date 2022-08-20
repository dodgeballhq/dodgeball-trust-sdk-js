import { LogLevel } from "./logger";

export enum DodgeballApiVersion {
  v1 = "v1",
}

export enum VerificationStatus {
  PENDING = "PENDING",
  BLOCKED = "BLOCKED",
  COMPLETE = "COMPLETE",
  FAILED = "FAILED",
}

export enum VerificationOutcome {
  APPROVED = "APPROVED",
  DENIED = "DENIED",
  PENDING = "PENDING",
  ERROR = "ERROR",
}

export interface IVerification {
  id: string;
  status: VerificationStatus;
  outcome: VerificationOutcome;
  stepData: IVerificationStepData;
  nextSteps: IVerificationStep[];
  error?: string;
}

export enum VerificationErrorType {
  SYSTEM = "SYSTEM",
  TIMEOUT = "TIMEOUT",
}

export interface IVerificationError {
  errorType: VerificationErrorType;
  details?: string;
}

export const systemError = (errorText?: string) => {
  return {
    errorType: VerificationErrorType.SYSTEM,
    details: errorText,
  };
};

export interface IVerificationContext {
  onVerified: (verification: IVerification) => Promise<void>;
  onApproved: (verification: IVerification) => Promise<void>;
  onDenied?: (verification: IVerification) => Promise<void>;
  onPending?: (verification: IVerification) => Promise<void>;
  onBlocked?: (verification: IVerification) => Promise<void>;
  onUndecided?: (verification: IVerification) => Promise<void>;
  onError?: (error: IVerificationError) => Promise<void>;
}

export interface ILibConfig {
  name: string;
  url: string;
  config: any;
  method?: string;
  content?: {
    url?: string;
    text?: string;
  };
  loadTimeout?: number;
}

export interface IVerificationStep extends ILibConfig {
  id: string;
  verificationStepId: string;
}

export interface IVerificationStepData {
  customMessage?: string;
}

export interface IStepResponse {
  pluginName: string;
  methodName: string;
  data?: any;
}

export interface IInitConfig {
  requestId: string;
  libs: ILibConfig[];
  requireSrc?: string;
}

export interface IFingerprint {
  source: string;
  props: { [key: string]: any };
  hash?: string;
  error?: string;
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
  name: string;
  purposes: IntegrationPurpose[];
  requestId: string;
}

export interface IIdentifierIntegration {
  identify(): Promise<IFingerprint>;
}

export interface IObserverIntegration {
  observe(sessionId: string, userId?: string): void;
}

export interface IExecutionIntegration {
  execute(
    step: IVerificationStep,
    context: IVerificationContext,
    responseCallback: (stepResponse: IStepResponse) => Promise<void>
  ): Promise<any>;
  cleanup(): Promise<void>;
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
  version: DodgeballApiVersion;
}

export interface IDodgeballVerifyResponse {
  success: boolean;
  errors: IDodgeballApiError[];
  version: DodgeballApiVersion;
  verification: IVerification;
}

export interface IDodgeballConfig {
  apiVersion: DodgeballApiVersion;
  apiUrl?: string; // For completely isolated (self-hosted) distributions, you will need to supply a URL to the API.
  logLevel?: LogLevel;
  disableCookies?: boolean;
  sessionId?: string; // If you have the sessionId available at the time of construction, you can pass it in here.
  userId?: string; // If you have the userId available at the time of construction, you can pass it in here. Note that sessionId is required if you pass in userId.
}

export interface IHandleVerificationOptions {
  maxDuration: number;
}

export interface IVerificationInvocationOptions
  extends IHandleVerificationOptions {
  pollingInterval: number;
  numAtInitialPollingInterval: number;
  maxPollingInterval: number;
}

// Errors
export class DodgeballMissingConfigError extends Error {
  constructor(configName: string, value: any) {
    super(
      `Dodgeball SDK Error\nMissing configuration: ${configName}\nProvided Value: ${value}`
    );
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DodgeballInvalidConfigError extends Error {
  constructor(configName: string, value: any, allowedValues: any[]) {
    super(
      `Dodgeball SDK Error\nInvalid configuration: ${configName}\nProvided value: ${value}\nAllowed values: ${allowedValues.join(
        ", "
      )}`
    );
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DodgeballMissingParameterError extends Error {
  constructor(parameter: string, value: any) {
    super(
      `Dodgeball SDK Error\nMissing parameter: ${parameter}\nProvided value: ${value}`
    );
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
