import type { BluetoothCapabilities } from './ble-client';

export const BLUEFY_URL = 'https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055';
export const ANDROID_CHROME_URL = 'https://play.google.com/store/apps/details?id=com.android.chrome';

export interface PlatformProbe {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}

export interface PlatformInfo {
  ios: boolean;
  android: boolean;
  label: string;
}

export interface BrowserRecommendation {
  name: string;
  url: string;
}

export interface SupportDetails {
  text: string;
  recommendation: BrowserRecommendation | null;
}

export function isIosPlatform(probe: PlatformProbe = navigator): boolean {
  return /iPad|iPhone|iPod/.test(probe.userAgent) ||
    (probe.platform === 'MacIntel' && probe.maxTouchPoints > 1);
}

export function detectPlatform(probe: PlatformProbe = navigator): PlatformInfo {
  const ios = isIosPlatform(probe);
  const android = /Android/i.test(probe.userAgent);
  return {
    ios,
    android,
    label: ios ? 'iOS/iPadOS' : (android ? 'Android' : 'desktop'),
  };
}

export function supportDetails(capabilities: BluetoothCapabilities, platform: PlatformInfo): SupportDetails {
  return {
    text: capabilities.bluetooth && capabilities.secureContext
      ? 'Браузер поддерживается'
      : 'Ваш браузер не поддерживается',
    recommendation: browserRecommendation(capabilities, platform),
  };
}

function browserRecommendation(
  capabilities: BluetoothCapabilities,
  platform: PlatformInfo,
): BrowserRecommendation | null {
  if (capabilities.bluetooth && capabilities.secureContext) {
    return null;
  }

  if (platform.ios) {
    return {
      name: 'Bluefy Web BLE Browser',
      url: BLUEFY_URL,
    };
  }

  if (platform.android) {
    return {
      name: 'Google Chrome',
      url: ANDROID_CHROME_URL,
    };
  }

  return null;
}
