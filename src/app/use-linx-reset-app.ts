import { createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import {
  LinxBleClient,
  bluetoothCapabilities,
  deviceRecordFromBluetoothDevice,
} from '../ble-client';
import type { DeviceRecord, LogLevel } from '../ble-client';
import {
  extractSerialFromName,
  normalizeSerial,
} from '../aidex-protocol';
import {
  detectPlatform,
  supportDetails,
} from '../platform-support';
import { RESET_WARNING } from './constants';
import { emptySensorInfo, sensorRows as buildSensorRows } from './sensor-info';
import type {
  ConnectionMode,
  ConnectionState,
  LinxResetViewModel,
  LogEventDetail,
  LogSummary,
  PhaseEventDetail,
  SelectedEventDetail,
  SensorInfoEventDetail,
} from './types';

export function useLinxResetApp(): LinxResetViewModel {
  const client = new LinxBleClient();
  const [capabilities, setCapabilities] = createSignal(bluetoothCapabilities());
  const [platform] = createSignal(detectPlatform());
  const [selectedDevice, setSelectedDevice] = createSignal<DeviceRecord | null>(null);
  const [sensorInfo, setSensorInfo] = createSignal(emptySensorInfo());
  const [serial, setSerial] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [authenticated, setAuthenticated] = createSignal(false);
  const [resetSent, setResetSent] = createSignal(false);
  const [connection, setConnection] = createSignal<ConnectionState>({ label: 'Ожидание', mode: 'idle' });
  const [logText, setLogText] = createSignal('');
  const [logSummary, setLogSummary] = createSignal<LogSummary>({ text: 'Показать журнал', level: 'info' });
  const [now, setNow] = createSignal(Date.now());

  const normalizedSerial = createMemo(() => normalizeSerial(serial()));
  const support = createMemo(() => supportDetails(capabilities(), platform()));
  const supportIssue = createMemo(() => !capabilities().bluetooth || !capabilities().secureContext);
  const selectedLabel = createMemo(() => selectedDevice()?.name || 'Не выбран');
  const chooseDisabled = createMemo(() => busy() || !capabilities().bluetooth || !capabilities().secureContext);
  const resetDisabled = createMemo(() => (
    busy() ||
    resetSent() ||
    !authenticated() ||
    normalizedSerial().length < 8
  ));
  const sensorRows = createMemo(() => buildSensorRows(sensorInfo(), now()));

  function writeLog(message: string, level: LogLevel = 'info', time = new Date()): void {
    if (!isExchangeLog(message)) {
      return;
    }

    const timestamp = time.toLocaleTimeString('ru-RU', { hour12: false });
    const line = `[${timestamp}] ${message}`;
    setLogText((current) => `${line}\n${current}`.slice(0, 12_000));
    setLogSummary({
      text: level === 'error' ? `Показать журнал: ${message}` : 'Показать журнал',
      level,
    });
  }

  function setConnectionState(label: string, mode: ConnectionMode = 'idle'): void {
    setConnection({ label, mode });
  }

  function setBusyState(value: boolean, label = 'Подождите'): void {
    setBusy(value);
    if (value) {
      setConnectionState(label, 'busy');
    }
  }

  function rememberDevice(device: BluetoothDevice): string {
    const record = deviceRecordFromBluetoothDevice(device);
    setSelectedDevice(record);
    setResetSent(false);
    setSensorInfo({
      ...emptySensorInfo(),
      name: record.name,
      serial: record.serial,
      modelName: record.modelName,
    });

    const nextSerial = record.serial || extractSerialFromName(device?.name || '');
    if (nextSerial) {
      setSerial(nextSerial);
    }

    return nextSerial;
  }

  async function chooseAndConnect(): Promise<void> {
    try {
      setAuthenticated(false);
      setBusyState(true, 'Выбор');
      const device = await client.chooseDevice();
      const selectedSerial = rememberDevice(device);

      setBusyState(true, 'Подключение');
      await client.connect(selectedSerial);
      setAuthenticated(true);
      setConnectionState('Готово', 'ready');
    } catch {
      setAuthenticated(client.authenticated);
      setConnectionState('Ошибка', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndReset(): Promise<boolean> {
    if (!window.confirm(RESET_WARNING)) {
      return false;
    }

    try {
      setBusyState(true, 'RESET');
      const result = await client.resetSensor();
      setResetSent(true);
      setConnectionState(result.confirmed ? 'RESET ok' : 'RESET sent', 'ready');
      return true;
    } catch {
      setConnectionState('Ошибка', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const selectedHandler = (event: Event) => {
    const detail = (event as CustomEvent<SelectedEventDetail>).detail;
    const nextSerial = detail.serial || extractSerialFromName(detail.device?.name || '');
    if (nextSerial) {
      setSerial(nextSerial);
    }
  };
  const phaseHandler = (event: Event) => {
    const labels: Record<string, string> = {
      device: 'Выбрано',
      gatt: 'GATT',
      key: 'Ключ',
      reset: 'RESET',
    };
    const { phase } = (event as CustomEvent<PhaseEventDetail>).detail;
    setConnectionState(labels[phase] || 'Подключение', 'busy');
  };
  const logHandler = (event: Event) => {
    const detail = (event as CustomEvent<LogEventDetail>).detail;
    writeLog(detail.message, detail.level, detail.time);
  };
  const sensorInfoHandler = (event: Event) => {
    const { info } = (event as CustomEvent<SensorInfoEventDetail>).detail;
    setSensorInfo((current) => ({
      ...current,
      ...info,
      serial: info.serial || current.serial,
      modelName: info.modelName || current.modelName,
    }));
  };
  const disconnectedHandler = () => {
    setAuthenticated(false);
    if (!busy()) {
      setConnectionState(selectedDevice() ? 'Отключено' : 'Ожидание', 'idle');
    }
  };

  client.addEventListener('selected', selectedHandler);
  client.addEventListener('phase', phaseHandler);
  client.addEventListener('log', logHandler);
  client.addEventListener('sensorinfo', sensorInfoHandler);
  client.addEventListener('disconnected', disconnectedHandler);

  onMount(() => {
    const nextCapabilities = bluetoothCapabilities();
    setCapabilities(nextCapabilities);
  });

  const clock = window.setInterval(() => setNow(Date.now()), 30_000);

  onCleanup(() => {
    client.removeEventListener('selected', selectedHandler);
    client.removeEventListener('phase', phaseHandler);
    client.removeEventListener('log', logHandler);
    client.removeEventListener('sensorinfo', sensorInfoHandler);
    client.removeEventListener('disconnected', disconnectedHandler);
    window.clearInterval(clock);
  });

  return {
    authenticated,
    chooseAndConnect,
    chooseDisabled,
    confirmAndReset,
    connection,
    logSummary,
    logText,
    platform,
    resetDisabled,
    resetSent,
    selectedLabel,
    sensorRows,
    support,
    supportIssue,
  };
}

function isExchangeLog(message: string): boolean {
  return /^(TX|RX)\s/.test(message);
}
