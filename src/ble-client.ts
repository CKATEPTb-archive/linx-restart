import {
  AiDexCommandBuilder,
  AiDexKeyExchange,
  CHAR_DIS_FIRMWARE_REVISION,
  CHAR_DIS_MANUFACTURER_NAME,
  CHAR_DIS_MODEL_NUMBER,
  CHAR_DIS_SERIAL_NUMBER,
  CHAR_DIS_SOFTWARE_REVISION,
  CHAR_F001,
  CHAR_F002,
  CHAR_F003,
  DEVICE_NAME_PREFIXES,
  OPCODES,
  SERVICE_DIS,
  SERVICE_F000,
  bluetoothRequestFilters,
  bluetoothServiceRequestFilters,
  bytesToHex,
  extractSerialFromName,
  inferDeviceModelFromName,
  isKnownDeviceName,
  normalizeSerial,
  parseF003DataFrame,
  parseF003StatusFrame,
  parseLocalStartTimeResponse,
  parseStartupDeviceInfoResponse,
  resetFlowForFirmware,
} from './aidex-protocol';
import type { ByteInput } from './aidex-protocol';

export type LogLevel = 'info' | 'warn' | 'error';

export interface BluetoothCapabilities {
  bluetooth: boolean;
  leScan: boolean;
  secureContext: boolean;
}

export interface DeviceRecord {
  id: string;
  device: BluetoothDevice;
  name: string;
  source: string;
  serial: string;
  modelName: string;
  trusted: boolean;
  rssi?: number;
}

export interface SensorInfo {
  name: string;
  serial: string;
  modelName: string;
  firmwareVersion: string;
  hardwareVersion: string;
  wearDays: number;
  startTimeMs: number | null;
  startTimeEstimated: boolean;
  startTimeSource: string;
  notStarted: boolean;
  batteryMillivolts: number | null;
  batteryUpdatedAtMs: number | null;
  ageMinutes: number | null;
  selectedAtMs: number | null;
  updatedAtMs: number | null;
  lastFrameAtMs: number | null;
}

export type OpcodeCommandResultStatus = 'ok' | 'warn' | 'error';

export interface OpcodeCommandResult {
  opcode: number;
  opcodeHex: string;
  status: OpcodeCommandResultStatus;
  statusByte: number | null;
  detail: string;
  plainHex: string;
}

interface LinxPacket {
  uuid: string;
  raw: Uint8Array;
  plain: Uint8Array | null;
  opcode?: number;
}

interface PacketWaiter {
  predicate: (packet: LinxPacket) => boolean;
  resolve: (packet: LinxPacket) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface NotificationHandlerEntry {
  characteristic: BluetoothRemoteGATTCharacteristic;
  handler: (event: Event & { target: BluetoothRemoteGATTCharacteristic }) => void;
}

interface LinxGattError extends Error {
  linxStage?: string;
  linxF001Cccd?: boolean;
}

type F002CommandBuilder = () => Promise<Uint8Array>;
type DeviceSource = 'chooser' | 'manual' | 'scan';
type ConnectionStage = 'connect' | 'services' | 'characteristics' | 'cccd' | 'key-exchange';
type CharacteristicWriteMethodName = 'writeValue' | 'writeValueWithResponse' | 'writeValueWithoutResponse';
type CharacteristicWriteMethod = (value: BufferSource) => Promise<void>;
type CharacteristicWritePreference = 'default' | 'with-response-first' | 'without-response-first';
type TraceDirection = 'TX' | 'RX';
type TraceEncoding = 'raw' | 'enc' | 'plain' | 'read' | 'cccd';

interface ConnectionRetryPlan {
  delayMs: number;
  message: string;
}

interface PairChallengeAttempt {
  description: string;
  timeoutMs: number;
  writePreference: CharacteristicWritePreference;
  challenge?: Uint8Array;
}

const TIMEOUTS = Object.freeze({
  pairKey: 20_000,
  pairKeyFirstAttempt: 8_000,
  pairKeyRetry: 12_000,
  bond: 12_000,
  commandAck: 18_000,
  sensorInfo: 5_000,
});

const GATT_BUSY_RETRIES = 10;
const GATT_BUSY_DELAY_MS = 300;
const GATT_SETTLE_DELAY_MS = 700;
const ANDROID_POST_CONNECT_SETTLE_DELAY_MS = 200;
const AUTH_CCCD_SETTLE_DELAY_MS = 1_500;
const ANDROID_AUTH_CCCD_SETTLE_DELAY_MS = 6_000;
const F001_CCCD_SECURITY_RETRY_DELAY_MS = 8_000;
const CONNECT_RETRIES = 3;
const CONNECT_RETRY_DELAY_MS = 1_500;
const SERVICE_DISCOVERY_RETRIES = 2;
const SERVICE_DISCOVERY_RETRY_DELAY_MS = 1_500;
const ANDROID_F001_BOOTSTRAP_DELAY_MS = 1_500;
const F002_READ_FALLBACK_DELAY_MS = 350;
const F002_READ_FALLBACK_INTERVAL_MS = 550;
const CLEAR_STORAGE_QUIET_WINDOW_MS = 12_000;
const POST_RESET_STALE_START_TOLERANCE_MS = 120_000;
const CCCD_ORDER = [CHAR_F003, CHAR_F002, CHAR_F001];
const OFFICIAL_PAIRED_F001_CHALLENGE = Uint8Array.of(
  0x91, 0xc5, 0x47, 0x02, 0x80, 0xbb, 0x4c, 0x3d,
  0x8f, 0xa8, 0xed, 0xb1, 0xb0, 0x6a, 0x0f, 0x06,
);

export class LinxBleClient extends EventTarget {
  device: BluetoothDevice | null;
  server: BluetoothRemoteGATTServer | null;
  service: BluetoothRemoteGATTService | null;
  characteristics: Map<string, BluetoothRemoteGATTCharacteristic>;
  keyExchange: AiDexKeyExchange | null;
  commandBuilder: AiDexCommandBuilder | null;
  serial: string;
  waiters: Set<PacketWaiter>;
  scan: BluetoothLEScan | null;
  scanHandler: ((event: BluetoothAdvertisingEvent) => void) | null;
  notificationHandlers: Map<string, NotificationHandlerEntry>;
  sensorInfo: SensorInfo;
  handleDisconnect: ((event: Event) => void) | null;

  constructor() {
    super();
    this.device = null;
    this.server = null;
    this.service = null;
    this.characteristics = new Map();
    this.keyExchange = null;
    this.commandBuilder = null;
    this.serial = '';
    this.waiters = new Set();
    this.scan = null;
    this.scanHandler = null;
    this.notificationHandlers = new Map();
    this.sensorInfo = emptySensorInfo();
    this.handleDisconnect = null;
  }

  get connected(): boolean {
    return Boolean(this.device?.gatt?.connected);
  }

  get authenticated(): boolean {
    return Boolean(this.keyExchange?.isComplete);
  }

  async chooseDevice(): Promise<BluetoothDevice> {
    const bluetooth = this.assertBluetoothSupport();
    const device = await this.requestDeviceWithFallbacks(bluetooth);
    this.setDevice(device, 'chooser');
    return device;
  }

  async requestDeviceWithFallbacks(bluetooth: Bluetooth): Promise<BluetoothDevice> {
    const nameFilters = bluetoothRequestFilters();
    const serviceFilters = bluetoothServiceRequestFilters();
    const attempts: Array<{ label: string; options: RequestDeviceOptions }> = [
      {
        label: 'service+name optional 181F',
        options: {
          filters: [...serviceFilters, ...nameFilters],
          optionalServices: [SERVICE_F000, SERVICE_DIS],
        },
      },
      {
        label: 'name optional 181F',
        options: {
          filters: nameFilters,
          optionalServices: [SERVICE_F000, SERVICE_DIS],
        },
      },
      {
        label: 'name optional DIS',
        options: {
          filters: nameFilters,
          optionalServices: [SERVICE_DIS],
        },
      },
      {
        label: 'name only',
        options: {
          filters: nameFilters,
        },
      },
      {
        label: 'all optional 181F',
        options: {
          acceptAllDevices: true,
          optionalServices: [SERVICE_F000, SERVICE_DIS],
        },
      },
      {
        label: 'all optional DIS',
        options: {
          acceptAllDevices: true,
          optionalServices: [SERVICE_DIS],
        },
      },
      {
        label: 'all devices',
        options: {
          acceptAllDevices: true,
        },
      },
    ];

    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        return await bluetooth.requestDevice(attempt.options);
      } catch (error) {
        if (isBluetoothChooserCancelled(error)) {
          throw error;
        }
        lastError = error;
        this.log(`BLE chooser fallback: ${attempt.label}: ${describeError(error)}`, 'warn');
      }
    }

    throw normalizeError(lastError, 'Не удалось выбрать BLE устройство');
  }

  async startAdvertisementScan(): Promise<BluetoothLEScan | null> {
    const bluetooth = this.assertBluetoothSupport();

    if (!bluetooth.requestLEScan) {
      throw new Error('BLE-скан в браузере недоступен. Используйте кнопку "Выбрать".');
    }

    if (this.scan) {
      this.stopAdvertisementScan();
      return null;
    }

    this.scanHandler = (event: BluetoothAdvertisingEvent) => {
      const device = event.device;
      const name = device?.name || event.name || 'Без имени';
      const manufacturerIds = event.manufacturerData ? Array.from(event.manufacturerData.keys()) : [];
      const serviceMatch = event.uuids?.some((uuid: string) => sameBluetoothUuid(uuid, SERVICE_F000)) || false;
      const nameMatch = isKnownDeviceName(name);

      if (!nameMatch && !serviceMatch && manufacturerIds.length === 0) {
        return;
      }

      this.dispatchEvent(new CustomEvent('devicefound', {
        detail: {
          device,
          name,
          id: device.id,
          rssi: event.rssi,
          serial: extractSerialFromName(name),
          trusted: nameMatch || serviceMatch,
          source: 'scan',
        },
      }));
    };

    bluetooth.addEventListener('advertisementreceived', this.scanHandler);
    try {
      this.scan = await bluetooth.requestLEScan({
        filters: [...bluetoothServiceRequestFilters(), ...bluetoothRequestFilters()],
        keepRepeatedDevices: false,
      });
    } catch (error) {
      if (!isUnknownCgmServiceError(error) && !isUnknownBluetoothServiceError(error)) {
        throw error;
      }
      this.log(`BLE scan fallback: ${describeError(error)}`, 'warn');
      this.scan = await bluetooth.requestLEScan({
        filters: bluetoothRequestFilters(),
        keepRepeatedDevices: false,
      });
    }
    this.log('BLE scan: start');
    return this.scan;
  }

  stopAdvertisementScan(): void {
    if (this.scan) {
      this.scan.stop();
      this.scan = null;
      this.log('BLE scan: stop');
    }

    const bluetooth = navigator.bluetooth;
    if (this.scanHandler && bluetooth) {
      bluetooth.removeEventListener('advertisementreceived', this.scanHandler);
      this.scanHandler = null;
    }
  }

  setDevice(device: BluetoothDevice, source: DeviceSource = 'manual'): void {
    if (this.device && this.handleDisconnect) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    }

    this.device = device;
    this.serial = extractSerialFromName(device?.name || '');
    this.sensorInfo = {
      ...emptySensorInfo(),
      name: device?.name || 'Без имени',
      serial: this.serial,
      modelName: inferDeviceModelFromName(device?.name || ''),
      selectedAtMs: Date.now(),
    };
    this.handleDisconnect = () => {
      this.log('GATT disconnect');
      this.rejectWaiters(new Error('GATT отключен'));
      this.dispatchEvent(new CustomEvent('disconnected'));
    };
    this.device?.addEventListener('gattserverdisconnected', this.handleDisconnect);
    this.emitSensorInfo();
    this.dispatchEvent(new CustomEvent('selected', { detail: { device, source, serial: this.serial } }));
  }

  async connect(serialOverride = ''): Promise<void> {
    if (!this.device) {
      throw new Error('Сначала выберите сенсор');
    }

    const device = this.device;
    const serial = normalizeSerial(serialOverride || this.serial || extractSerialFromName(device.name));
    if (serial.length < 8 || serial.length > 14) {
      throw new Error('Укажите серийный номер сенсора без префикса X-');
    }

    this.serial = serial;

    let pendingF001Bootstrap = shouldUseAndroidF001Bootstrap(device);
    let f001BootstrapUsed = false;

    for (let attempt = 0; attempt <= CONNECT_RETRIES; attempt += 1) {
      let stage: ConnectionStage = 'connect';
      const useF001Bootstrap = pendingF001Bootstrap;
      pendingF001Bootstrap = false;
      this.closeGattSession();
      this.keyExchange = new AiDexKeyExchange(serial);
      this.commandBuilder = new AiDexCommandBuilder(this.keyExchange);
      this.dispatchEvent(new CustomEvent('phase', { detail: { phase: 'gatt' } }));

      try {
        const gatt = device.gatt;
        if (!gatt) {
          throw new Error('GATT недоступен для выбранного устройства');
        }

        this.log(`GATT connect: name=${device.name || 'unknown'} id=${device.id}`);
        this.server = await gatt.connect();
        stage = 'services';
        await this.settleAfterConnect();
        this.service = await this.getAiDexService();
        stage = 'characteristics';
        await this.cacheCharacteristics();
        stage = 'cccd';
        await this.enableNotifications({ includeF001: !useF001Bootstrap });
        if (useF001Bootstrap) {
          f001BootstrapUsed = true;
          await this.primeAndroidF001Bonding();
          this.log('GATT retry: reconnect after F001 write bootstrap', 'warn');
          this.closeGattSession();
          await delay(CONNECT_RETRY_DELAY_MS);
          continue;
        }
        stage = 'key-exchange';
        await this.performKeyExchange();
        this.dispatchEvent(new CustomEvent('phase', { detail: { phase: 'key' } }));
        this.log('KEY session: ready');
        await this.requestSensorInfo();
        await this.startConnectedBroadcastMode();
        return;
      } catch (error) {
        const isF001CccdFailure = Boolean((error as Partial<LinxGattError> | undefined)?.linxF001Cccd);
        if (isF001CccdFailure && shouldRetryWithAndroidF001Bootstrap(device, f001BootstrapUsed)) {
          pendingF001Bootstrap = true;
          this.log('GATT retry: F001 CCCD failed; next attempt uses F001 write bootstrap', 'warn');
          this.closeGattSession();
          await delay(CONNECT_RETRY_DELAY_MS);
          continue;
        }

        const retryPlan = connectionRetryPlan(error, stage, attempt);

        if (retryPlan) {
          this.log(retryPlan.message, 'warn');
          this.closeGattSession();
          await delay(retryPlan.delayMs);
          continue;
        }

        this.closeGattSession();
        if (!this.authenticated && (isAuthenticationError(error) || isGattDisconnectedError(error))) {
          const detail = isF001CccdFailure ? ' Разрыв произошел на CCCD F001.' : '';
          this.log(
            `F001/bonding не завершился.${detail} Web Bluetooth не дает вызвать bonding напрямую.`,
            'error',
          );
        }
        throw error;
      }
    }

    if (!this.authenticated) {
      const error = new Error('Не удалось подключиться к GATT после повторов');
      this.log(
        'F001/bonding не завершился. Web Bluetooth не дает вызвать bonding напрямую.',
        'error',
      );
      throw error;
    }
  }

  async getAiDexService(): Promise<BluetoothRemoteGATTService> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= SERVICE_DISCOVERY_RETRIES; attempt += 1) {
      try {
        return await this.resolveAiDexService();
      } catch (error) {
        lastError = error;
        if (!isServiceDiscoveryRetryableError(error) || attempt === SERVICE_DISCOVERY_RETRIES || !this.connected) {
          throw error;
        }

        const retryIndex = attempt + 1;
        this.log(
          `GATT service retry: attempt=${retryIndex}/${SERVICE_DISCOVERY_RETRIES} reason=${describeError(error)}`,
          'warn',
        );
        await delay(SERVICE_DISCOVERY_RETRY_DELAY_MS);
      }
    }

    throw normalizeError(lastError, 'Сервис 181F не найден');
  }

  async resolveAiDexService(): Promise<BluetoothRemoteGATTService> {
    const server = this.requireServer();
    try {
      return await this.runGattOperation(() => server.getPrimaryService(SERVICE_F000));
    } catch (error) {
      if (!isUnknownCgmServiceError(error)) {
        throw error;
      }

      this.log('WebBLE не знает имя сервиса Continuous Glucose Monitoring. Ищу 181F через список primary services.', 'warn');
      if (typeof server.getPrimaryServices !== 'function') {
        this.log('getPrimaryServices() в этом WebBLE недоступен', 'error');
        throw error;
      }

      let services: BluetoothRemoteGATTService[];
      try {
        services = await this.runGattOperation(() => server.getPrimaryServices!());
      } catch (fallbackError) {
        this.log(`getPrimaryServices() не сработал: ${describeError(fallbackError)}`, 'error');
        throw fallbackError;
      }

      this.log(`Primary services: ${services.map((service) => service.uuid || '?').join(', ')}`);
      const service = services.find((candidate) => sameBluetoothUuid(candidate.uuid, SERVICE_F000));
      if (!service) {
        throw new Error('Сервис 181F найден не был среди primary services');
      }

      return service;
    }
  }

  async settleAfterConnect(): Promise<void> {
    const delayMs = postConnectSettleDelayMs();
    if (delayMs <= 0) {
      return;
    }

    this.log(`GATT settle: ${delayMs}ms`);
    await delay(delayMs);
  }

  async resetSensor(): Promise<{ confirmed: boolean }> {
    if (!this.authenticated) {
      throw new Error('Сначала выполните подключение и обмен ключами');
    }

    const commandBuilder = this.requireCommandBuilder();
    const flow = resetFlowForFirmware(this.sensorInfo.firmwareVersion);
    const resetRequestedAtMs = Date.now();
    const clearStatus = await this.sendF002CommandStatus(
      OPCODES.CLEAR_STORAGE,
      () => commandBuilder.clearStorage(),
    );

    if (clearStatus !== 0x00) {
      throw new Error(`CLEAR_STORAGE вернул статус 0x${clearStatus.toString(16).padStart(2, '0')}`);
    }

    if (flow === 'clear-storage-activation') {
      return this.finishClearStorageActivationReset(resetRequestedAtMs);
    }

    return this.finishLegacyReset();
  }

  async sendOpcodeCommand(opcode: number, params: number[] = [], timeoutMs: number = TIMEOUTS.commandAck): Promise<OpcodeCommandResult> {
    if (!this.authenticated) {
      throw new Error('Сначала выполните подключение и обмен ключами');
    }

    if (!this.connected) {
      await this.reconnectAfterClearStorage();
    }

    const normalizedOpcode = opcode & 0xff;
    this.dispatchEvent(new CustomEvent('phase', { detail: { phase: 'reset' } }));
    this.log(`LAB send: opcode=${opcodeHex(normalizedOpcode)} params=${formatTraceBytes(Uint8Array.from(params))}`, 'warn');

    try {
      const response = await this.sendF002Command(
        normalizedOpcode,
        () => this.requireCommandBuilder().encrypted(normalizedOpcode, params),
        timeoutMs,
      );
      const plain = requirePlainPacket(response);
      const statusByte = plain.length >= 2 ? plain[1] : null;
      const resultStatus = statusByte === 0x00 ? 'ok' : 'warn';
      const result: OpcodeCommandResult = {
        opcode: normalizedOpcode,
        opcodeHex: opcodeHex(normalizedOpcode),
        status: resultStatus,
        statusByte,
        detail: statusByte === null ? 'response without status byte' : `byte1=${opcodeHex(statusByte)}`,
        plainHex: bytesToHex(plain),
      };
      this.log(`LAB result: opcode=${result.opcodeHex} ${result.detail}`, resultStatus === 'ok' ? 'info' : 'warn');
      return result;
    } catch (error) {
      const result: OpcodeCommandResult = {
        opcode: normalizedOpcode,
        opcodeHex: opcodeHex(normalizedOpcode),
        status: 'error',
        statusByte: null,
        detail: describeError(error),
        plainHex: '',
      };
      this.log(`LAB error: opcode=${result.opcodeHex} ${result.detail}`, 'error');
      return result;
    }
  }

  async finishLegacyReset(): Promise<{ confirmed: boolean }> {
    const commandBuilder = this.requireCommandBuilder();

    try {
      const resetStatus = await this.sendF002CommandStatus(
        OPCODES.RESET,
        () => commandBuilder.reset(),
      );
      if (resetStatus !== 0x00) {
        throw new Error(`RESET вернул статус 0x${resetStatus.toString(16).padStart(2, '0')}`);
      }
      this.dispatchEvent(new CustomEvent('phase', { detail: { phase: 'reset' } }));
      return { confirmed: true };
    } catch (error) {
      if (!this.connected) {
        this.dispatchEvent(new CustomEvent('phase', { detail: { phase: 'reset' } }));
        this.log('GATT disconnect after TX F002 0xF0', 'warn');
        return { confirmed: false };
      }
      throw error;
    }
  }

  async finishClearStorageActivationReset(resetRequestedAtMs: number): Promise<{ confirmed: boolean }> {
    await delay(CLEAR_STORAGE_QUIET_WINDOW_MS);
    await this.reconnectAfterClearStorage();
    const confirmed = await this.activatePostResetStartTimeIfNeeded(resetRequestedAtMs);
    this.dispatchEvent(new CustomEvent('phase', { detail: { phase: 'reset' } }));
    return { confirmed };
  }

  async reconnectAfterClearStorage(): Promise<void> {
    this.closeGattSession();
    await delay(GATT_SETTLE_DELAY_MS);
    await this.connect(this.serial);
  }

  async activatePostResetStartTimeIfNeeded(resetRequestedAtMs: number): Promise<boolean> {
    if (!this.shouldSetNewSensorAfterReset(resetRequestedAtMs)) {
      return true;
    }

    const commandBuilder = this.requireCommandBuilder();
    try {
      const status = await this.sendF002CommandStatus(
        OPCODES.SET_NEW_SENSOR,
        () => commandBuilder.setNewSensor(),
      );
      if (status !== 0x00) {
        throw new Error(`SET_NEW_SENSOR вернул статус 0x${status.toString(16).padStart(2, '0')}`);
      }
      await delay(1_000);
      await this.requestOptionalF002Info(
        OPCODES.GET_LOCAL_START_TIME,
        () => this.requireCommandBuilder().getLocalStartTime(),
        'время запуска после 0x20',
      );
      return true;
    } catch (error) {
      if (!this.connected) {
        this.log('GATT disconnect after TX F002 0x20', 'warn');
        return false;
      }
      throw error;
    }
  }

  shouldSetNewSensorAfterReset(resetRequestedAtMs: number): boolean {
    const startTimeMs = this.sensorInfo.startTimeMs;
    if (this.sensorInfo.notStarted || startTimeMs === null) {
      return true;
    }

    return startTimeMs < resetRequestedAtMs - POST_RESET_STALE_START_TOLERANCE_MS;
  }

  async sendF002CommandStatus(
    opcode: number,
    buildCommand: F002CommandBuilder,
    timeoutMs: number = TIMEOUTS.commandAck,
  ): Promise<number> {
    const response = await this.sendF002Command(opcode, buildCommand, timeoutMs);
    const plain = requirePlainPacket(response);
    const status = plain[1] ?? 0xff;
    this.log(formatStatusLine('RX', CHAR_F002, opcode, status));
    return status;
  }

  async sendF002Command(
    opcode: number,
    buildCommand: F002CommandBuilder,
    timeoutMs: number = TIMEOUTS.commandAck,
  ): Promise<LinxPacket> {
    const f002 = this.requireCharacteristic(CHAR_F002);
    const command = await buildCommand();
    const responsePromise = this.waitForF002OpcodeWithReadFallback(opcode, timeoutMs);
    responsePromise.catch(() => undefined);
    await this.writeCharacteristic(f002, command, opcodeDescription(opcode), 'enc');
    return responsePromise;
  }

  async requestSensorInfo(): Promise<void> {
    if (!this.authenticated) {
      return;
    }

    const commandBuilder = this.requireCommandBuilder();
    await this.requestOptionalF002Info(
      OPCODES.GET_STARTUP_DEVICE_INFO,
      () => commandBuilder.getStartupDeviceInfo(),
      'информация сенсора 0x10',
    );

    await this.requestOptionalF002Info(
      OPCODES.GET_LOCAL_START_TIME,
      () => commandBuilder.getLocalStartTime(),
      'время запуска 0x21',
    );

    await this.requestDeviceInformation();
  }

  async startConnectedBroadcastMode(): Promise<void> {
    if (!this.authenticated) {
      return;
    }

    const commandBuilder = this.requireCommandBuilder();
    await this.requestOptionalF002Info(
      OPCODES.SET_DYNAMIC_ADV_MODE,
      () => commandBuilder.setDynamicAdvMode(1),
      'dynamic adv 0x35',
    );
    await this.requestOptionalF002Info(
      OPCODES.SET_AUTO_UPDATE_STATUS,
      () => commandBuilder.setAutoUpdateStatus(true),
      'auto update 0x34',
    );
    await this.requestOptionalF002Info(
      OPCODES.GET_BROADCAST_DATA,
      () => commandBuilder.getBroadcastData(),
      'broadcast data 0x11',
    );
  }

  async requestOptionalF002Info(opcode: number, buildCommand: F002CommandBuilder, label: string): Promise<void> {
    try {
      const f002 = this.requireCharacteristic(CHAR_F002);
      const responsePromise = this.waitForF002OpcodeWithReadFallback(opcode, TIMEOUTS.sensorInfo);
      await this.writeCharacteristic(f002, await buildCommand(), opcodeDescription(opcode), 'enc');
      const response = await responsePromise;
      this.applyF002SensorInfo(response);
    } catch (error) {
      this.log(`ERR F002 ${opcodeHex(opcode)} (${label}): ${describeError(error)}`, 'warn');
    }
  }

  async requestDeviceInformation(): Promise<void> {
    let service: BluetoothRemoteGATTService;
    try {
      service = await this.runGattOperation(() => this.requireServer().getPrimaryService(SERVICE_DIS));
    } catch (error) {
      this.log(`DIS ${shortUuid(SERVICE_DIS)} unavailable: ${describeError(error)}`, 'warn');
      return;
    }

    await this.readOptionalDeviceInformationString(service, CHAR_DIS_MANUFACTURER_NAME, 'производитель');

    const modelName = await this.readOptionalDeviceInformationString(service, CHAR_DIS_MODEL_NUMBER, 'модель');
    const serial = normalizeSerial(
      await this.readOptionalDeviceInformationString(service, CHAR_DIS_SERIAL_NUMBER, 'серийный номер'),
    );
    const softwareRevision = await this.readOptionalDeviceInformationString(
      service,
      CHAR_DIS_SOFTWARE_REVISION,
      'версия ПО',
    );
    const firmwareRevision = softwareRevision
      ? ''
      : await this.readOptionalDeviceInformationString(service, CHAR_DIS_FIRMWARE_REVISION, 'версия прошивки');
    const firmwareVersion = softwareRevision || firmwareRevision;
    const patch: Partial<SensorInfo> = {};

    if (modelName) {
      patch.modelName = modelName;
    }
    if (serial) {
      this.serial = serial;
      patch.serial = serial;
    }
    if (firmwareVersion) {
      patch.firmwareVersion = firmwareVersion;
    }

    if (Object.keys(patch).length > 0) {
      this.updateSensorInfo(patch);
    }
  }

  async readOptionalDeviceInformationString(
    service: BluetoothRemoteGATTService,
    uuid: string,
    description: string,
  ): Promise<string> {
    try {
      this.log(formatControlLine('TX', uuid, 'read', description));
      const characteristic = await this.runGattOperation(() => service.getCharacteristic(uuid));
      const bytes = dataViewToBytes(await this.runGattOperation(() => characteristic.readValue()));
      const value = decodeGattString(bytes);
      this.log(formatTraceLine('RX', uuid, bytes, value ? `${description}: ${value}` : description, 'read'));
      return value;
    } catch (error) {
      this.log(`DIS ${shortUuid(uuid)} unavailable: ${describeError(error)}`, 'warn');
      return '';
    }
  }

  disconnect(): void {
    this.stopAdvertisementScan();
    this.rejectWaiters(new Error('Соединение закрыто'));
    this.closeGattSession();
    this.keyExchange = null;
    this.commandBuilder = null;
  }

  closeGattSession(): void {
    this.detachNotificationHandlers();
    try {
      this.device?.gatt?.disconnect();
    } catch (_error) {
      // Ignore disconnect races from the browser BLE stack.
    }
    this.characteristics.clear();
    this.server = null;
    this.service = null;
  }

  detachNotificationHandlers(): void {
    for (const [uuid, entry] of this.notificationHandlers) {
      entry.characteristic.removeEventListener('characteristicvaluechanged', entry.handler);
      this.notificationHandlers.delete(uuid);
    }
  }

  async forgetDevice(): Promise<{ permissionForgot: boolean }> {
    const device = this.device;
    this.disconnect();

    let permissionForgot = false;
    if (device && typeof device.forget === 'function') {
      await device.forget();
      permissionForgot = true;
    }

    if (device && this.handleDisconnect) {
      device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    }

    this.device = null;
    this.serial = '';
    this.dispatchEvent(new CustomEvent('forgot', { detail: { device, permissionForgot } }));
    return { permissionForgot };
  }

  async cacheCharacteristics(): Promise<void> {
    if (!this.service) {
      throw new Error('Сервис AiDEX не найден');
    }

    for (const uuid of [CHAR_F001, CHAR_F002, CHAR_F003]) {
      const characteristic = await this.service.getCharacteristic(uuid);
      this.characteristics.set(uuid, characteristic);
      this.log(`GATT char ${shortUuid(uuid)} props=${characteristicPropertiesDescription(characteristic)}`);
    }
  }

  async enableNotifications(options: { includeF001?: boolean } = {}): Promise<void> {
    this.detachNotificationHandlers();
    const order = notificationOrder(options.includeF001 !== false);
    const suffix = options.includeF001 === false ? ' (F001 skipped for bootstrap)' : '';
    this.log(`CCCD order: ${order.map(shortUuid).join(',')}${suffix}`);

    for (const uuid of order) {
      const characteristic = this.requireCharacteristic(uuid);
      this.attachNotificationHandler(uuid, characteristic);
      this.log(formatControlLine('TX', uuid, 'cccd', 'enable notify'));
      try {
        await this.startNotifications(characteristic, uuid);
      } catch (error) {
        markGattStageError(error, `cccd:${shortUuid(uuid)}`, uuid === CHAR_F001);
        this.log(`ERR ${shortUuid(uuid)} cccd: ${describeError(error)}`, 'error');
        throw error;
      }
      await delay(uuid === CHAR_F001 ? authCccdSettleDelayMs() : GATT_SETTLE_DELAY_MS);
    }
  }

  async primeAndroidF001Bonding(): Promise<void> {
    const f001 = this.requireCharacteristic(CHAR_F001);
    const keyExchange = this.requireKeyExchange();
    this.log('GATT F001 bootstrap: write challenge before CCCD', 'warn');
    await this.writeCharacteristic(
      f001,
      keyExchange.getChallenge(),
      'pair bootstrap',
      'raw',
      'without-response-first',
    );
    await delay(ANDROID_F001_BOOTSTRAP_DELAY_MS);
  }

  attachNotificationHandler(uuid: string, characteristic: BluetoothRemoteGATTCharacteristic): void {
    const existing = this.notificationHandlers.get(uuid);
    if (existing) {
      existing.characteristic.removeEventListener('characteristicvaluechanged', existing.handler);
    }

    const handler = (event: Event & { target: BluetoothRemoteGATTCharacteristic }) => {
      this.handleNotification(uuid, event).catch((error) => this.log(describeError(error), 'error'));
    };
    characteristic.addEventListener('characteristicvaluechanged', handler);
    this.notificationHandlers.set(uuid, { characteristic, handler });
  }

  async startNotifications(characteristic: BluetoothRemoteGATTCharacteristic, uuid: string): Promise<void> {
    await this.runGattOperation(() => characteristic.startNotifications());
    this.log(`OK ${shortUuid(uuid)} cccd (notify ready)`);
  }

  async writeCharacteristic(
    characteristic: BluetoothRemoteGATTCharacteristic,
    bytes: ByteInput,
    description: string | null = null,
    encoding: TraceEncoding = 'raw',
    writePreference: CharacteristicWritePreference = 'default',
  ): Promise<void> {
    this.log(formatTraceLine('TX', characteristic.uuid, bytes, description, encoding));
    const methodName = await this.runGattOperation(() => writeRawCharacteristic(characteristic, bytes, writePreference));
    this.log(`OK ${shortUuid(characteristic.uuid)} write (${methodName})`);
  }

  async runGattOperation<T>(operation: () => Promise<T>): Promise<T> {
    return withGattRetry(() => this.withDisconnectGuard(operation));
  }

  async withDisconnectGuard<T>(operation: () => Promise<T>): Promise<T> {
    const device = this.device;
    if (!device?.gatt?.connected) {
      throw new Error('GATT отключен до операции');
    }

    let disconnectHandler: ((event: Event) => void) | null = null;
    const disconnectPromise = new Promise<T>((_, reject) => {
      disconnectHandler = () => reject(new Error('GATT отключен во время операции'));
      device.addEventListener('gattserverdisconnected', disconnectHandler, { once: true });
    });

    try {
      const operationPromise = Promise.resolve().then(operation);
      operationPromise.catch(() => {});
      return await Promise.race([operationPromise, disconnectPromise]);
    } finally {
      if (disconnectHandler) {
        device.removeEventListener('gattserverdisconnected', disconnectHandler);
      }
    }
  }

  async refreshPostBondNotifications(): Promise<void> {
    for (const uuid of [CHAR_F003, CHAR_F002]) {
      await this.startNotifications(this.requireCharacteristic(uuid), uuid);
      await delay(GATT_SETTLE_DELAY_MS);
    }
    this.log(`CCCD refresh: ${[CHAR_F003, CHAR_F002].map(shortUuid).join(',')}`);
  }

  async performKeyExchange(): Promise<void> {
    const f001 = this.requireCharacteristic(CHAR_F001);
    const f002 = this.requireCharacteristic(CHAR_F002);
    const keyExchange = this.requireKeyExchange();

    const pairPacket = await this.writePairChallenge(f001, keyExchange);
    keyExchange.setPairKey(pairPacket.raw);

    this.log(formatControlLine('TX', CHAR_F002, 'read', 'bond read'));
    const bond = dataViewToBytes(await this.runGattOperation(() => f002.readValue()));
    this.log(formatTraceLine('RX', CHAR_F002, bond, 'bond data', 'read'));
    if (bond.length !== 17) {
      throw new Error(`BOND должен быть 17 байт, получено ${bond.length}`);
    }

    const bondOk = await keyExchange.decryptBond(bond);
    if (!bondOk) {
      throw new Error('BOND не расшифрован или CRC-8 не совпал');
    }

    await this.writeCharacteristic(
      f001,
      await keyExchange.postBondConfig(),
      'bond config',
      'enc',
      postBondConfigWritePreference(),
    );
    await delay(500);
    await this.refreshPostBondNotifications();
  }

  async writePairChallenge(
    characteristic: BluetoothRemoteGATTCharacteristic,
    keyExchange: AiDexKeyExchange,
  ): Promise<LinxPacket> {
    const challenge = keyExchange.getChallenge();
    const attempts = pairChallengeAttempts();
    let lastError: unknown;

    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index];
      const pairPromise = this.waitForPacket(
        (packet) => packet.uuid === CHAR_F001 && packet.raw.length >= 16,
        attempt.timeoutMs,
      );
      pairPromise.catch(() => undefined);

      try {
        const challengeBytes = attempt.challenge ?? challenge;
        await this.writeCharacteristic(
          characteristic,
          challengeBytes,
          attempt.description,
          'raw',
          attempt.writePreference,
        );
        return await pairPromise;
      } catch (error) {
        lastError = error;
        if (!this.connected || index === attempts.length - 1) {
          throw error;
        }

        const nextAttempt = attempts[index + 1]?.description || 'none';
        this.log(`F001 pair retry: ${describeError(error)}; next=${nextAttempt}`, 'warn');
        await delay(GATT_SETTLE_DELAY_MS);
      }
    }

    throw normalizeError(lastError, 'F001 pair challenge failed');
  }

  async handleNotification(uuid: string, event: Event & { target: BluetoothRemoteGATTCharacteristic }): Promise<void> {
    const value = event.target.value;
    if (!value) {
      this.log(formatTraceLine('RX', uuid, Uint8Array.of(), 'empty notify', 'raw'), 'warn');
      return;
    }

    const raw = dataViewToBytes(value);
    const packet: LinxPacket = { uuid, raw, plain: null };
    this.log(formatTraceLine('RX', uuid, raw, notificationDescription(uuid, raw, this.authenticated), this.authenticated ? 'enc' : 'raw'));

    if (uuid === CHAR_F002 && this.authenticated) {
      try {
        packet.plain = await this.requireKeyExchange().decrypt(raw);
        packet.opcode = packet.plain[0];
        this.log(formatTraceLine('RX', uuid, packet.plain, plainPacketDescription(uuid, packet.plain), 'plain'));
        this.applyF002SensorInfo(packet);
      } catch (error) {
        this.log(`F002 decrypt: ${describeError(error)}`, 'warn');
      }
    } else if (uuid === CHAR_F003 && this.authenticated) {
      try {
        packet.plain = await this.requireKeyExchange().decrypt(raw);
        this.log(formatTraceLine('RX', uuid, packet.plain, plainPacketDescription(uuid, packet.plain), 'plain'));
        this.applyF003SensorInfo(packet.plain);
      } catch (error) {
        this.log(`F003 decrypt: ${describeError(error)}`, 'warn');
      }
    }

    this.resolveWaiters(packet);
  }

  applyF002SensorInfo(packet: LinxPacket): void {
    if (!packet?.plain?.length) return;

    if (packet.opcode === OPCODES.GET_STARTUP_DEVICE_INFO) {
      const parsed = parseStartupDeviceInfoResponse(packet.plain);
      if (!parsed) return;
      this.updateSensorInfo({
        firmwareVersion: parsed.firmwareVersion,
        hardwareVersion: parsed.hardwareVersion,
        modelName: parsed.modelName,
        wearDays: parsed.wearDays,
      });
      this.log(`PARSE F002 0x10: model=${parsed.modelName} fw=${parsed.firmwareVersion} hw=${parsed.hardwareVersion} wearDays=${parsed.wearDays}`);
      return;
    }

    if (packet.opcode === OPCODES.GET_LOCAL_START_TIME) {
      const parsed = parseLocalStartTimeResponse(packet.plain);
      if (!parsed) return;
      if (!parsed.isStarted) {
        this.updateSensorInfo({
          notStarted: true,
          startTimeMs: null,
          startTimeEstimated: false,
          startTimeSource: '0x21',
        });
        this.log('PARSE F002 0x21: started=false', 'warn');
        return;
      }
      if (parsed.utcMs === null) {
        return;
      }

      this.updateSensorInfo({
        notStarted: false,
        startTimeMs: parsed.utcMs,
        startTimeEstimated: false,
        startTimeSource: '0x21',
      });
      this.log(`PARSE F002 0x21: startUtc=${new Date(parsed.utcMs).toISOString()} tzQ=${parsed.tzQuarters} dstQ=${parsed.dstQuarters}`);
    }
  }

  applyF003SensorInfo(plain: ByteInput): void {
    const status = parseF003StatusFrame(plain);
    if (status) {
      this.updateSensorInfo({
        batteryMillivolts: status.millivolts,
        batteryUpdatedAtMs: Date.now(),
      });
      this.log(`PARSE F003 status: batteryMv=${status.millivolts}`);
      return;
    }

    const dataFrame = parseF003DataFrame(plain);
    if (!dataFrame) return;

    const patch: Partial<SensorInfo> = {
      ageMinutes: dataFrame.timeOffsetMinutes,
      lastFrameAtMs: Date.now(),
    };

    if (!this.sensorInfo.startTimeMs && dataFrame.timeOffsetMinutes >= 0) {
      patch.startTimeMs = Date.now() - dataFrame.timeOffsetMinutes * 60_000;
      patch.startTimeEstimated = true;
      patch.startTimeSource = 'F003';
    }

    this.updateSensorInfo(patch);
    this.log(`PARSE F003 data: ageMin=${dataFrame.timeOffsetMinutes} glucose=${dataFrame.glucoseMgDl} valid=${dataFrame.isValid}`);
  }

  waitForF002Opcode(opcode: number, timeoutMs: number): Promise<LinxPacket> {
    return this.waitForPacket(
      (packet) => packet.uuid === CHAR_F002 && packet.plain?.[0] === opcode,
      timeoutMs,
    );
  }

  waitForF002OpcodeWithReadFallback(opcode: number, timeoutMs: number): Promise<LinxPacket> {
    const notificationPromise = this.waitForF002Opcode(opcode, timeoutMs);
    let settled = false;
    notificationPromise
      .catch(() => undefined)
      .finally(() => {
        settled = true;
      });

    const readFallbackPromise = (async () => {
      const deadline = Date.now() + timeoutMs;
      await delay(Math.min(F002_READ_FALLBACK_DELAY_MS, timeoutMs));

      while (!settled && this.connected && Date.now() < deadline) {
        try {
          const packet = await this.readF002Fallback(opcode);
          if (packet.plain?.[0] === opcode) {
            return packet;
          }
        } catch (error) {
          if (!settled) {
            this.log(`F002 read fallback ${opcodeHex(opcode)}: ${describeError(error)}`, 'warn');
          }
        }

        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) break;
        await delay(Math.min(F002_READ_FALLBACK_INTERVAL_MS, remainingMs));
      }

      return notificationPromise;
    })();

    return Promise.race([notificationPromise, readFallbackPromise]);
  }

  async readF002Fallback(opcode: number): Promise<LinxPacket> {
    const f002 = this.requireCharacteristic(CHAR_F002);
    this.log(formatControlLine('TX', CHAR_F002, 'read', `fallback ${opcodeHex(opcode)}`));
    const raw = dataViewToBytes(await this.runGattOperation(() => f002.readValue()));
    this.log(formatTraceLine('RX', CHAR_F002, raw, `fallback ${opcodeHex(opcode)}`, 'read'));

    let plain: Uint8Array | null = null;
    if (this.authenticated) {
      plain = await this.requireKeyExchange().decrypt(raw);
      this.log(formatTraceLine('RX', CHAR_F002, plain, plainPacketDescription(CHAR_F002, plain), 'plain'));
    }

    const packet: LinxPacket = {
      uuid: CHAR_F002,
      raw,
      plain,
      opcode: plain?.[0],
    };

    if (plain) {
      this.applyF002SensorInfo(packet);
    }
    this.resolveWaiters(packet);
    return packet;
  }

  waitForPacket(predicate: (packet: LinxPacket) => boolean, timeoutMs: number): Promise<LinxPacket> {
    return new Promise((resolve, reject) => {
      const waiter: PacketWaiter = {
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => undefined, 0),
      };
      clearTimeout(waiter.timer);
      waiter.timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error('Таймаут ожидания ответа сенсора'));
      }, timeoutMs);
      this.waiters.add(waiter);
    });
  }

  resolveWaiters(packet: LinxPacket): void {
    for (const waiter of Array.from(this.waiters)) {
      if (waiter.predicate(packet)) {
        clearTimeout(waiter.timer);
        this.waiters.delete(waiter);
        waiter.resolve(packet);
      }
    }
  }

  rejectWaiters(error: Error): void {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.waiters.clear();
  }

  assertBluetoothSupport(): Bluetooth {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth не поддерживается этим браузером');
    }
    return navigator.bluetooth;
  }

  log(message: string, level: LogLevel = 'info'): void {
    this.dispatchEvent(new CustomEvent('log', { detail: { message, level, time: new Date() } }));
  }

  updateSensorInfo(patch: Partial<SensorInfo>): void {
    this.sensorInfo = {
      ...this.sensorInfo,
      ...patch,
      name: patch.name || this.sensorInfo.name || this.device?.name || 'Без имени',
      serial: patch.serial || this.sensorInfo.serial || this.serial,
      updatedAtMs: Date.now(),
    };
    this.emitSensorInfo();
  }

  emitSensorInfo(): void {
    this.dispatchEvent(new CustomEvent('sensorinfo', { detail: { info: { ...this.sensorInfo } } }));
  }

  requireServer(): BluetoothRemoteGATTServer {
    if (!this.server) {
      throw new Error('GATT server не подключен');
    }
    return this.server;
  }

  requireCharacteristic(uuid: string): BluetoothRemoteGATTCharacteristic {
    const characteristic = this.characteristics.get(uuid);
    if (!characteristic) {
      throw new Error(`Characteristic ${shortUuid(uuid)} не найден`);
    }
    return characteristic;
  }

  requireKeyExchange(): AiDexKeyExchange {
    if (!this.keyExchange) {
      throw new Error('Обмен ключами не инициализирован');
    }
    return this.keyExchange;
  }

  requireCommandBuilder(): AiDexCommandBuilder {
    if (!this.commandBuilder) {
      throw new Error('Команды сенсора не инициализированы');
    }
    return this.commandBuilder;
  }
}

export function bluetoothCapabilities(): BluetoothCapabilities {
  return {
    bluetooth: Boolean(navigator.bluetooth),
    leScan: Boolean(navigator.bluetooth && 'requestLEScan' in navigator.bluetooth),
    secureContext: window.isSecureContext,
  };
}

export function deviceRecordFromBluetoothDevice(device: BluetoothDevice, source: DeviceSource = 'chooser'): DeviceRecord {
  return {
    id: device.id,
    device,
    name: device.name || 'Без имени',
    source,
    serial: extractSerialFromName(device.name || ''),
    modelName: inferDeviceModelFromName(device.name || ''),
    trusted: isKnownDeviceName(device.name),
  };
}

export { DEVICE_NAME_PREFIXES };

function emptySensorInfo(): SensorInfo {
  return {
    name: '',
    serial: '',
    modelName: '',
    firmwareVersion: '',
    hardwareVersion: '',
    wearDays: 15,
    startTimeMs: null,
    startTimeEstimated: false,
    startTimeSource: '',
    notStarted: false,
    batteryMillivolts: null,
    batteryUpdatedAtMs: null,
    ageMinutes: null,
    selectedAtMs: null,
    updatedAtMs: null,
    lastFrameAtMs: null,
  };
}

function dataViewToBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}

function decodeGattString(bytes: Uint8Array): string {
  return new TextDecoder('utf-8')
    .decode(bytes)
    .replace(/\0+$/g, '')
    .trim();
}

function requirePlainPacket(packet: LinxPacket): Uint8Array {
  if (!packet.plain) {
    throw new Error('Ответ сенсора не расшифрован');
  }
  return packet.plain;
}

function formatTraceLine(
  direction: TraceDirection,
  uuid: string,
  bytes: ByteInput,
  description: string | null,
  encoding: TraceEncoding,
): string {
  const suffix = description ? ` (${description})` : '';
  return `${direction} ${shortUuid(uuid)} ${encoding}: ${formatTraceBytes(bytesFromInput(bytes))}${suffix}`;
}

function formatControlLine(direction: TraceDirection, uuid: string, action: TraceEncoding, description: string): string {
  return `${direction} ${shortUuid(uuid)} ${action} (${description})`;
}

function formatStatusLine(direction: TraceDirection, uuid: string, opcode: number, status: number): string {
  const description = opcodeDescription(opcode);
  const suffix = description ? ` (${description})` : '';
  return `${direction} ${shortUuid(uuid)} ack: opcode=${opcodeHex(opcode)} status=${opcodeHex(status)}${suffix}`;
}

function formatTraceBytes(bytes: Uint8Array, maxBytes = 96): string {
  if (bytes.length === 0) {
    return '[0B]';
  }

  const shown = bytes.length > maxBytes ? bytes.slice(0, maxBytes) : bytes;
  const truncated = bytes.length > maxBytes ? ' ...' : '';
  return `${bytesToHex(shown)}${truncated} [${bytes.length}B]`;
}

function bytesFromInput(input: ByteInput): Uint8Array {
  if (input instanceof Uint8Array) {
    return Uint8Array.from(input);
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (ArrayBuffer.isView(input)) {
    const view = input as ArrayBufferView;
    return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
  }
  return Uint8Array.from(input);
}

function notificationDescription(uuid: string, bytes: Uint8Array, authenticated: boolean): string | null {
  if (sameBluetoothUuid(uuid, CHAR_F001) && bytes.length >= 16) {
    return 'ключ пары';
  }

  if (authenticated && sameBluetoothUuid(uuid, CHAR_F002)) {
    return 'encrypted data';
  }
  if (authenticated && sameBluetoothUuid(uuid, CHAR_F003)) {
    return 'encrypted stream';
  }

  return 'raw notify';
}

function plainPacketDescription(uuid: string, bytes: Uint8Array): string | null {
  if (sameBluetoothUuid(uuid, CHAR_F002) && bytes.length > 0) {
    return opcodeDescription(bytes[0]);
  }

  if (sameBluetoothUuid(uuid, CHAR_F003)) {
    if (parseF003StatusFrame(bytes)) {
      return 'статус батареи';
    }
    if (parseF003DataFrame(bytes)) {
      return 'данные CGM';
    }
  }

  if (sameBluetoothUuid(uuid, CHAR_F001) && bytes.length >= 16) {
    return 'ключ пары';
  }

  return null;
}

function opcodeDescription(opcode: number): string | null {
  switch (opcode) {
    case OPCODES.GET_STARTUP_DEVICE_INFO:
      return 'инфо устройства';
    case OPCODES.GET_BROADCAST_DATA:
      return 'broadcast data';
    case OPCODES.SET_NEW_SENSOR:
      return 'новый запуск';
    case OPCODES.GET_LOCAL_START_TIME:
      return 'время старта';
    case OPCODES.SET_AUTO_UPDATE_STATUS:
      return 'auto update';
    case OPCODES.SET_DYNAMIC_ADV_MODE:
      return 'dynamic adv';
    case OPCODES.CLEAR_STORAGE:
      return 'очистка памяти';
    case OPCODES.RESET:
      return 'сброс сенсора';
    default:
      return null;
  }
}

function opcodeHex(opcode: number): string {
  return `0x${(opcode & 0xff).toString(16).padStart(2, '0').toUpperCase()}`;
}

async function writeRawCharacteristic(
  characteristic: BluetoothRemoteGATTCharacteristic,
  bytes: ByteInput,
  writePreference: CharacteristicWritePreference = 'default',
): Promise<CharacteristicWriteMethodName> {
  const payload = toWritePayload(bytes);
  const writeValue = characteristic.writeValue?.bind(characteristic);
  const writeWithResponse = characteristic.writeValueWithResponse?.bind(characteristic);
  const writeWithoutResponse = characteristic.writeValueWithoutResponse?.bind(characteristic);
  const rawAttempts = writeAttempts(
    characteristic.uuid,
    writePreference,
    writeValue,
    writeWithResponse,
    writeWithoutResponse,
  );
  const attempts = rawAttempts
    .filter((entry): entry is [CharacteristicWriteMethodName, CharacteristicWriteMethod] => typeof entry[1] === 'function');

  if (attempts.length === 0) {
    throw new Error('Characteristic не поддерживает методы записи');
  }

  let lastError: unknown;
  for (const [name, method] of attempts) {
    try {
      await method.call(characteristic, payload);
      return name;
    } catch (error) {
      lastError = error;
    }
  }

  throw normalizeError(lastError, `BLE write failed (${attempts.map(([name]) => name).join(', ')})`);
}

function writeAttempts(
  uuid: string,
  writePreference: CharacteristicWritePreference,
  writeValue: CharacteristicWriteMethod | undefined,
  writeWithResponse: CharacteristicWriteMethod | undefined,
  writeWithoutResponse: CharacteristicWriteMethod | undefined,
): Array<[CharacteristicWriteMethodName, CharacteristicWriteMethod | undefined]> {
  if (writePreference === 'without-response-first') {
    return [
      ['writeValueWithoutResponse', writeWithoutResponse],
      ['writeValueWithResponse', writeWithResponse],
      ['writeValue', writeValue],
    ];
  }

  if (writePreference === 'with-response-first') {
    return [
      ['writeValueWithResponse', writeWithResponse],
      ['writeValue', writeValue],
      ['writeValueWithoutResponse', writeWithoutResponse],
    ];
  }

  if (sameBluetoothUuid(uuid, CHAR_F002)) {
    return [
      ['writeValueWithoutResponse', writeWithoutResponse],
      ['writeValueWithResponse', writeWithResponse],
      ['writeValue', writeValue],
    ];
  }

  return [
    ['writeValue', writeValue],
    ['writeValueWithResponse', writeWithResponse],
    ['writeValueWithoutResponse', writeWithoutResponse],
  ];
}

function toWritePayload(bytes: ByteInput): BufferSource {
  if (bytes instanceof ArrayBuffer) {
    return bytes;
  }
  if (ArrayBuffer.isView(bytes)) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
  return Uint8Array.from(bytes);
}

async function withGattRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= GATT_BUSY_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isGattBusyError(error) || attempt === GATT_BUSY_RETRIES) {
        throw error;
      }
      await delay(GATT_BUSY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortUuid(uuid: string): string {
  const normalized = normalizeBluetoothUuid(uuid);
  const bluetoothBaseMatch = normalized.match(/^0000([0-9a-f]{4})-/i);
  return (bluetoothBaseMatch?.[1] || String(uuid || '?')).toUpperCase();
}

function characteristicPropertiesDescription(characteristic: BluetoothRemoteGATTCharacteristic): string {
  const properties = characteristic.properties;
  if (!properties) {
    return 'unknown';
  }

  const enabled = [
    ['read', properties.read],
    ['write', properties.write],
    ['writeNoResp', properties.writeWithoutResponse],
    ['notify', properties.notify],
    ['indicate', properties.indicate],
  ].filter(([, value]) => value).map(([name]) => name);

  return enabled.length > 0 ? enabled.join('|') : 'none';
}

function sameBluetoothUuid(left: string, right: string): boolean {
  return normalizeBluetoothUuid(left) === normalizeBluetoothUuid(right);
}

function normalizeBluetoothUuid(uuid: string): string {
  const value = String(uuid || '').toLowerCase();
  if (/^[0-9a-f]{4}$/.test(value)) {
    return `0000${value}-0000-1000-8000-00805f9b34fb`;
  }
  if (/^[0-9a-f]{8}$/.test(value)) {
    return `${value}-0000-1000-8000-00805f9b34fb`;
  }
  return value;
}

function describeStage(stage: ConnectionStage): string {
  switch (stage) {
    case 'connect':
      return 'GATT connect';
    case 'services':
      return 'service discovery';
    case 'characteristics':
      return 'characteristics';
    case 'cccd':
      return 'CCCD';
    case 'key-exchange':
      return 'key exchange';
    default:
      return stage;
  }
}

function connectionRetryPlan(error: unknown, stage: ConnectionStage, attempt: number): ConnectionRetryPlan | null {
  if (!isGattDisconnectedError(error) || attempt >= CONNECT_RETRIES) {
    return null;
  }

  const retryIndex = attempt + 1;
  if (isF001CccdError(error)) {
    return {
      delayMs: F001_CCCD_SECURITY_RETRY_DELAY_MS,
      message: `GATT retry: stage=CCCD F001 reason=security transition attempt=${retryIndex}/${CONNECT_RETRIES}`,
    };
  }

  return {
    delayMs: CONNECT_RETRY_DELAY_MS * retryIndex,
    message: `GATT retry: stage=${describeStage(stage)} attempt=${retryIndex}/${CONNECT_RETRIES}`,
  };
}

function isF001CccdError(error: unknown): boolean {
  return Boolean((error as Partial<LinxGattError> | undefined)?.linxF001Cccd);
}

function notificationOrder(includeF001: boolean): string[] {
  return includeF001 ? CCCD_ORDER : CCCD_ORDER.filter((uuid) => uuid !== CHAR_F001);
}

function isServiceDiscoveryRetryableError(error: unknown): boolean {
  const text = errorSearchText(error);
  return isGattBusyError(error) ||
    isGattDisconnectedError(error) ||
    text.includes('notfounderror') ||
    text.includes('no services') ||
    text.includes('service not found') ||
    text.includes('service 181f');
}

function shouldUseAndroidF001Bootstrap(device: BluetoothDevice): boolean {
  return isAndroidRuntime() && isAiDexXDeviceName(device.name);
}

function shouldRetryWithAndroidF001Bootstrap(device: BluetoothDevice, f001BootstrapUsed: boolean): boolean {
  return !f001BootstrapUsed && shouldUseAndroidF001Bootstrap(device);
}

function isAiDexXDeviceName(name: unknown): boolean {
  return /\baidex\s*x\b/i.test(String(name || ''));
}

function pairChallengeAttempts(): PairChallengeAttempt[] {
  if (!isAndroidRuntime()) {
    return [
      {
        description: 'pair challenge',
        timeoutMs: TIMEOUTS.pairKeyRetry,
        writePreference: 'default',
      },
      {
        description: 'pair challenge official wake',
        timeoutMs: TIMEOUTS.pairKeyFirstAttempt,
        writePreference: 'without-response-first',
        challenge: OFFICIAL_PAIRED_F001_CHALLENGE,
      },
    ];
  }

  return [
    {
      description: 'pair challenge',
      timeoutMs: TIMEOUTS.pairKeyRetry,
      writePreference: 'without-response-first',
    },
    {
      description: 'pair challenge retry with-response',
      timeoutMs: TIMEOUTS.pairKeyFirstAttempt,
      writePreference: 'with-response-first',
    },
    {
      description: 'pair challenge official wake',
      timeoutMs: TIMEOUTS.pairKeyFirstAttempt,
      writePreference: 'without-response-first',
      challenge: OFFICIAL_PAIRED_F001_CHALLENGE,
    },
  ];
}

function postBondConfigWritePreference(): CharacteristicWritePreference {
  return isAndroidRuntime() ? 'without-response-first' : 'default';
}

function postConnectSettleDelayMs(): number {
  return isAndroidRuntime() ? ANDROID_POST_CONNECT_SETTLE_DELAY_MS : 0;
}

function authCccdSettleDelayMs(): number {
  return isAndroidRuntime() ? ANDROID_AUTH_CCCD_SETTLE_DELAY_MS : AUTH_CCCD_SETTLE_DELAY_MS;
}

function isAndroidRuntime(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return navigator.userAgent.toLowerCase().includes('android');
}

function markGattStageError(error: unknown, stage: string, isF001Cccd: boolean): void {
  if (error && typeof error === 'object') {
    const gattError = error as Partial<LinxGattError>;
    gattError.linxStage = stage;
    gattError.linxF001Cccd = Boolean(isF001Cccd);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.name && error.name !== 'Error' ? `${error.name}: ${error.message}` : error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  if (error && typeof error === 'object') {
    const record = error as { name?: unknown; message?: unknown; code?: unknown };
    const parts: string[] = [];
    if (record.name) parts.push(String(record.name));
    if (record.message) parts.push(String(record.message));
    if (record.code) parts.push(`code=${String(record.code)}`);
    if (parts.length > 0) return parts.join(': ');
    try {
      const json = JSON.stringify(error);
      if (json && json !== '{}') return json;
    } catch (_jsonError) {
      // Fall through to generic message.
    }
  }
  return 'неизвестная ошибка без сообщения';
}

function normalizeError(error: unknown, fallback: string): Error {
  const message = describeError(error);
  if (message === 'неизвестная ошибка без сообщения') {
    return new Error(fallback);
  }
  return new Error(`${fallback}: ${message}`);
}

function isAuthenticationError(error: unknown): boolean {
  const text = errorSearchText(error);
  return text.includes('auth') || text.includes('security') || text.includes('encrypt');
}

function isGattBusyError(error: unknown): boolean {
  const text = errorSearchText(error);
  return text.includes('already in progress') ||
    text.includes('operation in progress') ||
    text.includes('gatt operation') ||
    text.includes('busy');
}

function isGattDisconnectedError(error: unknown): boolean {
  const text = errorSearchText(error);
  return text.includes('gatt server is disconnected') ||
    text.includes('server is disconnected') ||
    text.includes('disconnected') ||
    text.includes('отключ') ||
    text.includes('networkerror');
}

function isUnknownCgmServiceError(error: unknown): boolean {
  const text = errorSearchText(error);
  const mentionsCgm = text.includes('cgm') ||
    text.includes('continuous glucose monitoring') ||
    text.includes('181f') ||
    text.includes('0x181f') ||
    text.includes(SERVICE_F000);
  return mentionsCgm && isUnknownBluetoothServiceError(error);
}

function isBluetoothChooserCancelled(error: unknown): boolean {
  const text = errorSearchText(error);
  return text.includes('user cancelled') ||
    text.includes('user canceled') ||
    text.includes('cancelled by user') ||
    text.includes('canceled by user');
}

function isUnknownBluetoothServiceError(error: unknown): boolean {
  const text = errorSearchText(error);
  return text.includes('unknown service') || text.includes('unknown service name');
}

function errorSearchText(error: unknown): string {
  if (typeof error === 'string') {
    return error.toLowerCase();
  }
  if (!error || typeof error !== 'object') {
    return '';
  }

  const record = error as { name?: unknown; message?: unknown };
  return `${String(record.name || '')} ${String(record.message || '')}`.toLowerCase();
}
