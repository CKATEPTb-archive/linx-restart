type BluetoothServiceUUID = string | number;
type BluetoothCharacteristicUUID = string | number;

interface BluetoothLEScanFilter {
  name?: string;
  namePrefix?: string;
  services?: BluetoothServiceUUID[];
}

interface RequestDeviceOptions {
  filters?: BluetoothLEScanFilter[];
  optionalServices?: BluetoothServiceUUID[];
  acceptAllDevices?: boolean;
}

interface BluetoothLEScanOptions {
  filters?: BluetoothLEScanFilter[];
  keepRepeatedDevices?: boolean;
}

interface BluetoothLEScan {
  stop(): void;
}

interface BluetoothAdvertisingEvent extends Event {
  readonly device: BluetoothDevice;
  readonly name?: string;
  readonly uuids?: string[];
  readonly rssi?: number;
  readonly manufacturerData?: Map<number, DataView>;
}

interface Bluetooth extends EventTarget {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  requestLEScan?(options?: BluetoothLEScanOptions): Promise<BluetoothLEScan>;
  addEventListener(
    type: 'advertisementreceived',
    listener: (event: BluetoothAdvertisingEvent) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'advertisementreceived',
    listener: (event: BluetoothAdvertisingEvent) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface BluetoothDevice extends EventTarget {
  readonly id: string;
  readonly name?: string;
  readonly gatt?: BluetoothRemoteGATTServer;
  forget?(): Promise<void>;
  addEventListener(
    type: 'gattserverdisconnected',
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'gattserverdisconnected',
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface BluetoothRemoteGATTServer {
  readonly connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices?(): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService {
  readonly uuid: string;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly uuid: string;
  readonly value?: DataView;
  readValue(): Promise<DataView>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  writeValue?(value: BufferSource): Promise<void>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  addEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: Event & { target: BluetoothRemoteGATTCharacteristic }) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'characteristicvaluechanged',
    listener: (event: Event & { target: BluetoothRemoteGATTCharacteristic }) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface Navigator {
  readonly bluetooth?: Bluetooth;
}

declare module '*.css';
