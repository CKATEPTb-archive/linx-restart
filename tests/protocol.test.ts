import assert from 'node:assert/strict';
import {
  bytesToHex,
  crc16CcittFalse,
  deriveIv,
  deriveSecret,
  aesCfb128Decrypt,
  aesCfb128Encrypt,
  inferDeviceModelFromName,
  isKnownDeviceName,
  makeCommand,
  normalizeSerial,
  OPCODES,
  parseF003DataFrame,
  parseF003StatusFrame,
  parseLocalStartTimeResponse,
  parseStartupDeviceInfoResponse,
  resetFlowForFirmware,
  setNewSensorParams,
  validateCrc16,
} from '../src/aidex-protocol';
import { md5 } from '../src/md5';
import {
  ANDROID_CHROME_URL,
  BLUEFY_URL,
  detectPlatform,
  supportDetails,
} from '../src/platform-support';

assert.equal(bytesToHex(md5(new TextEncoder().encode('')), ''), 'D41D8CD98F00B204E9800998ECF8427E');
assert.equal(normalizeSerial('AiDEX X-2222267V4E'), '2222267V4E');
assert.equal(isKnownDeviceName('LinXVista-222228BA5V'), true);
assert.equal(inferDeviceModelFromName('LinXVista-222228BA5V'), 'LinX Vista');
assert.equal(isKnownDeviceName('CGM-222228BA5V'), true);
assert.equal(bytesToHex(deriveSecret('2222267V4E'), ''), '4B76169576DA80E4EEACF886230873D2');
assert.equal(bytesToHex(deriveIv('2222267V4E'), ''), '14CB6A3A39B96C448EBC39185F70F8AA');

const startup = makeCommand(0x10);
assert.equal(bytesToHex(startup), '10 C1 F3');
assert.equal(crc16CcittFalse(Uint8Array.of(0x10)), 0xf3c1);
assert.equal(validateCrc16(startup), true);
assert.equal(bytesToHex(makeCommand(0xf2)), 'F2 AD 2E');
assert.equal(bytesToHex(makeCommand(0xf0)), 'F0 EF 0E');
assert.equal(bytesToHex(makeCommand(0xf3)), 'F3 8C 3E');
assert.equal(bytesToHex(makeCommand(0x11)), '11 E0 E3');
assert.equal(bytesToHex(makeCommand(0x21)), '21 B3 D5');
assert.equal(bytesToHex(makeCommand(OPCODES.SET_AUTO_UPDATE_STATUS, [1])), '34 01 7F C4');
assert.equal(bytesToHex(makeCommand(OPCODES.SET_DYNAMIC_ADV_MODE, [1])), '35 01 4E F7');
assert.equal(bytesToHex(makeCommand(0x20, [0xe8, 0x07, 6, 16, 18, 30, 0, 8, 0])), '20 E8 07 06 10 12 1E 00 08 00 68 BA');

const startupInfo = parseStartupDeviceInfoResponse(Uint8Array.of(
  0x10, 0x00,
  0x00, 0x00, 0x01, 0x07, 0x01, 0x03, 0x0f, 0x00,
  0x47, 0x58, 0x2d, 0x30, 0x31, 0x53, 0x00, 0x00,
));
assert.deepEqual(startupInfo, {
  firmwareVersion: '1.7',
  hardwareVersion: '1.3',
  wearDays: 15,
  modelName: 'GX-01S',
});

const startupInfoWithPatch = parseStartupDeviceInfoResponse(Uint8Array.of(
  0x10, 0x00,
  0x00, 0x00, 0x01, 0x08, 0x01, 0x01, 0x03, 0x0f,
  0x47, 0x58, 0x2d, 0x30, 0x31, 0x53, 0x00, 0x00,
));
assert.deepEqual(startupInfoWithPatch, {
  firmwareVersion: '1.8.1',
  hardwareVersion: '1.3',
  wearDays: 15,
  modelName: 'GX-01S',
});

const startTime = parseLocalStartTimeResponse(Uint8Array.of(
  0x21, 0x00,
  0xe8, 0x07, 0x06, 0x10, 0x12, 0x1e, 0x00, 0x08, 0x00,
));
assert.ok(startTime);
if (startTime.utcMs === null) {
  assert.fail('startTime.utcMs should be present');
}
assert.equal(startTime.isStarted, true);
assert.equal(new Date(startTime.utcMs).toISOString(), '2024-06-16T16:30:00.000Z');

const notStarted = parseLocalStartTimeResponse(Uint8Array.of(0x21, 0x00, 0, 0, 0, 0, 0, 0, 0));
assert.ok(notStarted);
assert.equal(notStarted.isStarted, false);

const statusFrame = parseF003StatusFrame(Uint8Array.of(0x01, 0xf9, 0x05, 0x00, 0x00));
assert.ok(statusFrame);
assert.equal(statusFrame.millivolts, 1529);

const dataFramePayload = Uint8Array.of(
  0xa1, 0x20, 0x1c, 0x00, 0x00, 0x00, 0x78, 0x00,
  0xd0, 0x07, 0xb8, 0x0b, 0x00, 0x00, 0x00,
);
const dataFrameCrc = crc16CcittFalse(dataFramePayload);
const dataFrame = new Uint8Array(17);
dataFrame.set(dataFramePayload);
dataFrame[15] = dataFrameCrc & 0xff;
dataFrame[16] = dataFrameCrc >> 8;
const parsedFrame = parseF003DataFrame(dataFrame);
assert.ok(parsedFrame);
assert.equal(parsedFrame.timeOffsetMinutes, 120);
assert.equal(parsedFrame.glucoseMgDl, 120);
assert.equal(parsedFrame.isValid, true);

const key = deriveSecret('2222267V4E');
const iv = deriveIv('2222267V4E');
const plaintext = Uint8Array.from({ length: 35 }, (_, index) => (index * 7 + 3) & 0xff);
const encrypted = await aesCfb128Encrypt(plaintext, key, iv);
const decrypted = await aesCfb128Decrypt(encrypted, key, iv);
assert.deepEqual(decrypted, plaintext);

const noBluetoothCapabilities = {
  bluetooth: false,
  leScan: false,
  secureContext: true,
};
const androidPlatform = detectPlatform({
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
});
assert.equal(androidPlatform.android, true);
assert.equal(supportDetails(noBluetoothCapabilities, androidPlatform).recommendation?.url, ANDROID_CHROME_URL);

const iosPlatform = detectPlatform({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  platform: 'iPhone',
  maxTouchPoints: 5,
});
assert.equal(iosPlatform.ios, true);
assert.equal(supportDetails(noBluetoothCapabilities, iosPlatform).recommendation?.url, BLUEFY_URL);

const desktopPlatform = detectPlatform({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  platform: 'Win32',
  maxTouchPoints: 0,
});
assert.equal(supportDetails(noBluetoothCapabilities, desktopPlatform).recommendation, null);
assert.equal(supportDetails({ ...noBluetoothCapabilities, bluetooth: true }, androidPlatform).recommendation, null);
assert.equal(resetFlowForFirmware(''), 'legacy-reset');
assert.equal(resetFlowForFirmware('1.8.2'), 'legacy-reset');
assert.equal(resetFlowForFirmware('1.8.3'), 'clear-storage-activation');
assert.equal(resetFlowForFirmware('1.8.4'), 'clear-storage-activation');
assert.equal(resetFlowForFirmware('1.9.0'), 'clear-storage-activation');

const newSensorParams = setNewSensorParams(new Date(2024, 5, 16, 18, 30, 0));
assert.deepEqual(newSensorParams.slice(0, 7), [0xe8, 0x07, 6, 16, 18, 30, 0]);
assert.equal(newSensorParams.length, 9);

console.log('protocol tests passed');
