import { FingerprintSource, IFingerprint, IIdentifierIntegration } from './types';

import { loadScript } from './utilities';

export interface IBrowserFingerprint {
  userAgent: string;
  browser: string;
  browserVersion: string;
  browserMajorVersion: string;
  isIE: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isSafari: boolean;
  isOpera: boolean;
  engine: string;
  engineVersion: string;
  os: string;
  osVersion: string;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
  isUbuntu: boolean;
  isSolaris: boolean;
  device: string;
  deviceType: string;
  deviceVendor: string;
  cpu: string;
  isMobile: boolean;
  isMobileMajor: boolean;
  isMobileAndroid: boolean;
  isMobileOpera: boolean;
  isMobileWindows: boolean;
  isMobileBlackBerry: boolean;
  isMobileIOS: boolean;
  isIphone: boolean;
  isIpad: boolean;
  isIpod: boolean;
  screenPrint: string;
  colorDepth: string;
  currentResolution: string;
  availableResolution: string;
  deviceXDPI: string;
  deviceYDPI: string;
  plugins: string;
  isJava: boolean;
  isFlash: boolean;
  isSilverlight: boolean;
  silverlightVersion: string;
  mimeTypes: string;
  isMimeTypes: boolean;
  fonts: string;
  isLocalStorage: boolean;
  isSessionStorage: boolean;
  isCookie: boolean;
  timeZone: string;
  language: string;
  systemLanguage: string;
  isCanvas: boolean;
  canvasPrint: string;
  fingerprint: string;
}

export class Fingerprinter {

  clientUrl: string;
  client: any;

  constructor (clientUrl: string) {
    this.clientUrl = clientUrl;
  }

  public async load() {
    if (this.client) {
      return;
    }

    await loadScript(this.clientUrl);
    let ClientJS = (window as any).ClientJS;

    if (ClientJS) {
      this.client = new ClientJS();
    }

    return;
  }

  getBrowserFingerprint (): IBrowserFingerprint {
    if (this.client) {
      const browserFingerprint: IBrowserFingerprint = {
        userAgent: this.client.getUserAgent(),
        browser: this.client.getBrowser(),
        browserVersion: this.client.getBrowserVersion(),
        browserMajorVersion: this.client.getBrowserMajorVersion(),
        isIE: this.client.isIE(),
        isChrome: this.client.isChrome(),
        isFirefox: this.client.isFirefox(),
        isSafari: this.client.isSafari(),
        isOpera: this.client.isOpera(),
        engine: this.client.getEngine(),
        engineVersion: this.client.getEngineVersion(),
        os: this.client.getOS(),
        osVersion: this.client.getOSVersion(),
        isWindows: this.client.isWindows(),
        isMac: this.client.isMac(),
        isLinux: this.client.isLinux(),
        isUbuntu: this.client.isUbuntu(),
        isSolaris: this.client.isSolaris(),
        device: this.client.getDevice(),
        deviceType: this.client.getDeviceType(),
        deviceVendor: this.client.getDeviceVendor(),
        cpu: this.client.getCPU(),
        isMobile: this.client.isMobile(),
        isMobileMajor: this.client.isMobileMajor(),
        isMobileAndroid: this.client.isMobileAndroid(),
        isMobileOpera: this.client.isMobileOpera(),
        isMobileWindows: this.client.isMobileWindows(),
        isMobileBlackBerry: this.client.isMobileBlackBerry(),
        isMobileIOS: this.client.isMobileIOS(),
        isIphone: this.client.isIphone(),
        isIpad: this.client.isIpad(),
        isIpod: this.client.isIpod(),
        screenPrint: this.client.getScreenPrint(),
        colorDepth: this.client.getColorDepth(),
        currentResolution: this.client.getCurrentResolution(),
        availableResolution: this.client.getAvailableResolution(),
        deviceXDPI: this.client.getDeviceXDPI(),
        deviceYDPI: this.client.getDeviceYDPI(),
        plugins: this.client.getPlugins(),
        isJava: this.client.isJava(),
        isFlash: this.client.isFlash(),
        isSilverlight: this.client.isSilverlight(),
        silverlightVersion: this.client.getSilverlightVersion(),
        mimeTypes: this.client.getMimeTypes(),
        isMimeTypes: this.client.isMimeTypes(),
        fonts: this.client.getFonts(),
        isLocalStorage: this.client.isLocalStorage(),
        isSessionStorage: this.client.isSessionStorage(),
        isCookie: this.client.isCookie(),
        timeZone: this.client.getTimeZone(),
        language: this.client.getLanguage(),
        systemLanguage: this.client.getSystemLanguage(),
        isCanvas: this.client.isCanvas(),
        canvasPrint: this.client.getCanvasPrint(),
        fingerprint: this.client.getFingerprint()
      };

      return browserFingerprint;
    } else {
      return {} as IBrowserFingerprint;
    }
  }

  public async gatherFingerprints (identifiers: IIdentifierIntegration[]): Promise<IFingerprint[]> {
    const fingerprints: IFingerprint[] = [];
    
    for (const identifier of identifiers) {
      try {
        const fingerprint: IFingerprint = await identifier.identify();
        fingerprints.push(fingerprint);
      } catch (error) {
        console.error(error);
      }
    }

    const dbFingerprintProps = this.getBrowserFingerprint();

    fingerprints.push({
      source: FingerprintSource.DODGEBALL,
      props: dbFingerprintProps,
      hash: dbFingerprintProps.fingerprint
    });

    return fingerprints;
  }
}