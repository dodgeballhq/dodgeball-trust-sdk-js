import { IMfaConfig } from "./integrations/Mfa";
import {
  DodgeballApiVersion,
  IDodgeballVerifyResponse,
  IFingerprint,
  IInitConfig,
  IVerification,
  IntegrationName,
  VerificationOutcome,
  VerificationStatus,
  IStepResponse,
  MfaConfigurableStyle,
} from "./types";
import axios, { Method } from "axios";
import { DEFAULT_STYLES } from "./constants";

interface IRequestParams {
  url: string;
  method: Method;
  headers: any;
  data: any;
}

interface IGetInitializationConfigParams {
  url: string;
  version: string;
  token: string;
}

interface IIdentifyDeviceParams {
  url: string;
  version: string;
  token: string;
  sourceId?: string;
  fingerprints: IFingerprint[];
}

export interface IStyles {
  [key: string]: string;
}

// function to wrap axios requests
export const makeRequest = async ({
  url,
  method,
  headers,
  data,
}: IRequestParams) => {
  try {
    const response = await axios({
      method,
      url,
      headers,
      data,
      timeout: 0,
    });
    return response.data;
  } catch (error) {
    console.log(error);
    return error;
  }
};

// function to construct an apiUrl with version appended to the end
export const constructApiUrl = (url: string, version: string) => {
  // ensure that the url ends with a '/'
  if (url.charAt(url.length - 1) !== "/") {
    url += "/";
  }

  return `${url}${version}/`;
};

// function to construct api request headers
export const constructApiHeaders = (token: string, sourceId?: string) => {
  let headers: { [key: string]: string } = {
    "Dodgeball-Public-Key": `${token}`,
  };

  if (sourceId) {
    headers["Dodgeball-Source-Id"] = sourceId;
  }

  return headers;
};

// function to get integrations to run
export const getInitializationConfig = async ({
  url,
  token,
  version,
}: IGetInitializationConfigParams): Promise<IInitConfig> => {
  const headers = constructApiHeaders(token);
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}init`,
    method: "GET",
    headers,
    data: null,
  });

  return response;
};

// function to identify the current device
export const sendIdentifyDevice = async ({
  url,
  token,
  version,
  sourceId,
  fingerprints,
}: IIdentifyDeviceParams) => {
  const headers = constructApiHeaders(token, sourceId);
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}identify`,
    method: "POST",
    headers,
    data: {
      fingerprints,
    },
  });

  return response.id;
};

export const queryVerification = async (
  url: string,
  token: string,
  version: string,
  verification: IVerification
): Promise<IDodgeballVerifyResponse> => {
  const headers = constructApiHeaders(token);
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}verification/${verification.id}`,
    method: "GET",
    headers,
    data: null,
  });

  return response;
};

export const setVerificationResponse = async (
  url: string,
  token: string,
  sourceId: string,
  version: string,
  verification: IVerification,
  verificationStepId: string,
  stepResponse: IStepResponse
): Promise<any> => {
  const headers = constructApiHeaders(token);
  headers["dodgeball-source-id"] = sourceId;
  headers["dodgeball-plugin-name"] = stepResponse.pluginName;
  headers["dodgeball-method-name"] = stepResponse.methodName;
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}verification/${verification.id}/${verificationStepId}`,
    method: "POST",
    headers,
    data: stepResponse.data ?? {},
  });

  return response;
};

// Load an external script
export const loadScript = async (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof document !== "undefined") {
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.onload = () => {
          resolve();
        };
        document.body.appendChild(script);
      }
    } catch (error) {
      reject(error);
    }
  });
};

export type NodeCleanupMethod = () => Promise<void>;
export const cleanupNodes = async (
  parentNode: HTMLElement,
  childNode: HTMLElement
) => {
  await parentNode.removeChild(childNode);
};
export const formatStyles = (styleObj: IStyles): string => {
  let styles = "";

  Object.keys(styleObj).forEach((styleName) => {
    styles += `${styleName}:${styleObj[styleName]};`;
  });

  return styles;
};

export const setStyles = (el: HTMLElement, styleObj: IStyles): HTMLElement => {
  el.style.cssText = formatStyles(styleObj);
  return el;
};

export const createEl = (elType: string, styleObj: IStyles): HTMLElement => {
  let el = document.createElement(elType);
  setStyles(el, styleObj);
  return el;
};

export const getMfaConfigurableStyle = (
  configurableStyle: MfaConfigurableStyle,
  config: IMfaConfig
) => {
  let style = DEFAULT_STYLES[configurableStyle];

  if (
    config &&
    config.hasOwnProperty("customStyles") &&
    config.customStyles?.hasOwnProperty(configurableStyle)
  ) {
    style = config.customStyles[configurableStyle] as string;
  }

  return style;
};

// Popup a Modal Dialog and give a reference to it
export const popupModal = async (
  modalAccessor: () => Promise<HTMLElement>,
  formatter: (modal: HTMLElement, rootElement: HTMLElement) => void,
  config: IMfaConfig
) => {
  console.log("About to popup");
  try {
    let modal = await modalAccessor();
    modal = setStyles(modal, {
      display: "flex",
      "justify-content": "center",
      "align-items": "center",
      position: "fixed",
      top: "0px",
      left: "0px",
      right: "0px",
      bottom: "0px",
      "z-index": "9999",
      "background-color": "rgba(0, 0, 0, 0.3)",
    });

    let innerModal = await document.createElement("div");
    setStyles(innerModal, {
      "justify-self": "center",
      padding: "0px",
      "background-color": getMfaConfigurableStyle(
        MfaConfigurableStyle.MODAL_BACKGROUND_COLOR,
        config
      ),
      "border-radius": getMfaConfigurableStyle(
        MfaConfigurableStyle.MODAL_BORDER_RADIUS,
        config
      ),
      "max-width": "600px",
      "min-width": "600px",
    });

    if (formatter) {
      formatter(innerModal, modal);
    }

    modal.appendChild(innerModal);
    document.body.appendChild(modal);
    console.log("Got through popup without failure");
  } catch (error) {
    console.error("Could not pop up modal", error);
  }
};
