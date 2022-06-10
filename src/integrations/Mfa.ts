import { getMfaConfigurableStyle } from "./../utilities";
import { MfaConfigurableStyle } from "./../types";
import {
  IExecutionIntegration,
  IntegrationName,
  IntegrationPurpose,
  IStepResponse,
  IVerificationContext,
  IVerificationStep,
  VerificationErrorType,
} from "../types";
import { Logger } from "../logger";
import Integration from "./Integration";
import {
  cleanupNodes,
  createEl,
  NodeCleanupMethod,
  popupModal,
} from "../utilities";

export interface IMfaChannel {
  channel: string;
  target: string;
  id: string;
}

export interface IMfaConfig {
  mfaChannels: IMfaChannel[];
  tryNum?: number;
  lastCodeInvalid?: boolean;
  nextCodeSendAt?: number; // Unix timestamp (or null if not limited)
  nextCodeValidateAt?: number; // Unix timestamp (or null if not limited)
  numChars?: number;
  customStyles?: { [key in MfaConfigurableStyle]?: string };
}

export enum MfaChannelType {
  PHONE = "PHONE",
  EMAIL = "EMAIL",
}

export enum MfaClientOperation {
  CANCEL = "CANCEL",
  RESEND = "RESEND",
  AUTHORIZE_MFA_CHANNEL = "AUTHORIZE_MFA_CHANNEL",
  CLIENT_AUTHORIZATION = "CLIENT_AUTHORIZATION",
  GET_TOKEN = "GET_TOKEN",
  TOKEN_RESPONSE = "TOKEN_RESPONSE",
  TOKEN_VERIFIED = "TOKEN_VERIFIED",
}

export interface IMfaProps {
  url: string;
  config: IMfaConfig;
  requestId: string;
}

interface IControlsParams {
  cancelText: string;
  onCancel: Function;
  submitText: string;
  processingText?: string;
  onSubmit: Function;
}

interface IControlsResult {
  controls: HTMLElement;
  submitRef: HTMLButtonElement;
  cancelRef: HTMLButtonElement;
}

interface IContentContainerParams {
  titleText: string;
  subtitleText: string;
}

export default class MfaIntegration
  extends Integration
  implements IExecutionIntegration
{
  authorizedChannel: IMfaChannel | null = null;
  static modalElement: HTMLElement | null = null;

  constructor({ url, config, requestId }: IMfaProps) {
    super({
      url: "",
      config: config,
      name: IntegrationName.MFA,
      purposes: [IntegrationPurpose.EXECUTE],
      requestId,
    });
    Logger.trace("MFA - constructor").log();
  }

  public hasLoaded(): boolean {
    return true;
  }

  public async configure() {}

  public async reconfigure({
    url,
    config,
    requestId,
  }: IMfaProps): Promise<void> {
    Logger.trace("MFA - reconfigure").log();
    this._resetConfig({ url, config, requestId });
    await this.configure();
  }

  private formatChannel(channel: IMfaChannel): string {
    switch (channel?.channel) {
      case MfaChannelType.PHONE:
        return `XXX-XXX-${channel.target?.substring(
          channel.target.length - 4
        )}`;
      case MfaChannelType.EMAIL:
        return `******${channel.target.split("@")[1]}`;
    }

    return "";
  }

  private getStyle(configurableStyle: MfaConfigurableStyle): string {
    return getMfaConfigurableStyle(
      configurableStyle,
      this.config as IMfaConfig
    );
  }

  private getHeader(): HTMLElement {
    const headerContainer = createEl("div", {
      "background-color": this.getStyle(
        MfaConfigurableStyle.HEADER_BACKGROUND_COLOR
      ),
      "border-top-left-radius": this.getStyle(
        MfaConfigurableStyle.MODAL_BORDER_RADIUS
      ),
      "border-top-right-radius": this.getStyle(
        MfaConfigurableStyle.MODAL_BORDER_RADIUS
      ),
      padding: "20px 30px",
      position: "relative",
      display: "flex",
      "justify-content": "start",
      gap: "10px",
      "border-bottom-width": this.getStyle(
        MfaConfigurableStyle.HEADER_UNDERLINE_THICKNESS
      ),
      "border-bottom-color": this.getStyle(
        MfaConfigurableStyle.HEADER_UNDERLINE_COLOR
      ),
    });

    // Only add the header logo if set
    const logoUrl = this.getStyle(MfaConfigurableStyle.HEADER_LOGO);

    if (logoUrl) {
      const headerLogo = createEl("img", {
        "justify-self": "center",
      });
      headerLogo.setAttribute("src", logoUrl);
      headerContainer.appendChild(headerLogo);
    }

    const headerText = createEl("div", {
      color: this.getStyle(MfaConfigurableStyle.HEADER_TEXT_COLOR),
      "font-size": this.getStyle(MfaConfigurableStyle.HEADER_TEXT_SIZE),
      "font-weight": this.getStyle(MfaConfigurableStyle.HEADER_TEXT_WEIGHT),
      "justify-self": "center",
    });

    headerText.innerText = this.getStyle(
      MfaConfigurableStyle.HEADER_TITLE_TEXT
    );

    headerContainer.appendChild(headerText);

    // const closeButton = createEl("div", {
    //   "border-radius": "4px",
    //   "color": "#555555"
    // })

    return headerContainer;
  }

  private getContentContainer({
    titleText,
    subtitleText,
  }: IContentContainerParams): HTMLElement {
    const contentContainer = createEl("div", {
      "background-color": this.getStyle(
        MfaConfigurableStyle.MODAL_BACKGROUND_COLOR
      ),
      padding: "30px 60px",
      "border-color": this.getStyle(MfaConfigurableStyle.CONTENT_BORDER_COLOR),
      "border-left": this.getStyle(
        MfaConfigurableStyle.CONTENT_BORDER_THICKNESS
      ),
      "border-right": this.getStyle(
        MfaConfigurableStyle.CONTENT_BORDER_THICKNESS
      ),
      "border-bottom": this.getStyle(
        MfaConfigurableStyle.CONTENT_BORDER_THICKNESS
      ),
      "border-bottom-left-radius": this.getStyle(
        MfaConfigurableStyle.MODAL_BORDER_RADIUS
      ),
      "border-bottom-right-radius": this.getStyle(
        MfaConfigurableStyle.MODAL_BORDER_RADIUS
      ),
    });

    const contentTitle = createEl("div", {
      "font-size": this.getStyle(MfaConfigurableStyle.CONTENT_TITLE_SIZE),
      color: this.getStyle(MfaConfigurableStyle.CONTENT_TITLE_COLOR),
      "font-weight": this.getStyle(MfaConfigurableStyle.CONTENT_TITLE_WEIGHT),
      "padding-bottom": "18px",
    });

    contentTitle.innerText = titleText;

    contentContainer.appendChild(contentTitle);

    // Add the content subtitle
    const contentSubtitle = createEl("div", {
      "font-size": this.getStyle(MfaConfigurableStyle.CONTENT_SUBTITLE_SIZE),
      color: this.getStyle(MfaConfigurableStyle.CONTENT_SUBTITLE_COLOR),
      "font-weight": this.getStyle(
        MfaConfigurableStyle.CONTENT_SUBTITLE_WEIGHT
      ),
      "padding-bottom": "18px",
    });

    contentSubtitle.innerText = subtitleText;

    contentContainer.appendChild(contentSubtitle);

    return contentContainer;
  }

  private getControls({
    cancelText,
    onCancel,
    submitText,
    onSubmit,
    processingText,
  }: IControlsParams): IControlsResult {
    processingText = processingText ?? "Processing";
    const controlsContainer = createEl("div", {
      display: "flex",
      gap: this.getStyle(MfaConfigurableStyle.BUTTON_GAP),
      "justify-content": "center",
      "padding-top": "30px",
    });

    // Add the cancel button
    const cancelButton = createEl("button", {
      color: this.getStyle(MfaConfigurableStyle.CANCEL_BUTTON_TEXT_COLOR),
      "font-size": this.getStyle(MfaConfigurableStyle.BUTTON_TEXT_SIZE),
      "font-weight": this.getStyle(MfaConfigurableStyle.BUTTON_TEXT_WEIGHT),
      "background-color": this.getStyle(
        MfaConfigurableStyle.CANCEL_BUTTON_COLOR
      ),
      "border-color": this.getStyle(
        MfaConfigurableStyle.CANCEL_BUTTON_BORDER_COLOR
      ),
      "border-radius": this.getStyle(MfaConfigurableStyle.BUTTON_BORDER_RADIUS),
      "border-width": this.getStyle(
        MfaConfigurableStyle.BUTTON_BORDER_THICKNESS
      ),
      "padding-left": this.getStyle(
        MfaConfigurableStyle.BUTTON_HORIZONTAL_PADDING
      ),
      "padding-right": this.getStyle(
        MfaConfigurableStyle.BUTTON_HORIZONTAL_PADDING
      ),
      "padding-top": this.getStyle(
        MfaConfigurableStyle.BUTTON_VERTICAL_PADDING
      ),
      "padding-bottom": this.getStyle(
        MfaConfigurableStyle.BUTTON_VERTICAL_PADDING
      ),
    }) as HTMLButtonElement;
    cancelButton.innerText = cancelText;
    cancelButton.addEventListener("mouseover", () => {
      cancelButton.style.color = this.getStyle(
        MfaConfigurableStyle.CANCEL_BUTTON_HOVER_TEXT_COLOR
      );
      cancelButton.style.backgroundColor = this.getStyle(
        MfaConfigurableStyle.CANCEL_BUTTON_HOVER_COLOR
      );
      cancelButton.style.borderColor = this.getStyle(
        MfaConfigurableStyle.CANCEL_BUTTON_HOVER_BORDER_COLOR
      );
    });
    cancelButton.addEventListener("mouseleave", () => {
      cancelButton.style.color = this.getStyle(
        MfaConfigurableStyle.CANCEL_BUTTON_TEXT_COLOR
      );
      cancelButton.style.backgroundColor = this.getStyle(
        MfaConfigurableStyle.CANCEL_BUTTON_COLOR
      );
      cancelButton.style.borderColor = this.getStyle(
        MfaConfigurableStyle.CANCEL_BUTTON_BORDER_COLOR
      );
    });

    cancelButton.addEventListener("click", () => {
      return onCancel();
    });

    controlsContainer.appendChild(cancelButton);

    // Add the submit button
    const submitButton = createEl("button", {
      color: this.getStyle(MfaConfigurableStyle.SUBMIT_BUTTON_TEXT_COLOR),
      "font-size": this.getStyle(MfaConfigurableStyle.BUTTON_TEXT_SIZE),
      "font-weight": this.getStyle(MfaConfigurableStyle.BUTTON_TEXT_WEIGHT),
      "background-color": this.getStyle(
        MfaConfigurableStyle.SUBMIT_BUTTON_COLOR
      ),
      "border-color": this.getStyle(
        MfaConfigurableStyle.SUBMIT_BUTTON_BORDER_COLOR
      ),
      "border-radius": this.getStyle(MfaConfigurableStyle.BUTTON_BORDER_RADIUS),
      "border-width": this.getStyle(
        MfaConfigurableStyle.BUTTON_BORDER_THICKNESS
      ),
      "padding-left": this.getStyle(
        MfaConfigurableStyle.BUTTON_HORIZONTAL_PADDING
      ),
      "padding-right": this.getStyle(
        MfaConfigurableStyle.BUTTON_HORIZONTAL_PADDING
      ),
      "padding-top": this.getStyle(
        MfaConfigurableStyle.BUTTON_VERTICAL_PADDING
      ),
      "padding-bottom": this.getStyle(
        MfaConfigurableStyle.BUTTON_VERTICAL_PADDING
      ),
    }) as HTMLButtonElement;
    submitButton.innerText = submitText;
    submitButton.addEventListener("mouseover", () => {
      if (!submitButton.disabled) {
        submitButton.style.color = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_HOVER_TEXT_COLOR
        );
        submitButton.style.backgroundColor = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_HOVER_COLOR
        );
        submitButton.style.borderColor = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_HOVER_BORDER_COLOR
        );
      }
    });
    submitButton.addEventListener("mouseleave", () => {
      if (!submitButton.disabled) {
        submitButton.style.color = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_TEXT_COLOR
        );
        submitButton.style.backgroundColor = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_COLOR
        );
        submitButton.style.borderColor = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_BORDER_COLOR
        );
      }
    });

    submitButton.addEventListener("click", () => {
      if (!submitButton.disabled) {
        submitButton.innerText = processingText as string;
        submitButton.disabled = true;
        submitButton.style.color = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_TEXT_COLOR
        );
        submitButton.style.borderColor = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_BORDER_COLOR
        );
        submitButton.style.backgroundColor = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_COLOR
        );

        return onSubmit();
      }
    });

    controlsContainer.appendChild(submitButton);

    return {
      controls: controlsContainer,
      submitRef: submitButton as HTMLButtonElement,
      cancelRef: cancelButton as HTMLButtonElement,
    };
  }

  formatAuthorization(
    parent: HTMLElement,
    rootElement: HTMLElement,
    responseConsumer: (stepResponse: IStepResponse) => Promise<any>
  ) {
    Logger.trace("MFA - formatAuthorization", {
      config: this.config,
    }).log();

    const configs = this.config as IMfaConfig;

    // Add the header
    parent.appendChild(this.getHeader());

    // Add the Content
    const contentContainer = this.getContentContainer({
      titleText: this.getStyle(MfaConfigurableStyle.CONTENT_TITLE_TEXT),
      subtitleText: this.getStyle(MfaConfigurableStyle.CONTENT_VERIFY_TEXT),
    });

    // Add the content description
    const contentDescription = createEl("div", {
      "font-size": this.getStyle(MfaConfigurableStyle.CONTENT_DESCRIPTION_SIZE),
      color: this.getStyle(MfaConfigurableStyle.CONTENT_DESCRIPTION_COLOR),
      "font-weight": this.getStyle(
        MfaConfigurableStyle.CONTENT_DESCRIPTION_WEIGHT
      ),
      "padding-bottom": "10px",
    });

    contentDescription.innerText = this.getStyle(
      MfaConfigurableStyle.CONTENT_EXPLANATION_TEXT
    );

    contentContainer.appendChild(contentDescription);

    // Add the channel selection section
    const channelBoxes: HTMLInputElement[] = [];

    const optionsContainer = createEl("div", {
      "padding-bottom": "10px",
    });

    configs.mfaChannels.forEach((channel) => {
      // For each target channel, add a selection radio box to the display
      // as well as to the list of channel boxes to check on authorize button click
      const optionContainer = createEl("div", {
        "padding-bottom": "5px",
      });

      const option = createEl("input", {
        "font-size": this.getStyle(
          MfaConfigurableStyle.CONTENT_OPTION_TEXT_SIZE
        ),
        "font-weight": this.getStyle(
          MfaConfigurableStyle.CONTENT_OPTION_TEXT_WEIGHT
        ),
        color: this.getStyle(MfaConfigurableStyle.CONTENT_OPTION_TEXT_COLOR),
        "margin-right": "10px",
      }) as HTMLInputElement;
      option.type = "radio";
      option.name = "selected-mfa-channel";
      option.id = channel.id;
      option.value = `${channel.channel} ${channel.target}`;
      option.innerText = `${channel.channel} ${channel.target}`;

      option.addEventListener("click", () => {
        if (!option.disabled) {
          toggleSubmitEnabled(true);
        }
      });

      channelBoxes.push(option);

      const optionLabel = createEl("label", {
        "font-size": this.getStyle(
          MfaConfigurableStyle.CONTENT_OPTION_TEXT_SIZE
        ),
        "font-weight": this.getStyle(
          MfaConfigurableStyle.CONTENT_OPTION_TEXT_WEIGHT
        ),
        color: this.getStyle(MfaConfigurableStyle.CONTENT_OPTION_TEXT_COLOR),
      });

      optionLabel.setAttribute("for", channel.id);
      optionLabel.innerText = this.formatChannel(channel);

      optionContainer.appendChild(option);
      optionContainer.appendChild(optionLabel);

      optionsContainer.appendChild(optionContainer);
    });

    contentContainer.appendChild(optionsContainer);

    // Add the disclaimer
    const contentDisclaimer = createEl("div", {
      "font-size": this.getStyle(MfaConfigurableStyle.CONTENT_DESCRIPTION_SIZE),
      color: this.getStyle(MfaConfigurableStyle.CONTENT_DESCRIPTION_COLOR),
      "font-weight": this.getStyle(
        MfaConfigurableStyle.CONTENT_DESCRIPTION_WEIGHT
      ),
      "padding-bottom": "10px",
    });

    contentDisclaimer.innerText = this.getStyle(
      MfaConfigurableStyle.CONTENT_DISCLAIMER_TEXT
    );

    contentContainer.appendChild(contentDisclaimer);

    // Add the buttons section
    const { controls, submitRef } = this.getControls({
      cancelText: "Cancel",
      submitText: "Submit",
      onCancel: () => {
        return this.onCancel(rootElement, responseConsumer);
      },
      onSubmit: () => {
        return this.onAuthorize(
          channelBoxes,
          () => {
            return cleanupNodes(rootElement, parent);
          },
          responseConsumer
        );
      },
    });

    const toggleSubmitEnabled = (isEnabled: boolean) => {
      submitRef.disabled = !isEnabled;
      // Then update the styles
      if (isEnabled) {
        submitRef.style.color = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_TEXT_COLOR
        );
        submitRef.style.borderColor = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_BORDER_COLOR
        );
        submitRef.style.backgroundColor = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_COLOR
        );
      } else {
        submitRef.style.color = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_TEXT_COLOR
        );
        submitRef.style.borderColor = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_BORDER_COLOR
        );
        submitRef.style.backgroundColor = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_COLOR
        );
      }
    };

    toggleSubmitEnabled(false);

    contentContainer.appendChild(controls);

    parent.appendChild(contentContainer);
  }

  formatGetCode(
    parent: HTMLElement,
    rootElement: HTMLElement,
    responseConsumer: (stepResponse: IStepResponse) => Promise<any>
  ) {
    Logger.trace("MFA - formatGetCode").log();
    const configs = this.config as IMfaConfig;

    const numChars = configs.numChars ?? 6;
    let isSubmitEnabled = false;
    let shouldDisableRequestNewCode = false;
    let toggleSubmitEnabled: Function;
    let toggleRequestNewCodeEnabled: Function;
    let shouldDisableCodeInput = false;
    let toggleCodeInputEnabled: Function;

    // Add the header
    parent.appendChild(this.getHeader());

    // Add the content
    const contentContainer = this.getContentContainer({
      titleText: this.getStyle(MfaConfigurableStyle.CONTENT_TITLE_TEXT),
      subtitleText: this.getStyle(MfaConfigurableStyle.CONTENT_VERIFY_TEXT),
    });

    let now = Date.now();
    const hasSendLimit =
      configs.nextCodeSendAt != null && configs.nextCodeSendAt > now;
    const hasValidateLimit =
      configs.nextCodeValidateAt != null && configs.nextCodeValidateAt > now;

    if (hasSendLimit || hasValidateLimit || configs.lastCodeInvalid) {
      let errorText = "";
      let errorDescription = "";
      let timeDiff = 0;

      if (hasSendLimit) {
        timeDiff = Math.floor(
          ((configs.nextCodeValidateAt as number) - now) / 1000
        );
        errorText = "Maximum Number of Code Requests Exceeded";
        errorDescription = `Please wait to request a new code... ${timeDiff}sec`;
        shouldDisableRequestNewCode = true;
      } else if (hasValidateLimit) {
        timeDiff = Math.floor(
          ((configs.nextCodeValidateAt as number) - now) / 1000
        );
        errorText = "Maximum Number of Verification Attempts Exceeded";
        errorDescription = `Please wait to try another code... ${timeDiff}sec`;
        shouldDisableCodeInput = true;
      } else if (configs.lastCodeInvalid) {
        errorText = "Incorrect Authorization Code";
        errorDescription = "Please enter the correct authorization code.";
      }

      const errorContainer = createEl("div", {
        padding: "8px 10px",
        border: "1px solid #CC0000",
        "background-color": "#FFEEEE",
        width: "100%",
        display: "flex",
        "justify-content": "start",
        gap: "10px",
        "align-items": "center",
        "margin-top": "-8px",
        "margin-bottom": "10px",
      });

      const errorIcon = createEl("div", {
        color: "#CC0000",
        width: "32px",
        height: "32px",
        "justify-self": "center",
      });

      const openLockIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="2 2 16 16" fill="currentColor">
          <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
        </svg>`;

      const closedLockIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="2 2 16 16" fill="currentColor">
          <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
        </svg>`;

      errorIcon.innerHTML = closedLockIcon;

      errorContainer.appendChild(errorIcon);

      const errorCopyContainer = createEl("div", {
        "justify-self": "center",
      });

      const errorTitle = createEl("div", {
        color: "#CC0000",
        "font-size": "16px",
        "font-weight": "600",
      });

      errorTitle.innerText = errorText;

      errorCopyContainer.appendChild(errorTitle);

      const errorSubtitle = createEl("div", {
        color: "#333333",
        "font-size": "14px",
        "font-weight": "300",
      });

      errorSubtitle.innerText = errorDescription;

      errorCopyContainer.appendChild(errorSubtitle);

      errorContainer.appendChild(errorCopyContainer);

      contentContainer.appendChild(errorContainer);

      if (hasSendLimit || hasValidateLimit) {
        const canUseInterval = setInterval(() => {
          now = Date.now();
          // Update the display / enable the UI
          if (hasSendLimit) {
            timeDiff = Math.floor(
              ((configs.nextCodeValidateAt as number) - now) / 1000
            );
            if (timeDiff > 0) {
              errorDescription = `Please wait to request a new code... ${timeDiff}sec`;
            } else {
              errorDescription =
                "You may now request a new authorization code.";
            }
          } else if (hasValidateLimit) {
            timeDiff = Math.floor(
              ((configs.nextCodeValidateAt as number) - now) / 1000
            );
            if (timeDiff > 0) {
              errorDescription = `Please wait to try another code... ${timeDiff}sec`;
            } else {
              errorDescription = "You may now try submitting another code.";
            }
          }

          errorSubtitle.innerText = errorDescription;

          if (timeDiff < 0) {
            errorIcon.style.color = "#999999";
            errorIcon.innerHTML = openLockIcon;

            clearInterval(canUseInterval);
            toggleSubmitEnabled(true);
            toggleRequestNewCodeEnabled(true);
            toggleCodeInputEnabled(true);
          }
        }, 1000);
      }
    }

    // Add the content prompt
    const contentPrompt = createEl("div", {
      "font-size": this.getStyle(MfaConfigurableStyle.CONTENT_DESCRIPTION_SIZE),
      color: this.getStyle(MfaConfigurableStyle.CONTENT_DESCRIPTION_COLOR),
      "font-weight": this.getStyle(
        MfaConfigurableStyle.CONTENT_DESCRIPTION_WEIGHT
      ),
      "padding-bottom": "10px",
    });

    contentPrompt.innerText = this.getStyle(
      MfaConfigurableStyle.CONTENT_PROMPT_TEXT
    );

    contentContainer.appendChild(contentPrompt);

    // Add the channel it was sent to
    const channelContainer = createEl("div", {
      "font-size": this.getStyle(MfaConfigurableStyle.CONTENT_OPTION_TEXT_SIZE),
      "font-weight": this.getStyle(
        MfaConfigurableStyle.CONTENT_OPTION_TEXT_WEIGHT
      ),
      color: this.getStyle(MfaConfigurableStyle.CONTENT_OPTION_TEXT_COLOR),
      "padding-bottom": "10px",
    });

    channelContainer.innerText = this.formatChannel(
      this.authorizedChannel as IMfaChannel
    );

    contentContainer.appendChild(channelContainer);

    // Add the code input title
    const codeInputLabel = createEl("div", {
      "font-size": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_LABEL_TEXT_SIZE
      ),
      "font-weight": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_LABEL_TEXT_WEIGHT
      ),
      color: this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_LABEL_TEXT_COLOR
      ),
      "padding-bottom": "8px",
    });

    codeInputLabel.innerText = `Enter the ${numChars}-digit code`;

    contentContainer.appendChild(codeInputLabel);

    // Add the code input
    const codeInput = createEl("input", {
      "font-size": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_TEXT_SIZE
      ),
      "font-weight": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_TEXT_WEIGHT
      ),
      color: this.getStyle(MfaConfigurableStyle.CONTENT_CODE_INPUT_TEXT_COLOR),
      "border-width": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_BORDER_THICKNESS
      ),
      "border-color": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_BORDER_COLOR
      ),
      "border-radius": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_BORDER_RADIUS
      ),
      "padding-top": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_VERTICAL_PADDING
      ),
      "padding-bottom": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_VERTICAL_PADDING
      ),
      "padding-left": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_HORIZONTAL_PADDING
      ),
      "padding-right": this.getStyle(
        MfaConfigurableStyle.CONTENT_CODE_INPUT_HORIZONTAL_PADDING
      ),
    }) as HTMLInputElement;

    codeInput.placeholder = "_ ".repeat(numChars);
    codeInput.maxLength = numChars;
    codeInput.autofocus = true;

    codeInput.addEventListener("input", (ev) => {
      if (codeInput.disabled) {
        return;
      }

      if (codeInput.value?.length === numChars && !isSubmitEnabled) {
        toggleSubmitEnabled(true);
      } else if (isSubmitEnabled) {
        toggleSubmitEnabled(false);
      }
    });

    contentContainer.appendChild(codeInput);

    // Add the request another code button
    const requestAnotherContainer = createEl("div", {
      "padding-top": "10px",
    });

    const requestAnother = createEl("button", {
      "font-size": this.getStyle(MfaConfigurableStyle.CONTENT_HELP_LINK_SIZE),
      "font-weight": this.getStyle(
        MfaConfigurableStyle.CONTENT_HELP_LINK_WEIGHT
      ),
      color: this.getStyle(MfaConfigurableStyle.CONTENT_HELP_LINK_COLOR),
      cursor: "pointer",
      display: "inline-block",
      outline: "none",
      border: "none",
    }) as HTMLButtonElement;

    requestAnother.innerText = this.getStyle(
      MfaConfigurableStyle.CONTENT_RESEND_CODE_TEXT
    );

    requestAnother.addEventListener("mouseover", () => {
      if (!requestAnother.disabled) {
        requestAnother.style.color = this.getStyle(
          MfaConfigurableStyle.CONTENT_HELP_LINK_HOVER_COLOR
        );
      }
    });

    requestAnother.addEventListener("mouseout", () => {
      if (!requestAnother.disabled) {
        requestAnother.style.color = this.getStyle(
          MfaConfigurableStyle.CONTENT_HELP_LINK_COLOR
        );
      }
    });

    requestAnother.addEventListener("click", () => {
      if (!requestAnother.disabled) {
        return this.onResend(rootElement, responseConsumer);
      }
    });

    requestAnotherContainer.appendChild(requestAnother);

    contentContainer.appendChild(requestAnotherContainer);

    // Add the controls
    const { controls, submitRef } = this.getControls({
      cancelText: "Cancel",
      submitText: "Submit",
      onCancel: () => {
        return this.onCancel(rootElement, responseConsumer);
      },
      onSubmit: () => {
        return this.onGetCode(codeInput, rootElement, responseConsumer);
      },
    });

    toggleSubmitEnabled = (isEnabled: boolean) => {
      isSubmitEnabled = isEnabled;
      submitRef.disabled = !isEnabled;
      // Then update the styles
      if (isEnabled) {
        submitRef.style.color = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_TEXT_COLOR
        );
        submitRef.style.borderColor = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_BORDER_COLOR
        );
        submitRef.style.backgroundColor = this.getStyle(
          MfaConfigurableStyle.SUBMIT_BUTTON_COLOR
        );
      } else {
        submitRef.style.color = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_TEXT_COLOR
        );
        submitRef.style.borderColor = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_BORDER_COLOR
        );
        submitRef.style.backgroundColor = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_COLOR
        );
      }
    };

    toggleRequestNewCodeEnabled = (isEnabled: boolean) => {
      requestAnother.disabled = !isEnabled;
      if (isEnabled) {
        requestAnother.style.color = this.getStyle(
          MfaConfigurableStyle.CONTENT_HELP_LINK_COLOR
        );
      } else {
        requestAnother.style.color = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_TEXT_COLOR
        );
      }
    };

    toggleCodeInputEnabled = (isEnabled: boolean) => {
      codeInput.disabled = !isEnabled;
      if (isEnabled) {
        codeInput.style.color = this.getStyle(
          MfaConfigurableStyle.CONTENT_CODE_INPUT_TEXT_COLOR
        );
        codeInput.style.borderColor = this.getStyle(
          MfaConfigurableStyle.CONTENT_CODE_INPUT_BORDER_COLOR
        );
      } else {
        codeInput.style.color = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_TEXT_COLOR
        );
        codeInput.style.borderColor = this.getStyle(
          MfaConfigurableStyle.DISABLED_BUTTON_BORDER_COLOR
        );
      }
    };

    toggleSubmitEnabled(false);
    toggleRequestNewCodeEnabled(!shouldDisableRequestNewCode);
    toggleCodeInputEnabled(!shouldDisableCodeInput);

    contentContainer.appendChild(controls);

    parent.appendChild(contentContainer);
  }

  formatCodeApproved(parent: HTMLElement, rootElement: HTMLElement) {
    Logger.trace("MFA - formatCodeApproved").log();
    const configs = this.config as IMfaConfig;

    parent.appendChild(this.getHeader());

    const contentContainer = this.getContentContainer({
      titleText: this.getStyle(
        MfaConfigurableStyle.CONTENT_VERIFIED_TITLE_TEXT
      ),
      subtitleText: this.getStyle(
        MfaConfigurableStyle.CONTENT_VERIFIED_SUBTITLE_TEXT
      ),
    });

    const successContainer = createEl("div", {
      padding: "8px 10px",
      border: "1px solid #008800",
      "background-color": "#ddffee",
      width: "100%",
      display: "flex",
      "justify-content": "start",
      gap: "10px",
      "align-items": "center",
    });

    const successIcon = createEl("div", {
      color: "#008800",
      width: "32px",
      height: "32px",
      "justify-self": "center",
    });

    successIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="2 2 16 16" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
      </svg>`;

    successContainer.appendChild(successIcon);

    const successCopyContainer = createEl("div", {
      "justify-self": "center",
    });

    const successTitle = createEl("div", {
      color: "#008800",
      "font-size": "16px",
      "font-weight": "600",
    });

    successTitle.innerText = "Identity Verification Successful";

    successCopyContainer.appendChild(successTitle);

    const successSubtitle = createEl("div", {
      color: "#333333",
      "font-size": "14px",
      "font-weight": "300",
    });

    successSubtitle.innerText = "Thank you for confirming your identity.";

    successCopyContainer.appendChild(successSubtitle);

    successContainer.appendChild(successCopyContainer);

    contentContainer.appendChild(successContainer);

    const { controls } = this.getControls({
      cancelText: "Cancel",
      submitText: "Close",
      onCancel: () => {
        return MfaIntegration.removeModal();
      },
      onSubmit: () => {
        return MfaIntegration.removeModal();
      },
    });

    contentContainer.appendChild(controls);

    parent.appendChild(contentContainer);

    // Now set a timeout to auto-close the modal
    setTimeout(() => {
      MfaIntegration.removeModal();
    }, parseInt(this.getStyle(MfaConfigurableStyle.COMPLETE_AUTO_CLOSE_DELAY)));
  }

  async onCancel(
    modal: HTMLElement,
    responseConsumer: (stepResponse: IStepResponse) => Promise<any>
  ): Promise<void> {
    Logger.trace("MFA - onCancel").log();
    let wasSuccessful = false;
    let response = {
      pluginName: "MFA",
      methodName: MfaClientOperation.CANCEL,
    };

    try {
      await responseConsumer(response);
      wasSuccessful = true;
    } catch (error) {
      Logger.error("MFA - onCancel: error", error).log();
    }

    if (wasSuccessful) {
      MfaIntegration.removeModal();
    }
  }

  private setAuthorizedChannel(channelId: string) {
    const configs = this.config as IMfaConfig;
    this.authorizedChannel = configs.mfaChannels.find(
      (channel) => channel?.id === channelId
    ) as IMfaChannel;
  }

  public async onAuthorize(
    radioBoxes: HTMLInputElement[],
    cleanupMethod: NodeCleanupMethod | null,
    responseConsumer: (stepResponse: IStepResponse) => Promise<any>
  ): Promise<void> {
    Logger.trace("MFA - onAuthorize").log();

    let selectedId: string | null = null;
    for (var box of radioBoxes) {
      if (box.checked) {
        selectedId = box.id;
        break;
      }
    }

    if (selectedId) {
      // Set the selected channel
      this.setAuthorizedChannel(selectedId);

      let stepResponse = {
        pluginName: "MFA",
        methodName: MfaClientOperation.CLIENT_AUTHORIZATION,
        data: {
          authorizedChannelId: selectedId,
        },
      };
      let response = await responseConsumer(stepResponse);
      Logger.trace("MFA - onAuthorize: response", { response: response }).log();
    }
  }

  public async onResend(
    modal: HTMLElement,
    responseConsumer: (stepResponse: IStepResponse) => Promise<any>
  ): Promise<void> {
    Logger.trace("MFA - onResend").log();
    MfaIntegration.removeModal();
    popupModal(
      MfaIntegration.getModal,
      (modal, rootElement) => {
        this.formatAuthorization(modal, rootElement, responseConsumer);
      },
      this.config as IMfaConfig
    );
  }

  public async onGetCode(
    codeInput: HTMLInputElement,
    modal: HTMLElement,
    responseConsumer: (stepResponse: IStepResponse) => Promise<any>
  ): Promise<void> {
    try {
      Logger.trace("MFA - onGetCode").log();
      let inputText = codeInput.value;

      let config = this.config as IMfaConfig;
      let numChars = config.numChars ?? 6;

      let wasSuccessful = false;
      if (inputText && inputText.length == numChars) {
        let stepResponse = {
          pluginName: "MFA",
          methodName: MfaClientOperation.TOKEN_RESPONSE,
          data: {
            token: inputText,
          },
        };

        try {
          const response = await responseConsumer(stepResponse);
          Logger.trace("MFA - onGetCode: response", {
            response: response,
          }).log();
          wasSuccessful = true;
        } catch (error) {
          Logger.error("MFA - onGetCode: error", error).log();
        }
      }
    } catch (error) {
      Logger.error("MFA - onGetCode: error", error).log();
    }
  }

  public static async getModal(): Promise<HTMLElement> {
    if (!MfaIntegration.modalElement) {
      let newElement = document.createElement("div");

      if (!MfaIntegration.modalElement) {
        MfaIntegration.modalElement = newElement;
      }
    }

    return MfaIntegration.modalElement as HTMLElement;
  }

  public static async removeModal() {
    Logger.trace("RemoveModal called").log();
    if (MfaIntegration.modalElement) {
      let modal = MfaIntegration.modalElement;
      MfaIntegration.modalElement = null;
      await document.body.removeChild(modal);
    }
  }

  public async execute(
    step: IVerificationStep,
    context: IVerificationContext,
    responseConsumer: (response: IStepResponse) => Promise<any>
  ): Promise<any> {
    Logger.trace("MFA - execute:", { step: step }).log();
    try {
      let typedConfig: IMfaConfig = step.config as IMfaConfig;
      switch (step.method) {
        case MfaClientOperation.AUTHORIZE_MFA_CHANNEL:
          MfaIntegration.removeModal();

          popupModal(
            MfaIntegration.getModal,
            (modal, rootElement) => {
              this.formatAuthorization(modal, rootElement, responseConsumer);
            },
            this.config as IMfaConfig
          );
          break;

        case MfaClientOperation.GET_TOKEN:
          MfaIntegration.removeModal();

          popupModal(
            MfaIntegration.getModal,
            (modal, rootElement) => {
              this.formatGetCode(modal, rootElement, responseConsumer);
            },
            this.config as IMfaConfig
          );
          break;

        case MfaClientOperation.TOKEN_VERIFIED:
          MfaIntegration.removeModal();

          popupModal(
            MfaIntegration.getModal,
            (modal, rootElement) => {
              this.formatCodeApproved(modal, rootElement);
            },
            this.config as IMfaConfig
          );
          break;

        default:
          throw Error(`Unknown operation: ${step.method}`);
      }
    } catch (error) {
      if (context.onError) {
        context.onError({
          errorType: VerificationErrorType.SYSTEM,
          details: error as string,
        });
      }
    }
  }

  public async load() {
    Logger.info("MFA - load").log();
  }

  public async cleanup(): Promise<void> {
    Logger.trace("MFA - cleanup").log();
    MfaIntegration.removeModal();
    const showModal =
      this.getStyle(MfaConfigurableStyle.SHOW_COMPLETE_SCREEN) === "true";

    if (showModal) {
      Logger.trace("MFA - cleanup: show approved").log();
      popupModal(
        MfaIntegration.getModal,
        (modal, rootElement) => {
          this.formatCodeApproved(modal, rootElement);
        },
        this.config as IMfaConfig
      );
    }
  }
}
