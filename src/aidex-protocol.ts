import { md5 } from './md5';

export type ByteInput = ArrayBuffer | ArrayLike<number>;

export interface StartupDeviceInfo {
  firmwareVersion: string;
  hardwareVersion: string;
  wearDays: number;
  modelName: string;
}

export interface LocalStartTime {
  isStarted: boolean;
  isAllZeros: boolean;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  tzQuarters: number;
  dstQuarters: number;
  utcMs: number | null;
}

export interface F003DataFrame {
  opcode: number;
  timeOffsetMinutes: number;
  glucoseMgDl: number;
  rawGlucosePacked: number;
  i1: number;
  i2: number;
  crc16: number;
  isValid: boolean;
}

export interface F003StatusFrame {
  millivolts: number;
}

export const SERVICE_F000 = '0000181f-0000-1000-8000-00805f9b34fb';
export const CHAR_F001 = '0000f001-0000-1000-8000-00805f9b34fb';
export const CHAR_F002 = '0000f002-0000-1000-8000-00805f9b34fb';
export const CHAR_F003 = '0000f003-0000-1000-8000-00805f9b34fb';
export const SERVICE_DIS = '0000180a-0000-1000-8000-00805f9b34fb';
export const CHAR_DIS_MODEL_NUMBER = '00002a24-0000-1000-8000-00805f9b34fb';
export const CHAR_DIS_SERIAL_NUMBER = '00002a25-0000-1000-8000-00805f9b34fb';
export const CHAR_DIS_FIRMWARE_REVISION = '00002a26-0000-1000-8000-00805f9b34fb';
export const CHAR_DIS_SOFTWARE_REVISION = '00002a28-0000-1000-8000-00805f9b34fb';
export const CHAR_DIS_MANUFACTURER_NAME = '00002a29-0000-1000-8000-00805f9b34fb';
export const AIDEX_OFFICIAL_LIFETIME_DAYS = 15;

export const OPCODES = Object.freeze({
  GET_STARTUP_DEVICE_INFO: 0x10,
  POST_BOND_CONFIG: 0x10,
  GET_BROADCAST_DATA: 0x11,
  GET_LOCAL_START_TIME: 0x21,
  GET_START_TIME: 0x21,
  SET_AUTO_UPDATE_STATUS: 0x34,
  CLEAR_STORAGE: 0xf3,
  RESET: 0xf0,
});

export const DEVICE_NAME_PREFIXES = [
  'LinX Vista',
  'Linx Vista',
  'LINX VISTA',
  'LINX Vista',
  'LinX',
  'LINX',
  'Linx',
  'AiDEX',
  'AiDex',
  'AIDEX',
  'Lumiflex',
  'LumiFlex',
  'LUMIFLEX',
  'Lumifler',
  'LumiFler',
  'LUMIFLER',
];

const CRC8_MAXIM_TABLE = [
  0x00, 0x5e, 0xbc, 0xe2, 0x61, 0x3f, 0xdd, 0x83, 0xc2, 0x9c, 0x7e, 0x20, 0xa3, 0xfd, 0x1f, 0x41,
  0x9d, 0xc3, 0x21, 0x7f, 0xfc, 0xa2, 0x40, 0x1e, 0x5f, 0x01, 0xe3, 0xbd, 0x3e, 0x60, 0x82, 0xdc,
  0x23, 0x7d, 0x9f, 0xc1, 0x42, 0x1c, 0xfe, 0xa0, 0xe1, 0xbf, 0x5d, 0x03, 0x80, 0xde, 0x3c, 0x62,
  0xbe, 0xe0, 0x02, 0x5c, 0xdf, 0x81, 0x63, 0x3d, 0x7c, 0x22, 0xc0, 0x9e, 0x1d, 0x43, 0xa1, 0xff,
  0x46, 0x18, 0xfa, 0xa4, 0x27, 0x79, 0x9b, 0xc5, 0x84, 0xda, 0x38, 0x66, 0xe5, 0xbb, 0x59, 0x07,
  0xdb, 0x85, 0x67, 0x39, 0xba, 0xe4, 0x06, 0x58, 0x19, 0x47, 0xa5, 0xfb, 0x78, 0x26, 0xc4, 0x9a,
  0x65, 0x3b, 0xd9, 0x87, 0x04, 0x5a, 0xb8, 0xe6, 0xa7, 0xf9, 0x1b, 0x45, 0xc6, 0x98, 0x7a, 0x24,
  0xf8, 0xa6, 0x44, 0x1a, 0x99, 0xc7, 0x25, 0x7b, 0x3a, 0x64, 0x86, 0xd8, 0x5b, 0x05, 0xe7, 0xb9,
  0x8c, 0xd2, 0x30, 0x6e, 0xed, 0xb3, 0x51, 0x0f, 0x4e, 0x10, 0xf2, 0xac, 0x2f, 0x71, 0x93, 0xcd,
  0x11, 0x4f, 0xad, 0xf3, 0x70, 0x2e, 0xcc, 0x92, 0xd3, 0x8d, 0x6f, 0x31, 0xb2, 0xec, 0x0e, 0x50,
  0xaf, 0xf1, 0x13, 0x4d, 0xce, 0x90, 0x72, 0x2c, 0x6d, 0x33, 0xd1, 0x8f, 0x0c, 0x52, 0xb0, 0xee,
  0x32, 0x6c, 0x8e, 0xd0, 0x53, 0x0d, 0xef, 0xb1, 0xf0, 0xae, 0x4c, 0x12, 0x91, 0xcf, 0x2d, 0x73,
  0xca, 0x94, 0x76, 0x28, 0xab, 0xf5, 0x17, 0x49, 0x08, 0x56, 0xb4, 0xea, 0x69, 0x37, 0xd5, 0x8b,
  0x57, 0x09, 0xeb, 0xb5, 0x36, 0x68, 0x8a, 0xd4, 0x95, 0xcb, 0x29, 0x77, 0xf4, 0xaa, 0x48, 0x16,
  0xe9, 0xb7, 0x55, 0x0b, 0x88, 0xd6, 0x34, 0x6a, 0x2b, 0x75, 0x97, 0xc9, 0x4a, 0x14, 0xf6, 0xa8,
  0x74, 0x2a, 0xc8, 0x96, 0x15, 0x4b, 0xa9, 0xf7, 0xb6, 0xe8, 0x0a, 0x54, 0xd7, 0x89, 0x6b, 0x35,
];

export function bytesToHex(bytes: ArrayLike<number>, separator = ' '): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(separator);
}

export function normalizeSerial(value: unknown): string {
  return stripSerialPrefix(value || '')
    .replace(/[^0-9a-z]/gi, '')
    .toUpperCase();
}

export function stripSerialPrefix(value: unknown): string {
  const raw = String(value || '').trim();
  const xMatch = raw.match(/\bX-([0-9A-Za-z]{8,14})\b/);
  if (xMatch) {
    return xMatch[1];
  }

  let cleaned = raw;
  for (const prefix of [...DEVICE_NAME_PREFIXES, 'MicroTech', 'Microtech', 'Microtech Medical']) {
    cleaned = cleaned.replace(new RegExp(`^${escapeRegExp(prefix)}\\s*[-:_ ]*`, 'i'), '');
  }

  const tailMatch = cleaned.match(/([0-9A-Za-z]{8,14})$/);
  return tailMatch ? tailMatch[1] : cleaned;
}

export function extractSerialFromName(deviceName: unknown): string {
  const normalized = normalizeSerial(deviceName);
  if (normalized.length >= 8 && normalized.length <= 14) {
    return normalized;
  }

  const match = String(deviceName || '').match(/\b([0-9A-Za-z]{8,14})\b/g);
  return match ? normalizeSerial(match.at(-1)) : '';
}

export function isKnownDeviceName(name: unknown): boolean {
  const value = String(name || '').trim();
  return DEVICE_NAME_PREFIXES.some((prefix) => value.toLowerCase().startsWith(prefix.toLowerCase()));
}

export function bluetoothRequestFilters(): BluetoothLEScanFilter[] {
  return DEVICE_NAME_PREFIXES.map((namePrefix) => ({ namePrefix }));
}

export function inferDeviceModelFromName(name: unknown): string {
  const value = String(name || '').trim();
  const matched = DEVICE_NAME_PREFIXES.find((prefix) => value.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!matched) return '';

  const compact = matched.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (compact.startsWith('linxvista')) return 'LinX Vista';
  if (compact.startsWith('linx')) return 'LinX';
  if (compact.startsWith('aidex')) return 'AiDEX';
  if (compact.startsWith('lumifl')) return 'Lumiflex';
  return matched;
}

export function crc16CcittFalse(data: ArrayLike<number>): number {
  let crc = 0xffff;
  for (let byteIndex = 0; byteIndex < data.length; byteIndex += 1) {
    const byte = data[byteIndex];
    crc ^= (byte & 0xff) << 8;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    crc &= 0xffff;
  }
  return crc;
}

export function makeCommand(opcode: number, params: number[] = []): Uint8Array {
  const payload = new Uint8Array(1 + params.length);
  payload[0] = opcode & 0xff;
  params.forEach((param, index) => {
    payload[index + 1] = param & 0xff;
  });

  const crc = crc16CcittFalse(payload);
  const command = new Uint8Array(payload.length + 2);
  command.set(payload);
  command[command.length - 2] = crc & 0xff;
  command[command.length - 1] = (crc >> 8) & 0xff;
  return command;
}

export function validateCrc16(data: Uint8Array): boolean {
  if (data.length < 3) {
    return false;
  }

  const expected = crc16CcittFalse(data.slice(0, -2));
  const actual = data[data.length - 2] | (data[data.length - 1] << 8);
  return expected === actual;
}

export function stripCrc16(data: ByteInput): Uint8Array {
  const bytes = toByteArray(data);
  return bytes.length >= 3 && validateCrc16(bytes) ? bytes.slice(0, -2) : bytes;
}

export function parseStartupDeviceInfoResponse(data: ByteInput): StartupDeviceInfo | null {
  for (const payload of responsePayloadCandidates(data)) {
    const parsed = parseStartupDeviceInfoPayload(payload);
    if (parsed) return parsed;
  }
  return null;
}

export function parseLocalStartTimeResponse(data: ByteInput): LocalStartTime | null {
  for (const payload of responsePayloadCandidates(data)) {
    const parsed = parseLocalStartTimePayload(payload);
    if (parsed) return parsed;
  }
  return null;
}

export function parseF003DataFrame(data: ByteInput): F003DataFrame | null {
  const bytes = toByteArray(data);
  if (bytes.length !== 17) return null;

  const crc16 = u16LE(bytes, 15);
  const expectedCrc16 = crc16CcittFalse(bytes.slice(0, 15));
  if (crc16 !== expectedCrc16) {
    return null;
  }

  const opcode = bytes[0];
  const timeOffsetMinutes = Math.floor(u32LE(bytes, 1) / 60);
  const glucosePacked = u16LE(bytes, 6);
  const rawGlucose = glucosePacked & 0x03ff;
  const i1 = u16LE(bytes, 8) / 100;
  const i2 = u16LE(bytes, 10) / 100;
  const isValid = rawGlucose !== 1023 && rawGlucose >= 20 && rawGlucose <= 500;

  return {
    opcode,
    timeOffsetMinutes,
    glucoseMgDl: rawGlucose,
    rawGlucosePacked: glucosePacked,
    i1,
    i2,
    crc16,
    isValid,
  };
}

export function parseF003StatusFrame(data: ByteInput): F003StatusFrame | null {
  const bytes = toByteArray(data);
  if (bytes.length !== 5) return null;

  const millivolts = u16LE(bytes, 1);
  if (millivolts < 500 || millivolts > 3500) {
    return null;
  }

  return { millivolts };
}

export function crc8Maxim(data: ArrayLike<number>): number {
  let acc = 0;
  for (let byteIndex = 0; byteIndex < data.length; byteIndex += 1) {
    const byte = data[byteIndex];
    acc = CRC8_MAXIM_TABLE[(byte & 0xff) ^ acc];
  }
  return acc & 0xff;
}

export function deriveSecret(serial: string): Uint8Array {
  const bytes = serialToBytes(serial);
  return md5(bytes.map((byte) => (byte * 13 + 61) & 0xff));
}

export function deriveIv(serial: string): Uint8Array {
  const bytes = serialToBytes(serial);
  return md5(bytes.map((byte) => (byte * 17 + 19) & 0xff));
}

export function serialToBytes(serial: string): Uint8Array {
  const normalized = normalizeSerial(serial);
  return Uint8Array.from(normalized, (char) => {
    if (char >= '0' && char <= '9') return char.charCodeAt(0) - 48;
    if (char >= 'A' && char <= 'Z') return char.charCodeAt(0) - 55;
    return 0;
  });
}

export class AiDexKeyExchange {
  serial: string;
  secret: Uint8Array;
  iv: Uint8Array;
  pairKey: Uint8Array | null;
  sessionKey: Uint8Array | null;

  constructor(serial: string) {
    this.serial = normalizeSerial(serial);
    this.secret = deriveSecret(this.serial);
    this.iv = deriveIv(this.serial);
    this.pairKey = null;
    this.sessionKey = null;
  }

  get isComplete() {
    return this.sessionKey !== null;
  }

  getChallenge() {
    return this.secret;
  }

  setPairKey(data: Uint8Array): void {
    this.pairKey = data.slice(0, 16);
  }

  async decryptBond(bondData: Uint8Array): Promise<boolean> {
    if (!this.pairKey || bondData.length !== 17) {
      return false;
    }

    const decrypted = await aesCfb128Decrypt(bondData, this.pairKey, this.iv);
    const sessionKey = decrypted.slice(0, 16);
    const expected = decrypted[16];

    if (crc8Maxim(sessionKey) !== expected) {
      return false;
    }

    this.sessionKey = sessionKey;
    return true;
  }

  async encrypt(plaintext: ByteInput): Promise<Uint8Array> {
    if (!this.sessionKey) {
      throw new Error('Сессионный ключ еще не получен');
    }
    return aesCfb128Encrypt(plaintext, this.sessionKey, this.iv);
  }

  async decrypt(ciphertext: ByteInput): Promise<Uint8Array> {
    if (!this.sessionKey) {
      throw new Error('Сессионный ключ еще не получен');
    }
    return aesCfb128Decrypt(ciphertext, this.sessionKey, this.iv);
  }

  async postBondConfig(): Promise<Uint8Array> {
    return this.encrypt(Uint8Array.of(0x10, 0xc1, 0xf3));
  }
}

export class AiDexCommandBuilder {
  keyExchange: AiDexKeyExchange;

  constructor(keyExchange: AiDexKeyExchange) {
    this.keyExchange = keyExchange;
  }

  async encrypted(opcode: number, params: number[] = []): Promise<Uint8Array> {
    return this.keyExchange.encrypt(makeCommand(opcode, params));
  }

  getStartupDeviceInfo(): Promise<Uint8Array> {
    return this.encrypted(OPCODES.GET_STARTUP_DEVICE_INFO);
  }

  getLocalStartTime(): Promise<Uint8Array> {
    return this.encrypted(OPCODES.GET_LOCAL_START_TIME);
  }

  getBroadcastData(): Promise<Uint8Array> {
    return this.encrypted(OPCODES.GET_BROADCAST_DATA);
  }

  setAutoUpdateStatus(enabled = true): Promise<Uint8Array> {
    return this.encrypted(OPCODES.SET_AUTO_UPDATE_STATUS, [enabled ? 1 : 0]);
  }

  clearStorage(): Promise<Uint8Array> {
    return this.encrypted(OPCODES.CLEAR_STORAGE);
  }

  reset(): Promise<Uint8Array> {
    return this.encrypted(OPCODES.RESET);
  }
}

export async function aesCfb128Encrypt(plaintext: ByteInput, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  return aesCfb128Transform(plaintext, key, iv, true);
}

export async function aesCfb128Decrypt(ciphertext: ByteInput, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  return aesCfb128Transform(ciphertext, key, iv, false);
}

async function aesCfb128Transform(input: ByteInput, key: Uint8Array, iv: Uint8Array, encrypting: boolean): Promise<Uint8Array> {
  const source = toByteArray(input);
  if (key.length !== 16 || iv.length !== 16 || source.length === 0) {
    throw new Error('Некорректный AES-CFB вход');
  }

  const result = new Uint8Array(source.length);
  let feedback = iv.slice();

  for (let offset = 0; offset < source.length; offset += 16) {
    const chunkSize = Math.min(16, source.length - offset);
    const encryptedFeedback = await aesEcbEncryptBlock(feedback, key);

    for (let index = 0; index < chunkSize; index += 1) {
      result[offset + index] = source[offset + index] ^ encryptedFeedback[index];
    }

    if (chunkSize === 16) {
      feedback = encrypting ? result.slice(offset, offset + 16) : source.slice(offset, offset + 16);
    }
  }

  return result;
}

async function aesEcbEncryptBlock(block: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'AES-CBC' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: new Uint8Array(16) },
    cryptoKey,
    block as BufferSource,
  );
  return new Uint8Array(encrypted).slice(0, 16);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function responsePayloadCandidates(data: ByteInput): Uint8Array[] {
  const body = stripCrc16(data);
  const candidates: Uint8Array[] = [];

  if (body.length > 2) {
    candidates.push(body.slice(2));
  }
  if (body.length > 1) {
    candidates.push(body.slice(1));
  }
  candidates.push(body);
  return candidates;
}

function parseStartupDeviceInfoPayload(payload: Uint8Array): StartupDeviceInfo | null {
  if (payload.length < 16 || u16LE(payload, 0) !== 0) return null;

  return parseStartupDeviceInfoLayout(payload, true) ??
    parseStartupDeviceInfoLayout(payload, false);
}

function parseStartupDeviceInfoLayout(payload: Uint8Array, hasFirmwarePatch: boolean): StartupDeviceInfo | null {
  const firmwareOffset = 2;
  const hardwareOffset = hasFirmwarePatch ? 5 : 4;
  const wearOffset = hasFirmwarePatch ? 7 : 6;
  const modelOffsetCandidate = wearOffset + 1;
  const modelOffset = payload[modelOffsetCandidate] === 0 ? modelOffsetCandidate + 1 : modelOffsetCandidate;

  if (payload.length <= modelOffset) return null;

  const firmwareParts = hasFirmwarePatch
    ? [payload[firmwareOffset], payload[firmwareOffset + 1], payload[firmwareOffset + 2]]
    : [payload[firmwareOffset], payload[firmwareOffset + 1]];
  const hwMajor = payload[hardwareOffset];
  const hwMinor = payload[hardwareOffset + 1];
  const wearDays = payload[wearOffset];
  const modelName = asciiNullTerminated(payload.slice(modelOffset)).trim();

  if (!modelName || wearDays < 1 || wearDays > 31) return null;

  return {
    firmwareVersion: firmwareParts.join('.'),
    hardwareVersion: `${hwMajor}.${hwMinor}`,
    wearDays,
    modelName,
  };
}

function parseLocalStartTimePayload(payload: Uint8Array): LocalStartTime | null {
  if (payload.length < 7) return null;

  const year = u16LE(payload, 0);
  const month = payload[2];
  const day = payload[3];
  const hour = payload[4];
  const minute = payload[5];
  const second = payload[6];
  const tzQuarters = payload.length >= 8 ? s8(payload[7]) : 0;
  const dstQuarters = payload.length >= 9 ? payload[8] : 0;
  const isAllZeros = year === 0 && month === 0 && day === 0 && hour === 0 && minute === 0 && second === 0;

  if (isAllZeros) {
    return {
      isStarted: false,
      isAllZeros,
      year,
      month,
      day,
      hour,
      minute,
      second,
      tzQuarters,
      dstQuarters,
      utcMs: null,
    };
  }

  const plausibleDate = year >= 2020 && year <= 2040 &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= 31 &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59;

  if (!plausibleDate) return null;

  const localUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = (tzQuarters + dstQuarters) * 15 * 60_000;

  return {
    isStarted: true,
    isAllZeros,
    year,
    month,
    day,
    hour,
    minute,
    second,
    tzQuarters,
    dstQuarters,
    utcMs: localUtcMs - offsetMs,
  };
}

function asciiNullTerminated(bytes: Uint8Array): string {
  const end = bytes.indexOf(0);
  const slice = end >= 0 ? bytes.slice(0, end) : bytes;
  return String.fromCharCode(...slice.filter((byte) => byte >= 0x20 && byte <= 0x7e));
}

function u16LE(data: ArrayLike<number>, offset: number): number {
  return (data[offset] & 0xff) | ((data[offset + 1] & 0xff) << 8);
}

function u32LE(data: ArrayLike<number>, offset: number): number {
  return (data[offset] & 0xff) |
    ((data[offset + 1] & 0xff) << 8) |
    ((data[offset + 2] & 0xff) << 16) |
    ((data[offset + 3] & 0xff) * 0x1000000);
}

function s8(value: number): number {
  return value > 0x7f ? value - 0x100 : value;
}

function toByteArray(input: ByteInput): Uint8Array {
  return input instanceof Uint8Array ? Uint8Array.from(input) : new Uint8Array(input);
}
