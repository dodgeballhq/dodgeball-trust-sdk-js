import {
  ApiVersion,
  IDodgeballConfig,
  IExecutionIntegration,
  IIdentifierIntegration,
  IntegrationPurpose,
  IObserverIntegration,
  IQualifierIntegration,
  IVerification,
  IVerificationContext,
  IVerificationStep,
  VerificationErrorType,
  VerificationOutcome,
  VerificationStatus,
} from "./types";

import { Logger } from "./logger";

import {
  getInitializationConfig,
  queryVerification,
  setVerificationResponse,
} from "./utilities";

import Identifier from "./Identifier";
import Integration from "./integrations/Integration";
import IntegrationLoader from "./IntegrationLoader";

console.log("Dodgeball");

const POLL_INTERVAL_MS = 3000; //1000;

const DEFAULT_CONFIG: IDodgeballConfig = {
  apiUrl: "https://api.dodgeballhq.com/",
  apiVersion: ApiVersion.v1,
};

type VerificationHandler = (
  verification: IVerification,
  context: IVerificationContext
) => Promise<void>;

export interface IHandleVerificationOptions {
  maxDuration: number;
}

export interface IVerificationInvocationOptions
  extends IHandleVerificationOptions {
  pollingInterval: number;
  terminalStates: VerificationOutcome[];
}

// Export a class that accepts a config object
export class Dodgeball {
  publicKey: string = "";
  config: IDodgeballConfig = DEFAULT_CONFIG;
  identifier?: Identifier;
  seenSteps: { [key: string]: IVerificationStep } = {};
  integrationLoader: IntegrationLoader;
  integrations: Integration[] = [];
  isIdentified: boolean = false;
  onIdentified: Function[] = [];
  sourceId: string = "";

  // Constructor
  constructor() {
    this.integrationLoader = new IntegrationLoader();
    Logger.info("Dodgeball Constructor Called").log();
  }

  public track(publicKey: string, config?: IDodgeballConfig) {
    this.publicKey = publicKey;
    this.config = Object.assign(DEFAULT_CONFIG, config || {});

    const identifier = (this.identifier = new Identifier({
      cookiesEnabled: !this.config.disableCookies,
      apiUrl: this.config.apiUrl as string,
      apiVersion: this.config.apiVersion,
      publicKey,
      clientUrl:
        "https://cdn.jsdelivr.net/npm/clientjs@0.2.1/dist/client.min.js",
    }));

    // Call to /init endpoint to get list of integrations to run
    // FUTURE: Replace this with dynamically generated files approach to remove first /init request to Dodgeball API
    setTimeout(async () => {
      const initConfig = await getInitializationConfig({
        url: this.config.apiUrl as string,
        token: this.publicKey,
        version: this.config.apiVersion,
      });

      // Now that we have the initConfig, parse it and load the integrations
      if (initConfig && initConfig.libs) {
        for (const libConfig of initConfig.libs) {
          const integration = await this.integrationLoader.loadIntegration(
            libConfig,
            initConfig.requestId
          );

          if (integration) {
            this.integrations.push(integration);
          }
        }
      }

      // Now that all of the integrations are loaded, use them
      const identifiers = this.integrationLoader.filterIntegrationsByPurpose(
        this.integrations,
        IntegrationPurpose.IDENTIFY
      ) as unknown[] as IIdentifierIntegration[];

      const sourceId = await identifier.identify(identifiers);
      this.sourceId = sourceId;
      this.isIdentified = true;

      if (this.onIdentified.length > 0) {
        this.onIdentified.forEach((callback) => {
          callback();
        });

        this.onIdentified = [];
      }

      const observers = this.integrationLoader.filterIntegrationsByPurpose(
        this.integrations,
        IntegrationPurpose.OBSERVE
      ) as unknown[] as IObserverIntegration[];

      observers.forEach((observer) => {
        observer.observe(sourceId);
      });
    }, 0);
  }

  // Private methods
  private filterSeenSteps(steps: IVerificationStep[]): IVerificationStep[] {
    return steps.filter((step: IVerificationStep) => {
      return !this.seenSteps[step.id];
    });
  }

  private async handleVerificationStep(
    verification: IVerification,
    step: IVerificationStep,
    context: IVerificationContext
  ): Promise<void> {
    // If we get here, the step is for us
    this.seenSteps[step.id] = step;

    // Since the step is for us, we need to display the integration
    if (step.name) {
      Logger.trace("Handle Verification Step - About to load:", {
        step: step,
      }).log();

      try {
        const integration = (await this.integrationLoader.loadIntegration(
          {
            ...step,
          },
          step.id
        )) as Integration;

        if (this.integrations.indexOf(integration) < 0) {
          this.integrations.push(integration);
        }

        Logger.info("Handle Verification Step - Loaded integration", {
          integration: integration.name,
        });

        if (integration.purposes.includes(IntegrationPurpose.OBSERVE)) {
          (integration as unknown as IObserverIntegration).observe(
            this.sourceId
          );
        }

        if (integration.purposes.includes(IntegrationPurpose.IDENTIFY)) {
          (integration as unknown as IIdentifierIntegration).identify();
          // TODO: Do we need to resubmit the fingerprint?
        }

        if (integration.purposes.includes(IntegrationPurpose.QUALIFY)) {
          (integration as unknown as IQualifierIntegration).qualify(context);
        }

        if (integration.purposes.includes(IntegrationPurpose.EXECUTE)) {
          (integration as unknown as IExecutionIntegration).execute(
            step,
            context,
            (response) => {
              return setVerificationResponse(
                this.config.apiUrl as string,
                this.publicKey,
                this.sourceId,
                this.config.apiVersion,
                verification,
                step.verificationStepId,
                response
              );
            }
          );
        }
      } catch (error) {
        Logger.error(
          "Handle Verification Step - Could not process step:",
          error
        )
          .setParameters({ step: step })
          .log();
      }
    }
  }

  private defaultVerificationOptions() {
    return {
      maxDuration: 120000,
      pollingInterval: POLL_INTERVAL_MS,
      terminalStates: [
        VerificationOutcome.COMPLETE,
        VerificationOutcome.ERROR,
        VerificationOutcome.APPROVED,
        VerificationOutcome.DENIED,
      ],
    };
  }

  private verifyTimeDelta(
    startDate: Date,
    options?: IVerificationInvocationOptions
  ) {
    let maxDelta = options?.maxDuration;
    let toReturn = maxDelta
      ? Date.now() - startDate.valueOf() < maxDelta
      : true;

    return toReturn;
  }

  private handleVerificationOutcome(
    verification: IVerification,
    context: IVerificationContext,
    options: IVerificationInvocationOptions
  ): void {
    // Call the appropriate callback function if the verification is complete.
    // Otherwise, subscribe to the verification.
    (async () => {
      Logger.trace("Handle Verification Outcome - Called", {
        verification: verification,
      }).log();

      let isTerminal = false;
      let numIterations = 0;
      let startTime = new Date();

      while (
        !isTerminal &&
        (numIterations == 0 || this.verifyTimeDelta(startTime, options))
      ) {
        if (numIterations > 0) {
          // Sleep between iterations
          await new Promise((resolve) =>
            setTimeout(resolve, options.pollingInterval)
          );

          // TODO: add retry logic
          try {
            let response = await queryVerification(
              this.config.apiUrl as string,
              this.publicKey,
              this.config.apiVersion,
              verification
            );

            verification = response.verification;
          } catch (e) {
            Logger.error("Error Querying Verification Status", e).log();
          }
        }

        let verificationOutcome =
          verification?.outcome ?? VerificationOutcome.APPROVED;
        let stateName = verificationOutcome.valueOf();
        isTerminal =
          !verification ||
          verificationOutcome === VerificationOutcome.COMPLETE ||
          verificationOutcome === VerificationOutcome.ERROR ||
          verificationOutcome === VerificationOutcome.APPROVED ||
          verificationOutcome === VerificationOutcome.DENIED;
        numIterations += 1;

        if (!isTerminal) {
          let verificationSteps = this.filterSeenSteps(
            verification.nextSteps ?? []
          );
          while (verificationSteps && verificationSteps.length > 0) {
            await this.handleVerificationStep(
              verification,
              verificationSteps[0],
              context
            );
            verificationSteps = this.filterSeenSteps(verificationSteps);
          }
        }

        switch (verificationOutcome) {
          case VerificationOutcome.COMPLETE:
            context.onError({
              errorType: VerificationErrorType.COMPLETE_NO_DECISION,
            });
            break;

          case VerificationOutcome.ERROR:
            context.onError({
              errorType: VerificationErrorType.SYSTEM,
              details: verification.error,
            });

            break;

          case VerificationOutcome.APPROVED:
            // To match the existing logic.  Will be simplified
            if (numIterations === 1) {
              await context.onApproved(verification);
            } else {
              // TODO: Find a cleaner way to get MFA to dismiss
              const executors: IExecutionIntegration[] =
                this.integrationLoader.filterIntegrationsByPurpose(
                  this.integrations,
                  IntegrationPurpose.EXECUTE
                ) as any[];
              for (const executor of executors) {
                await executor.cleanup();
              }

              await context.onVerified(verification);
            }
            break;

          case VerificationOutcome.DENIED:
            if (context.onDenied) {
              await context.onDenied(verification);
            }
            break;

          case VerificationOutcome.PENDING:
          case VerificationOutcome.WAITING:
            if (context.onPending) {
              await context.onPending(verification);
            }
            break;

          case VerificationOutcome.BLOCKED:
            if (context.onBlocked) {
              await context.onBlocked(verification);
            }
            break;

          default:
            Logger.info(`Unknown Verification Outcome: ${verificationOutcome}`);
            break;
        }
      }

      return;
    })();
  }

  // Public methods

  // This function may be called using async/await syntax or using a callback
  public async getIdentity(onIdentity?: Function): Promise<string> {
    try {
      return new Promise((resolve) => {
        if (this.isIdentified) {
          if (onIdentity) {
            onIdentity(this.sourceId);
          }
          resolve(this.sourceId);
        } else {
          if (onIdentity) {
            this.onIdentified.push(() => {
              onIdentity(this.sourceId);
              resolve(this.sourceId);
            });
          } else {
            this.onIdentified.push(() => {
              resolve(this.sourceId);
            });
          }
        }
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  // Takes a verification and calls the correct callback based on the outcome
  public handleVerification(
    verification: IVerification,
    context: IVerificationContext,
    options?: IHandleVerificationOptions
  ): void {
    let fullOptions = this.defaultVerificationOptions();
    fullOptions.maxDuration = options
      ? options.maxDuration
      : fullOptions.maxDuration;

    this.handleVerificationOutcome(verification, context, fullOptions);
  }

  public isRunning(verification: IVerification) {
    return verification.status === VerificationStatus.PENDING;
  }

  public isAllowed(verification: IVerification): boolean {
    return (
      verification.status === VerificationStatus.COMPLETE &&
      verification.outcome === VerificationOutcome.APPROVED
    );
  }

  public isDenied(verification: IVerification): boolean {
    return (
      verification.status === VerificationStatus.COMPLETE &&
      verification.outcome === VerificationOutcome.DENIED
    );
  }

  public isError(verification: IVerification): boolean {
    return (
      verification.status === VerificationStatus.FAILED &&
      verification.outcome === VerificationOutcome.ERROR
    );
  }
}

// React hook for use with Dodgeball
export function useDodgeball(): Dodgeball {
  if (typeof window !== "undefined") {
    if (!window.hasOwnProperty("dodgeball")) {
      const dodgeball = new Dodgeball();
      window.dodgeball = dodgeball;
      return dodgeball;
    } else {
      return window.dodgeball;
    }
  }
  return new Dodgeball();
}

if (typeof window !== "undefined") {
  if (!window.hasOwnProperty("dodgeball")) {
    window.dodgeball = new Dodgeball();
  }
}

declare global {
  interface Window {
    dodgeball: Dodgeball;
  }
}
