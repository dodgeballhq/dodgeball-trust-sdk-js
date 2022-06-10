import { LogLevel } from "./logger";

export enum ApiVersion {
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

export interface IStepResponse {
  pluginName: string;
  methodName: string;
  data?: any;
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
  MFA = "MFA",
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
  observe(sourceId: string, userId?: string): void;
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
  apiUrl?: string; // For completely isolated (self-hosted) distributions, you will need to supply a URL to the API.
  logLevel?: LogLevel;
  disableCookies?: boolean;
}

export interface IHandleVerificationOptions {
  maxDuration: number;
}

export interface IVerificationInvocationOptions
  extends IHandleVerificationOptions {
  pollingInterval: number;
}

export enum ConfigurableFontWeight {
  LIGHT = "300",
  REGULAR = "400",
  MEDIUM = "500",
  SEMI_BOLD = "600",
  BOLD = "700",
}

export enum MfaConfigurableStyle {
  MODAL_BORDER_RADIUS = "MODAL_BORDER_RADIUS",
  MODAL_BACKGROUND_COLOR = "MODAL_BACKGROUND_COLOR",
  HEADER_BACKGROUND_COLOR = "HEADER_BACKGROUND_COLOR",
  HEADER_TITLE_TEXT = "HEADER_TITLE_TEXT",
  HEADER_LOGO = "HEADER_LOGO",
  HEADER_TEXT_COLOR = "HEADER_TEXT_COLOR",
  HEADER_TEXT_SIZE = "HEADER_TEXT_SIZE",
  HEADER_TEXT_WEIGHT = "HEADER_TEXT_WEIGHT",
  HEADER_UNDERLINE_COLOR = "HEADER_UNDERLINE_COLOR",
  HEADER_UNDERLINE_THICKNESS = "HEADER_UNDERLINE_THICKNESS",
  CONTENT_TITLE_TEXT = "CONTENT_TITLE_TEXT",
  CONTENT_TITLE_COLOR = "CONTENT_TITLE_COLOR",
  CONTENT_TITLE_SIZE = "CONTENT_TITLE_SIZE",
  CONTENT_TITLE_WEIGHT = "CONTENT_TITLE_WEIGHT",
  CONTENT_SUBTITLE_COLOR = "CONTENT_SUBTITLE_COLOR",
  CONTENT_SUBTITLE_SIZE = "CONTENT_SUBTITLE_SIZE",
  CONTENT_SUBTITLE_WEIGHT = "CONTENT_SUBTITLE_WEIGHT",
  CONTENT_VERIFIED_TITLE_TEXT = "CONTENT_VERIFIED_TITLE_TEXT",
  CONTENT_VERIFIED_SUBTITLE_TEXT = "CONTENT_VERIFIED_SUBTITLE_TEXT",
  CONTENT_AUTHORIZE_TEXT = "CONTENT_AUTHORIZE_TEXT",
  CONTENT_VERIFY_TEXT = "CONTENT_VERIFY_TEXT",
  CONTENT_DESCRIPTION_COLOR = "CONTENT_DESCRIPTION_COLOR",
  CONTENT_DESCRIPTION_SIZE = "CONTENT_DESCRIPTION_SIZE",
  CONTENT_DESCRIPTION_WEIGHT = "CONTENT_DESCRIPTION_WEIGHT",
  CONTENT_EXPLANATION_TEXT = "CONTENT_EXPLANATION_TEXT",
  CONTENT_DISCLAIMER_TEXT = "CONTENT_DISCLAIMER_TEXT",
  CONTENT_PROMPT_TEXT = "CONTENT_PROMPT_TEXT",
  CONTENT_CODE_INPUT_LABEL_TEXT_COLOR = "CONTENT_CODE_INPUT_LABEL_TEXT_COLOR",
  CONTENT_CODE_INPUT_LABEL_TEXT_SIZE = "CONTENT_CODE_INPUT_LABEL_TEXT_SIZE",
  CONTENT_CODE_INPUT_LABEL_TEXT_WEIGHT = "CONTENT_CODE_INPUT_LABEL_TEXT_WEIGHT",
  CONTENT_CODE_INPUT_BORDER_RADIUS = "CONTENT_CODE_INPUT_BORDER_RADIUS",
  CONTENT_CODE_INPUT_BORDER_COLOR = "CONTENT_CODE_INPUT_BORDER_COLOR",
  CONTENT_CODE_INPUT_BORDER_THICKNESS = "CONTENT_CODE_INPUT_BORDER_THICKNESS",
  CONTENT_CODE_INPUT_TEXT_COLOR = "CONTENT_CODE_INPUT_TEXT_COLOR",
  CONTENT_CODE_INPUT_TEXT_SIZE = "CONTENT_CODE_INPUT_TEXT_SIZE",
  CONTENT_CODE_INPUT_TEXT_WEIGHT = "CONTENT_CODE_INPUT_TEXT_WEIGHT",
  CONTENT_CODE_INPUT_VERTICAL_PADDING = "CONTENT_CODE_INPUT_VERTICAL_PADDING",
  CONTENT_CODE_INPUT_HORIZONTAL_PADDING = "CONTENT_CODE_INPUT_HORIZONTAL_PADDING",
  CONTENT_OPTION_TEXT_COLOR = "CONTENT_OPTION_TEXT_COLOR",
  CONTENT_OPTION_TEXT_SIZE = "CONTENT_OPTION_TEXT_SIZE",
  CONTENT_OPTION_TEXT_WEIGHT = "CONTENT_OPTION_TEXT_WEIGHT",
  CONTENT_HELP_LINK_COLOR = "CONTENT_HELP_LINK_COLOR",
  CONTENT_HELP_LINK_HOVER_COLOR = "CONTENT_HELP_LINK_HOVER_COLOR",
  CONTENT_HELP_LINK_SIZE = "CONTENT_HELP_LINK_SIZE",
  CONTENT_HELP_LINK_WEIGHT = "CONTENT_HELP_LINK_WEIGHT",
  CONTENT_RESEND_CODE_TEXT = "CONTENT_RESEND_CODE_TEXT",
  CONTENT_BORDER_THICKNESS = "CONTENT_BORDER_THICKNESS",
  CONTENT_BORDER_COLOR = "CONTENT_BORDER_COLOR",
  BUTTON_TEXT_SIZE = "BUTTON_TEXT_SIZE",
  BUTTON_TEXT_WEIGHT = "BUTTON_TEXT_WEIGHT",
  BUTTON_GAP = "BUTTON_GAP",
  BUTTON_BORDER_RADIUS = "BUTTON_BORDER_RADIUS",
  BUTTON_BORDER_THICKNESS = "BUTTON_BORDER_THICKNESS",
  BUTTON_HORIZONTAL_PADDING = "BUTTON_HORIZONTAL_PADDING",
  BUTTON_VERTICAL_PADDING = "BUTTON_VERTICAL_PADDING",
  CANCEL_BUTTON_COLOR = "CANCEL_BUTTON_COLOR",
  CANCEL_BUTTON_TEXT_COLOR = "CANCEL_BUTTON_TEXT_COLOR",
  CANCEL_BUTTON_BORDER_COLOR = "CANCEL_BUTTON_BORDER_COLOR",
  CANCEL_BUTTON_HOVER_COLOR = "CANCEL_BUTTON_HOVER_COLOR",
  CANCEL_BUTTON_HOVER_TEXT_COLOR = "CANCEL_BUTTON_HOVER_TEXT_COLOR",
  CANCEL_BUTTON_HOVER_BORDER_COLOR = "CANCEL_BUTTON_HOVER_BORDER_COLOR",
  SUBMIT_BUTTON_COLOR = "SUBMIT_BUTTON_COLOR",
  SUBMIT_BUTTON_TEXT_COLOR = "SUBMIT_BUTTON_TEXT_COLOR",
  SUBMIT_BUTTON_BORDER_COLOR = "SUBMIT_BUTTON_BORDER_COLOR",
  SUBMIT_BUTTON_HOVER_COLOR = "SUBMIT_BUTTON_HOVER_COLOR",
  SUBMIT_BUTTON_HOVER_TEXT_COLOR = "SUBMIT_BUTTON_HOVER_TEXT_COLOR",
  SUBMIT_BUTTON_HOVER_BORDER_COLOR = "SUBMIT_BUTTON_HOVER_BORDER_COLOR",
  DISABLED_BUTTON_COLOR = "DISABLED_BUTTON_COLOR",
  DISABLED_BUTTON_TEXT_COLOR = "DISABLED_BUTTON_TEXT_COLOR",
  DISABLED_BUTTON_BORDER_COLOR = "DISABLED_BUTTON_BORDER_COLOR",
  SHOW_COMPLETE_SCREEN = "SHOW_COMPLETE_SCREEN",
  COMPLETE_AUTO_CLOSE_DELAY = "COMPLETE_AUTO_CLOSE_DELAY",
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
