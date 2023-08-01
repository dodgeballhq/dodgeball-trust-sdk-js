import {
  DodgeballApiVersion,
  DodgeballInvalidConfigError,
  DodgeballMissingConfigError,
  IDodgeballConfig,
  IExecutionIntegration,
  IHandleVerificationOptions,
  IIdentifierIntegration,
  IInitConfig,
  IntegrationPurpose,
  IObserverIntegration,
  IQualifierIntegration,
  IVerification,
  IVerificationContext,
  IVerificationInvocationOptions,
  IVerificationStep,
  VerificationOutcome,
  VerificationStatus,
  systemError,
  cancelError,
} from "./types";

import {
  DEFAULT_CONFIG,
  DEFAULT_VERIFICATION_OPTIONS,
  DISABLED_SESSION_ID,
  DISABLED_SOURCE_TOKEN,
  DODGEBALL_SESSION_KEY,
  DodgeballSessionMessageType,
  MIN_TOKEN_REFRESH_INTERVAL_MS,
} from "./constants";

import { Logger, LogLevel, Severity } from "./logger";

import {
  constructApiUrl,
  getInitializationConfig,
  queryVerification,
  setVerificationResponse,
} from "./utilities";

import Identifier from "./Identifier";
import Integration from "./Integration";
import IntegrationLoader from "./IntegrationLoader";

import cloneDeep from "lodash.clonedeep";
import { v4 as uuidv4 } from "uuid";
import Cookies from "js-cookie";

export class Dodgeball {
  private publicKey: string = "";
  private config: IDodgeballConfig;
  private identifier: Identifier;
  private seenSteps: { [key: string]: IVerificationStep } = {};
  private integrationLoader: IntegrationLoader | null = null;
  private integrations: Integration[] = [];
  private areIntegrationsLoaded: boolean = false;
  private onIntegrationsLoaded: Function[] = [];
  private isSourcing: boolean = false;
  private onSource: Function[] = [];
  private sourceToken: string = "";
  private sourceTokenExpiry: number = 0;
  private refreshSourceTokenHandle: any = null;
  private sessionHelperIsLoaded: boolean = false;
  private sessionHelperIframe: HTMLIFrameElement | null = null;
  private onSessionHelper: Function[] = [];
  private useSessionFallback: boolean = false;

  constructor(publicKey: string, config?: IDodgeballConfig) {
    if (publicKey == null || publicKey?.length === 0) {
      throw new DodgeballMissingConfigError("publicApiKey", publicKey);
    }
    this.publicKey = publicKey;

    this.config = Object.assign(
      cloneDeep(DEFAULT_CONFIG),
      cloneDeep(config || {})
    );

    if (
      Object.keys(DodgeballApiVersion).indexOf(
        this.config.apiVersion as DodgeballApiVersion
      ) < 0
    ) {
      throw new DodgeballInvalidConfigError(
        "config.apiVersion",
        this.config.apiVersion,
        Object.keys(DodgeballApiVersion)
      );
    }

    const logLevel = this.config.logLevel ?? LogLevel.INFO;

    if (Object.keys(LogLevel).indexOf(logLevel as LogLevel) < 0) {
      throw new DodgeballInvalidConfigError(
        "config.logLevel",
        logLevel,
        Object.keys(LogLevel)
      );
    }

    Logger.filterLevel = Severity[logLevel];

    this.identifier = new Identifier({
      cookiesEnabled: !this.config.disableCookies,
      apiUrl: this.config.apiUrl as string,
      apiVersion: this.config.apiVersion,
      publicKey: this.publicKey,
    });
    Logger.trace("Dodgeball constructor called").log();

    if (this.config.isEnabled) {
      setTimeout(async () => {
        const initConfigScript =
          typeof document !== "undefined"
            ? document.querySelector("script[data-dodgeball]")
            : null;
        let initConfig: IInitConfig;

        if (initConfigScript) {
          // Script tag found, use it to get init config
          const waitForInitializationConfig = new Promise<IInitConfig>(
            (resolve) => {
              (initConfigScript as HTMLScriptElement).addEventListener(
                "load",
                () => {
                  if (typeof window !== "undefined") {
                    if (!window.hasOwnProperty("_dodgeball_init_conf")) {
                      resolve(window._dodgeball_init_conf);
                    }
                  }
                  resolve({
                    requestId: uuidv4(),
                    libs: [],
                  });
                }
              );
            }
          );

          initConfig = await waitForInitializationConfig;
        } else {
          // No script tag found, so we need to make the request to the API
          initConfig = await getInitializationConfig({
            url: this.config.apiUrl as string,
            token: this.publicKey,
            version: this.config.apiVersion,
          });
        }

        if (initConfig?.hasOwnProperty("libs")) {
          // Now that we have the initConfig, parse it and load the integrations
          this.integrationLoader = new IntegrationLoader({
            requireSrc: initConfig.requireSrc,
            parentContext: {
              publicKey: this.publicKey,
              config: this.config,
              clearScreen: this.clearScreen.bind(this),
            },
          });

          if (initConfig && initConfig.libs) {
            const integrations = await this.integrationLoader.loadIntegrations(
              initConfig.libs,
              initConfig.requestId
            );
            if (integrations) {
              this.integrations = [...this.integrations, ...integrations];
            }
          }

          this.areIntegrationsLoaded = true;

          if (this.onIntegrationsLoaded.length > 0) {
            for (const callback of this.onIntegrationsLoaded) {
              await callback();
            }
          }

          const existingSource = this.identifier.getSource();
          if (existingSource) {
            this.sourceToken = existingSource.token;
            this.sourceTokenExpiry = existingSource.expiry ?? 0;
            this.registerSourceTokenRefresh();
          } else {
            setTimeout(async () => {
              await this.generateSourceToken();
            }, 0);
          }

          if (this.config.sessionId) {
            const observers =
              this.integrationLoader.filterIntegrationsByPurpose(
                this.integrations,
                IntegrationPurpose.OBSERVE
              ) as unknown[] as IObserverIntegration[];

            observers.forEach((observer) => {
              observer.observe({
                sessionId: this.config.sessionId as string,
                userId: this.config.userId,
                sourceToken: this.sourceToken,
              });
            });
          }
        } else {
          Logger.error(
            "Error Loading Initialization Configuration.",
            initConfig
          ).log();
        }

        // Attach session helper iframe
        if (
          typeof document !== "undefined" &&
          this.config.enableCrossDomainSession
        ) {
          // Get the user-agent string
          const userAgentString = navigator.userAgent;
          const isChromeAgent = userAgentString.indexOf("Chrome") > -1;
          let isSafariAgent = userAgentString.indexOf("Safari") > -1;

          // Discard Safari since it also matches Chrome
          if (isChromeAgent && isSafariAgent) {
            isSafariAgent = false;
          }

          const useCookies = isSafariAgent; // Safari does not support localStorage in iframes

          if (useCookies) {
            this.sessionHelperIsLoaded = true;
            this.useSessionFallback = true;

            if (this.onSessionHelper.length > 0) {
              this.onSessionHelper.forEach((callback) => {
                callback();
              });

              this.onSessionHelper = [];
            }
          } else {
            let sessionHelperIframe =
              document.getElementById("_db-sessionUtil");

            if (!sessionHelperIframe) {
              const apiUrl = constructApiUrl(
                this.config.apiUrl as string,
                this.config.apiVersion
              );

              sessionHelperIframe = document.createElement("iframe");
              sessionHelperIframe.setAttribute("id", "_db-sessionUtil");
              sessionHelperIframe.setAttribute(
                "src",
                `${apiUrl}sessionUtil?publicKey=${this.publicKey}`
              );
              sessionHelperIframe.setAttribute("style", "display: none;");
              sessionHelperIframe.setAttribute(
                "sandbox",
                "allow-scripts allow-same-origin"
              );

              sessionHelperIframe.addEventListener("load", () => {
                this.sessionHelperIsLoaded = true;

                setTimeout(() => {
                  if (this.onSessionHelper.length > 0) {
                    this.onSessionHelper.forEach((callback) => {
                      callback();
                    });

                    this.onSessionHelper = [];
                  }
                }, 0);
              });

              sessionHelperIframe.addEventListener("error", () => {
                Logger.error(
                  "Error Loading Session Helper. Using fallback"
                ).log();
                this.sessionHelperIsLoaded = true;
                this.useSessionFallback = true;

                setTimeout(() => {
                  if (this.onSessionHelper.length > 0) {
                    this.onSessionHelper.forEach((callback) => {
                      callback();
                    });

                    this.onSessionHelper = [];
                  }
                }, 0);
              });

              document.body.appendChild(sessionHelperIframe);
            } else {
              this.sessionHelperIsLoaded = true;

              if (this.onSessionHelper.length > 0) {
                this.onSessionHelper.forEach((callback) => {
                  callback();
                });

                this.onSessionHelper = [];
              }
            }

            this.sessionHelperIframe = sessionHelperIframe as HTMLIFrameElement;
          }
        } else {
          this.sessionHelperIsLoaded = true;
          this.useSessionFallback = true;

          if (this.onSessionHelper.length > 0) {
            this.onSessionHelper.forEach((callback) => {
              callback();
            });

            this.onSessionHelper = [];
          }
        }
      }, 0);
    }
  }

  // Private methods
  private isSourceTokenValid(): boolean {
    return this.sourceTokenExpiry > Date.now();
  }

  private registerSourceTokenRefresh() {
    if (this.refreshSourceTokenHandle) {
      clearTimeout(this.refreshSourceTokenHandle);
    }

    let nextRefresh = this.sourceTokenExpiry - 60 * 1000 - Date.now();

    if (isNaN(nextRefresh) || nextRefresh < MIN_TOKEN_REFRESH_INTERVAL_MS) {
      nextRefresh = MIN_TOKEN_REFRESH_INTERVAL_MS;
    }

    this.refreshSourceTokenHandle = setTimeout(async () => {
      await this.generateSourceToken();
    }, nextRefresh);
  }

  private sendSessionUtilMessage(message: any) {
    const sendMessage = () => {
      if (this.useSessionFallback) {
        switch (message.type) {
          case DodgeballSessionMessageType.GET_SESSION:
            let sessionId = null;
            if (!this.config.disableCookies) {
              const sessionCookie = Cookies.get(DODGEBALL_SESSION_KEY);
              if (sessionCookie) {
                try {
                  const parsedSessionCookie = JSON.parse(sessionCookie);
                  if (parsedSessionCookie.expiry > Date.now()) {
                    sessionId = parsedSessionCookie.sessionId;
                  } else {
                    Cookies.remove(DODGEBALL_SESSION_KEY);
                  }
                } catch (e) {
                  Cookies.remove(DODGEBALL_SESSION_KEY);
                }
              }
            } else {
              sessionId = window.localStorage.getItem(message.key);
            }

            window.postMessage(
              {
                type: "_DB_GET_RESPONSE",
                key: message.key,
                value: sessionId,
              },
              window.origin
            );
            break;
          case DodgeballSessionMessageType.SET_SESSION:
            if (!this.config.disableCookies) {
              const hostnameParts = window.location.hostname
                .split(".")
                .slice(-2);

              Cookies.set(DODGEBALL_SESSION_KEY, message.value, {
                domain: hostnameParts.join("."),
                expires: 365,
              });
            } else {
              window.localStorage.setItem(message.key, message.value);
            }
            break;
          case DodgeballSessionMessageType.CLEAR_SESSION:
            if (!this.config.disableCookies) {
              Cookies.remove(DODGEBALL_SESSION_KEY);
            } else {
              window.localStorage.removeItem(message.key);
            }
            break;
        }
      } else {
        this.sessionHelperIframe?.contentWindow?.postMessage(
          message,
          this.config.apiUrl as string
        );
      }
    };

    if (!this.sessionHelperIsLoaded) {
      this.onSessionHelper.push(sendMessage);
    } else {
      sendMessage();
    }
  }

  private async generateSourceToken() {
    const getSourceToken = async () => {
      const identifiers = (
        this.integrationLoader as IntegrationLoader
      ).filterIntegrationsByPurpose(
        this.integrations,
        IntegrationPurpose.IDENTIFY
      ) as unknown[] as IIdentifierIntegration[];

      const newSource = await this.identifier.generateSourceToken(identifiers);
      this.sourceToken = newSource.token;
      this.sourceTokenExpiry = newSource.expiry;

      this.registerSourceTokenRefresh();

      this.isSourcing = false;
      if (this.onSource.length > 0) {
        this.onSource.forEach((callback) => {
          callback();
        });

        this.onSource = [];
      }
    };

    return new Promise(async (resolve, reject) => {
      try {
        if (!this.isSourcing) {
          this.isSourcing = true;

          if (this.areIntegrationsLoaded) {
            const sourceToken = await getSourceToken();
            resolve(sourceToken);
          } else {
            this.onIntegrationsLoaded.push(async () => {
              const sourceToken = await getSourceToken();
              resolve(sourceToken);
            });
          }
        } else {
          this.onSource.push(() => {
            resolve(this.sourceToken);
          });
        }
      } catch (e) {
        Logger.error("Error Generating Source Token", e).log();
        this.isSourcing = false;
        reject(e);
      }
    });
  }

  private filterSeenSteps(steps: IVerificationStep[]): IVerificationStep[] {
    return steps.filter((step: IVerificationStep) => {
      return !this.seenSteps[step.id];
    });
  }

  private async handleVerificationStep(
    verification: IVerification,
    step: IVerificationStep,
    context: IVerificationContext,
    shouldContinuePolling: Function
  ): Promise<void> {
    // If we get here, the step is for us
    this.seenSteps[step.id] = step;

    // Since the step is for us, we need to display the integration
    if (step.name) {
      Logger.trace("Handle Verification Step - About to load:", {
        step: step,
      }).log();

      try {
        const integration = (await (
          this.integrationLoader as IntegrationLoader
        ).loadIntegration(
          {
            ...step,
          },
          step.id
        )) as Integration;

        if (this.integrations.indexOf(integration) < 0) {
          this.integrations.push(integration);
        }

        delete step.content;

        Logger.info("Handle Verification Step - Loaded integration", {
          integration: integration.name,
        });

        if (
          integration.purposes.includes(IntegrationPurpose.OBSERVE) &&
          this.config.sessionId
        ) {
          const sourceToken = await this.getSourceToken();

          (integration as unknown as IObserverIntegration).observe({
            sessionId: this.config.sessionId as string,
            userId: this.config.userId,
            sourceToken: sourceToken,
          });
          shouldContinuePolling();
        }

        if (integration.purposes.includes(IntegrationPurpose.IDENTIFY)) {
          (integration as unknown as IIdentifierIntegration).identify();
          shouldContinuePolling();
        }

        if (integration.purposes.includes(IntegrationPurpose.QUALIFY)) {
          (integration as unknown as IQualifierIntegration).qualify(context);
          shouldContinuePolling();
        }

        if (integration.purposes.includes(IntegrationPurpose.EXECUTE)) {
          const sourceToken = await this.getSourceToken();

          (integration as unknown as IExecutionIntegration).execute(
            step,
            context,
            (response, sendResponse = true) => {
              shouldContinuePolling();

              if (sendResponse) {
                return setVerificationResponse(
                  this.config.apiUrl as string,
                  this.publicKey,
                  sourceToken,
                  this.config.apiVersion,
                  verification,
                  step.verificationStepId,
                  response
                );
              } else {
                return Promise.resolve(null);
              }
            },
            async () => {
              if (context.onError) {
                await context.onError(cancelError());
              }
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

      if (this.config.isEnabled) {
        let isTerminal = false;
        let numIterations = 0;
        let isFirstIteration = true;
        let startTime = new Date();
        let currentPollingInterval = options.pollingInterval;

        const getRandomIntInclusive = (min: number, max: number) => {
          min = Math.ceil(min);
          max = Math.floor(max);
          return Math.floor(Math.random() * (max - min + 1) + min);
        };

        while (
          !isTerminal &&
          (numIterations == 0 || this.verifyTimeDelta(startTime, options))
        ) {
          if (numIterations > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, currentPollingInterval)
            );

            if (numIterations > options.numAtInitialPollingInterval) {
              // Start exponential backoff + jitter. See https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ for detailed explanation
              let temp = Math.min(
                options.maxPollingInterval,
                options.pollingInterval *
                  2 **
                    Math.max(
                      0,
                      numIterations - options.numAtInitialPollingInterval
                    )
              );
              currentPollingInterval =
                temp / 2 + getRandomIntInclusive(0, temp / 2);
            }

            try {
              let response = await queryVerification(
                this.config.apiUrl as string,
                this.publicKey,
                this.config.apiVersion,
                verification
              );

              verification = response.verification;
            } catch (e) {
              Logger.error("Error Querying Verification Status.", e).log();
            }
          }

          isTerminal = !this.isRunning(verification);
          numIterations += 1;

          if (!isTerminal) {
            let verificationSteps = this.filterSeenSteps(
              verification.nextSteps ?? []
            );
            while (verificationSteps && verificationSteps.length > 0) {
              // Wait until shouldContinuePolling is called by the handleVerificationStep
              await new Promise(async (resolve) => {
                await this.handleVerificationStep(
                  verification,
                  verificationSteps[0],
                  context,
                  resolve // This is shouldContinuePolling
                );
                verificationSteps = this.filterSeenSteps(verificationSteps);
              });

              // Reset pollingInterval, numIterations, and startTime
              numIterations = 1;
              currentPollingInterval = options.pollingInterval;
              startTime = new Date();
            }
          }

          if (this.isAllowed(verification)) {
            if (isFirstIteration) {
              if (context.onApproved) {
                await context.onApproved(verification);
              }
            } else {
              const executors: IExecutionIntegration[] = (
                this.integrationLoader as IntegrationLoader
              ).filterIntegrationsByPurpose(
                this.integrations,
                IntegrationPurpose.EXECUTE
              ) as any[];

              for (const executor of executors) {
                await executor.cleanup();
              }

              if (context.onVerified) {
                await context.onVerified(verification);
              }
            }
          } else if (this.isDenied(verification)) {
            this.clearScreen();
            if (context.onDenied) {
              await context.onDenied(verification);
            }
          } else if (this.isRunning(verification)) {
            if (verification.status === VerificationStatus.BLOCKED) {
              if (context.onBlocked) {
                await context.onBlocked(verification);
              }
            } else {
              if (context.onPending) {
                await context.onPending(verification);
              }
            }
          } else if (this.isUndecided(verification)) {
            if (context.onUndecided) {
              await context.onUndecided(verification);
            }
          } else if (this.hasError(verification)) {
            this.clearScreen();
            if (context.onError) {
              await context.onError(systemError(verification.error));
            }
          } else if (!this.isCancelled(verification)) {
            if (verification?.status) {
              Logger.error(
                `Unknown Verification State:\nStatus:${verification?.status}\nOutcome:${verification?.outcome}`
              ).log();
            } else {
              Logger.error(
                `Error Retrieving Verification:`,
                verification
              ).log();
            }
          }

          isFirstIteration = false;
        }

        return;
      } else {
        if (context.onApproved) {
          await context.onApproved(verification);
        }
      }
    })();
  }

  private clearScreen(): void {
    const executors: IExecutionIntegration[] = (
      this.integrationLoader as IntegrationLoader
    ).filterIntegrationsByPurpose(
      this.integrations,
      IntegrationPurpose.EXECUTE
    ) as any[];

    for (const executor of executors) {
      if (Object.getPrototypeOf(executor).constructor.removeModal) {
        Object.getPrototypeOf(executor).constructor.removeModal();
      }
    }
  }

  // Public methods
  public track(sessionId: string, userId?: string) {
    try {
      this.config.sessionId = sessionId;
      this.config.userId = userId;

      if (this.config.isEnabled) {
        if (sessionId) {
          const updateObservers = () => {
            (async () => {
              const sourceToken = await this.getSourceToken();

              const observers = (
                this.integrationLoader as IntegrationLoader
              ).filterIntegrationsByPurpose(
                this.integrations,
                IntegrationPurpose.OBSERVE
              ) as unknown[] as IObserverIntegration[];

              observers.forEach((observer) => {
                observer.observe({ sessionId, userId, sourceToken });
              });
            })();
          };

          if (this.areIntegrationsLoaded) {
            updateObservers();
          } else {
            this.onIntegrationsLoaded.push(updateObservers);
          }
        }
      }
    } catch (e) {
      Logger.error("Error Updating Observers", e).log();
    }

    return;
  }

  private async attachIdentifierMetadata(
    sourceToken: string
  ): Promise<{ [key: string]: any }> {
    try {
      const identifiers = (
        this.integrationLoader as IntegrationLoader
      ).filterIntegrationsByPurpose(
        this.integrations,
        IntegrationPurpose.IDENTIFY
      ) as unknown[] as IIdentifierIntegration[];

      return this.identifier.saveSourceTokenMetadata(sourceToken, identifiers);
    } catch (error) {
      Logger.error("Error Attaching Metadata", error).log();
      return Promise.reject(error);
    }
  }

  // This function may be called using async/await syntax or using a callback
  public async getSourceToken(onSource?: Function): Promise<string> {
    try {
      return new Promise(async (resolve) => {
        if (this.config.isEnabled) {
          if (this.isSourceTokenValid()) {
            await this.attachIdentifierMetadata(this.sourceToken);

            if (onSource) {
              onSource(this.sourceToken);
            }
            resolve(this.sourceToken);
          } else {
            if (onSource) {
              this.onSource.push(
                (async () => {
                  await this.attachIdentifierMetadata(this.sourceToken);
                  onSource(this.sourceToken);
                  resolve(this.sourceToken);
                }).bind(this)
              );
            } else {
              this.onSource.push(
                (async () => {
                  await this.attachIdentifierMetadata(this.sourceToken);
                  resolve(this.sourceToken);
                }).bind(this)
              );
            }

            (async () => {
              // Get a new source token
              await this.generateSourceToken();
            })();
          }
        } else {
          if (onSource) {
            onSource(DISABLED_SOURCE_TOKEN);
          }
          resolve(DISABLED_SOURCE_TOKEN);
        }
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  public handleVerification(
    verification: IVerification,
    context: IVerificationContext,
    options?: IHandleVerificationOptions
  ): void {
    let fullOptions = cloneDeep(DEFAULT_VERIFICATION_OPTIONS);
    fullOptions.maxDuration = options
      ? options.maxDuration
      : fullOptions.maxDuration;

    this.handleVerificationOutcome(verification, context, fullOptions);
  }

  public isRunning(verification: IVerification) {
    return (
      verification?.status === VerificationStatus.PENDING ||
      verification?.status === VerificationStatus.BLOCKED
    );
  }

  public isAllowed(verification: IVerification): boolean {
    return (
      verification?.status === VerificationStatus.COMPLETE &&
      verification?.outcome === VerificationOutcome.APPROVED
    );
  }

  public isDenied(verification: IVerification): boolean {
    return (
      verification?.status === VerificationStatus.COMPLETE &&
      verification?.outcome === VerificationOutcome.DENIED
    );
  }

  public isUndecided(verification: IVerification): boolean {
    return (
      verification?.status === VerificationStatus.COMPLETE &&
      verification?.outcome === VerificationOutcome.PENDING
    );
  }

  public isCancelled(verification: IVerification): boolean {
    return (
      verification?.status === VerificationStatus.COMPLETE &&
      verification?.outcome === VerificationOutcome.ERROR
    );
  }

  public hasError(verification: IVerification): boolean {
    return (
      verification?.status === VerificationStatus.FAILED &&
      verification?.outcome === VerificationOutcome.ERROR
    );
  }

  // This function may be called using async/await syntax or using a callback
  public async getSession(onSession?: Function): Promise<string | null> {
    try {
      return new Promise(async (resolve) => {
        if (this.config.isEnabled) {
          if (typeof window !== "undefined") {
            window.addEventListener("message", (event) => {
              if (
                event.data?.type ===
                  DodgeballSessionMessageType.GET_SESSION_RESPONSE &&
                event.data?.key === DODGEBALL_SESSION_KEY
              ) {
                let sessionId = null;
                let expiry = 0;
                try {
                  const sessionData = JSON.parse(event.data.value);
                  sessionId = sessionData.sessionId;
                  expiry = sessionData.expiry;
                } catch (e) {
                  sessionId = event.data.value;
                }

                if (expiry) {
                  const now = Date.now();
                  if (expiry < now) {
                    this.clearSession();
                    sessionId = null;
                  }
                }

                if (onSession) {
                  onSession(sessionId);
                }
                resolve(sessionId);
              }
            });

            this.sendSessionUtilMessage({
              type: DodgeballSessionMessageType.GET_SESSION,
              key: DODGEBALL_SESSION_KEY,
            });
          }
        } else {
          if (onSession) {
            onSession(DISABLED_SESSION_ID);
          }
          resolve(DISABLED_SESSION_ID);
        }
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  public setSession(sessionId: string, expiry?: number): void {
    this.sendSessionUtilMessage({
      type: DodgeballSessionMessageType.SET_SESSION,
      key: DODGEBALL_SESSION_KEY,
      value: JSON.stringify({
        sessionId: sessionId,
        expiry: expiry ?? 0,
      }),
    });
  }

  public clearSession(): void {
    this.sendSessionUtilMessage({
      type: DodgeballSessionMessageType.CLEAR_SESSION,
      key: DODGEBALL_SESSION_KEY,
    });
  }
}

// React hook for use with Dodgeball
export function useDodgeball(
  publicKey?: string,
  config?: IDodgeballConfig
): Dodgeball {
  if (typeof window !== "undefined") {
    if (!window.hasOwnProperty("dodgeball")) {
      const dodgeball = new Dodgeball(publicKey as string, config);
      window.dodgeball = dodgeball;
      return dodgeball;
    } else {
      return window.dodgeball;
    }
  }
  return new Dodgeball(publicKey as string, config);
}

declare global {
  interface Window {
    Dodgeball: typeof Dodgeball;
    dodgeball: Dodgeball;
    _dodgeball_init_conf: IInitConfig;
  }
}
