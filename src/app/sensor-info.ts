import { AIDEX_OFFICIAL_LIFETIME_DAYS } from '../aidex-protocol';
import type { SensorInfo } from '../ble-client';
import { DAY_MS, MINUTE_MS } from './constants';
import type { SensorRow } from './types';

export function emptySensorInfo(): SensorInfo {
  return {
    name: '',
    serial: '',
    modelName: '',
    firmwareVersion: '',
    hardwareVersion: '',
    wearDays: AIDEX_OFFICIAL_LIFETIME_DAYS,
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

export function sensorRows(info: SensorInfo, nowMs: number): SensorRow[] {
  const startMs = finiteNumber(info.startTimeMs);
  const ageMinutes = finiteNumber(info.ageMinutes);
  const batteryMillivolts = finiteNumber(info.batteryMillivolts);
  const expiryMs = startMs !== null ? startMs + AIDEX_OFFICIAL_LIFETIME_DAYS * DAY_MS : null;
  const ageMs = startMs !== null
    ? Math.max(0, nowMs - startMs)
    : (ageMinutes !== null ? ageMinutes * MINUTE_MS : null);
  const remainingMs = expiryMs !== null ? expiryMs - nowMs : null;
  const remaining = remainingMs !== null
    ? (remainingMs >= 0 ? formatDuration(remainingMs) : `истек ${formatDuration(remainingMs)} назад`)
    : 'ожидаем данные';

  return [
    {
      label: 'Запущен',
      value: info.notStarted ? 'не запущен' : formatDateTime(startMs, info.startTimeEstimated),
    },
    {
      label: 'Окончание',
      value: info.notStarted ? 'нет запуска' : formatDateTime(expiryMs, info.startTimeEstimated),
    },
    {
      label: 'Осталось',
      value: info.notStarted ? 'нет запуска' : remaining,
    },
    {
      label: 'Возраст',
      value: info.notStarted ? 'нет запуска' : formatDuration(ageMs),
    },
    {
      label: 'Батарея',
      value: batteryMillivolts !== null ? `${(batteryMillivolts / 1000).toFixed(3)} V` : 'ожидаем данные',
    },
    {
      label: 'Модель',
      value: info.modelName || 'определяется',
    },
    {
      label: 'Прошивка',
      value: info.firmwareVersion || 'определяется',
    },
  ];
}

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatDateTime(ms: number | null, estimated = false): string {
  if (ms === null) return 'ожидаем данные';
  const value = new Date(ms).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return estimated ? `${value} (по F003)` : value;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return 'ожидаем данные';

  const absMs = Math.abs(ms);
  const days = Math.floor(absMs / DAY_MS);
  const hours = Math.floor((absMs % DAY_MS) / (60 * MINUTE_MS));
  const minutes = Math.floor((absMs % (60 * MINUTE_MS)) / MINUTE_MS);
  const parts: string[] = [];

  if (days > 0) parts.push(`${days} д`);
  if (hours > 0 || days > 0) parts.push(`${hours} ч`);
  parts.push(`${minutes} мин`);
  return parts.join(' ');
}
