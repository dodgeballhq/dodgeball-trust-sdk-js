import axios, { Method } from "axios";
import { Logger } from "./logger";
import { Md5 } from "./md5";
import {
  IDodgeballVerifyResponse,
  IFingerprint,
  IInitConfig,
  IStepResponse,
  IVerification,
} from "./types";

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

interface IExpireSourceTokenParams {
  url: string;
  version: string;
  token: string;
  sourceToken: string;
}

interface IAttachSourceTokenMetadata {
  url: string;
  version: string;
  token: string;
  sourceToken: string;
  metadata: { [key: string]: any };
}

const MAX_REQUEST_RETRIES = 4;

export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// function to wrap axios requests
export const makeRequest = async ({
  url,
  method,
  headers,
  data,
}: IRequestParams) => {
  let lastError;
  let numAttempts = 0;

  while (numAttempts < MAX_REQUEST_RETRIES) {
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
      lastError = error;
    }
    numAttempts += 1;
    if (numAttempts < MAX_REQUEST_RETRIES) {
      await sleep(
        Math.min(5000, Math.max(100, 10 * Math.pow(10, numAttempts)))
      );
    }
  }

  return lastError;
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

export const sendExpireSourceToken = async ({
  url,
  token,
  version,
  sourceToken,
}: IExpireSourceTokenParams) => {
  const headers = constructApiHeaders(token, sourceToken);
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}sourceToken/expire`,
    method: "POST",
    headers,
    data: {},
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

/**
 * Query a verification by id
 * @param url - The base url of the Dodgeball API
 * @param token - The public key of the Dodgeball account
 * @param version - The version of the Dodgeball API
 * @param verification - The verification to query
 * @returns The verification response
 * @throws If the verification has no id or something goes wrong with the request
 */
export const queryVerification = async (
  url: string,
  token: string,
  version: string,
  verification: IVerification
): Promise<IDodgeballVerifyResponse> => {
  const verificationId = verification?.id;
  if (!verificationId) {
    throw new Error("Verification has no id");
  }

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

export const getMd5 = (str: string | string[]): string => {
  const md5 = new Md5();

  if (Array.isArray(str)) {
    str.forEach((s) => {
      if (s === null || s === undefined) {
        md5.appendStr("");
      } else {
        md5.appendStr(s);
      }
    });
  } else {
    if (str === null || str === undefined) {
      md5.appendStr("");
    } else {
      md5.appendStr(str);
    }
  }

  return md5.end() as string;
};
