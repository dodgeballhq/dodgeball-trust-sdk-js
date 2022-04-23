import {
  ApiVersion,
  IDodgeballVerifyResponse,
  IFingerprint,
  IInitConfig,
  IVerification,
  IntegrationName,
  VerificationOutcome,
  VerificationStatus,
  IStepResponse
} from './types';
import axios, { Method } from "axios";

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

// function to wrap axios requests
export const makeRequest = async ({ url, method, headers, data }: IRequestParams) => {
  try {
    const response = await axios({
      method,
      url,
      headers,
      data,
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
}

// function to construct api request headers
export const constructApiHeaders = (token: string, sourceId?: string) => {
  let headers: {[key: string]: string} = {
    'Dodgeball-Public-Key': `${token}`,
  };

  if (sourceId) {
    headers['Dodgeball-Source-Id'] = sourceId;
  }

  return headers;
}

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
export const sendIdentifyDevice = async ({url, token, version, sourceId, fingerprints}: IIdentifyDeviceParams) => {
  const headers = constructApiHeaders(token, sourceId);
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}identify`,
    method: 'POST',
    headers,
    data: {
      fingerprints
    }
  });

  return response.id;
}

// function to poll api for updates to a verification
export const queryVerification = async (url: string, token: string, version: string, verification: IVerification): Promise<IVerification> => {
  const headers = constructApiHeaders(token);
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}verification/${verification.id}`,
    method: "GET",
    headers,
    data: null,
  });

  return response;
}


// function to poll api for updates to a verification
export const setVerificationResponse = async (
    url: string,
    token: string,
    sourceId: string,
    version: string,
    verification: IVerification,
    verificationStepId: string,
    stepResponse: IStepResponse): Promise<any> => {
  const headers = constructApiHeaders(token);
  headers['dodgeball-source-id'] = sourceId
  headers['dodgeball-plugin-name'] = stepResponse.pluginName
  headers['dodgeball-method-name'] = stepResponse.methodName
  const apiUrl = constructApiUrl(url, version);

  const response = await makeRequest({
    url: `${apiUrl}verification/${verification.id}/${verificationStepId}`,
    method: "POST",
    headers,
    data: stepResponse.data ?? {},
  });

  return response
}


// Load an external script
export const loadScript = async (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => {
        resolve();
      };
      document.body.appendChild(script);
    } catch (error) {
      reject(error);
    }
  });
}

// Popup a Modal Dialog and give a reference to it
export const popupModal = async(
    formatter: (modal:HTMLElement, rootElement:HTMLElement) => void):Promise<HTMLElement | null>=> {

  console.log("About to popup")
  try {
    let toReturn: HTMLElement = await document.createElement('div');
    toReturn.style.cssText =
        `display:flex;justify-content:center;align-items:center;position:fixed;
        top:0;left:0;right:0;bottom:0;z-index:99999;background-color:rgba(0, 0, 0, 0.3);`;

    let innerModal = await document.createElement('div')
    innerModal.style.cssText = 'justify-self:center;padding:10px;background-color:white'

    if (formatter) {
      formatter(innerModal, toReturn)
    }

    toReturn.appendChild(innerModal)
    document.body.appendChild(toReturn);
    console.log("Got through popup without failure")

    return toReturn;
  }
  catch(error){
    console.error("Could not pop up modal", error)
    return null
  }
}

export const removeModal = async(modal: HTMLElement)=>{
  document.body.removeChild(modal)
}