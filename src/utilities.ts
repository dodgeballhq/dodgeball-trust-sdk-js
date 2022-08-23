import {
  IDodgeballVerifyResponse,
  IFingerprint,
  IInitConfig,
  IVerification,
  IStepResponse,
} from "./types";
import axios, { Method } from "axios";
import { Logger } from "./logger";

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

interface IGetSourceTokenParams {
  url: string;
  version: string;
  token: string;
  sourceToken?: string | null; // A previous source token if present
  fingerprints: IFingerprint[];
}

interface IAttachSourceTokenMetadata {
  url: string;
  version: string;
  token: string;
  sourceToken: string;
  metadata: { [key: string]: any };
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
    Logger.error("Request error: ", error).log();
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
export const constructApiHeaders = (
  token: string,
  sourceToken?: string | null
) => {
  let headers: { [key: string]: string } = {
    "Dodgeball-Public-Key": `${token}`,
  };

  if (sourceToken) {
    headers["Dodgeball-Source-Token"] = sourceToken;
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

export const sendGetSourceToken = async ({
  url,
  token,
  version,
  sourceToken,
  fingerprints,
}: IGetSourceTokenParams) => {
  const headers = constructApiHeaders(token, sourceToken);
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}sourceToken`,
    method: "POST",
    headers,
    data: {
      fingerprints,
    },
  });

  return {
    token: response.token as string,
    expiry: response.expiry as number, // ms since UNIX epoch
  };
};

export const attachSourceTokenMetadata = async ({
  url,
  token,
  version,
  sourceToken,
  metadata,
}: IAttachSourceTokenMetadata) => {
  const headers = constructApiHeaders(token, sourceToken);
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}sourceToken/meta`,
    method: "POST",
    headers,
    data: {
      metadata,
    },
  });

  return response;
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
  sourceToken: string,
  version: string,
  verification: IVerification,
  verificationStepId: string,
  stepResponse: IStepResponse
): Promise<any> => {
  const headers = constructApiHeaders(token);
  headers["Dodgeball-Source-Token"] = sourceToken;
  headers["Dodgeball-Plugin-Name"] = stepResponse.pluginName;
  headers["Dodgeball-Method-Name"] = stepResponse.methodName;
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
        script.onerror = (error) => {
          reject(error);
        };
        document.body.appendChild(script);
      }
    } catch (error) {
      reject(error);
    }
  });
};
