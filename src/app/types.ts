import type { Accessor } from 'solid-js';
import type { LogLevel, SensorInfo } from '../ble-client';
import type { PlatformInfo, SupportDetails } from '../platform-support';

export type ConnectionMode = 'idle' | 'busy' | 'ready' | 'error';

export interface ConnectionState {
  label: string;
  mode: ConnectionMode;
}

export interface LogSummary {
  text: string;
  level: LogLevel;
}

export interface SensorRow {
  label: string;
  value: string;
}

export interface SelectedEventDetail {
  device: BluetoothDevice;
  serial?: string;
}

export interface PhaseEventDetail {
  phase: string;
}

export interface LogEventDetail {
  message: string;
  level: LogLevel;
  time: Date;
}

export interface SensorInfoEventDetail {
  info: Partial<SensorInfo>;
}

export interface LinxResetViewModel {
  authenticated: Accessor<boolean>;
  chooseAndConnect: () => Promise<void>;
  chooseDisabled: Accessor<boolean>;
  confirmAndReset: () => Promise<boolean>;
  connection: Accessor<ConnectionState>;
  logSummary: Accessor<LogSummary>;
  logText: Accessor<string>;
  platform: Accessor<PlatformInfo>;
  resetDisabled: Accessor<boolean>;
  resetSent: Accessor<boolean>;
  selectedLabel: Accessor<string>;
  sensorRows: Accessor<SensorRow[]>;
  support: Accessor<SupportDetails>;
  supportIssue: Accessor<boolean>;
}
