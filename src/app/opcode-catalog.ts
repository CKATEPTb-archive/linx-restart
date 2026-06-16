import {
  OPCODES,
  bytesToHex,
  setNewSensorParams,
} from '../aidex-protocol';

export type OpcodeRisk = 'safe' | 'state' | 'destructive' | 'unknown';

export interface OpcodeCatalogItem {
  opcode: number;
  hex: string;
  name: string;
  description: string;
  risk: OpcodeRisk;
  known: boolean;
}

const OPCODE_DETAILS = new Map<number, Omit<OpcodeCatalogItem, 'opcode' | 'hex'>>([
  [OPCODES.GET_STARTUP_DEVICE_INFO, {
    name: 'GET_STARTUP_DEVICE_INFO / POST_BOND_CONFIG',
    description: 'Информация устройства; в F001 этот же opcode используется как post-bond config',
    risk: 'safe',
    known: true,
  }],
  [OPCODES.GET_BROADCAST_DATA, {
    name: 'GET_BROADCAST_DATA',
    description: 'Запрос broadcast payload',
    risk: 'safe',
    known: true,
  }],
  [OPCODES.SET_NEW_SENSOR, {
    name: 'SET_NEW_SENSOR',
    description: 'Активация нового запуска с текущей датой',
    risk: 'state',
    known: true,
  }],
  [OPCODES.GET_LOCAL_START_TIME, {
    name: 'GET_LOCAL_START_TIME',
    description: 'Чтение времени старта',
    risk: 'safe',
    known: true,
  }],
  [OPCODES.SET_AUTO_UPDATE_STATUS, {
    name: 'SET_AUTO_UPDATE_STATUS',
    description: 'Включение auto update, параметр 01',
    risk: 'state',
    known: true,
  }],
  [OPCODES.SET_DYNAMIC_ADV_MODE, {
    name: 'SET_DYNAMIC_ADV_MODE',
    description: 'Переключение dynamic advertising, параметр 01',
    risk: 'state',
    known: true,
  }],
  [0xca, {
    name: 'OFFICIAL_BOOTSTRAP_CA',
    description: 'Кандидат из official bootstrap sequence',
    risk: 'unknown',
    known: true,
  }],
  [0x96, {
    name: 'OFFICIAL_BOOTSTRAP_96',
    description: 'Кандидат из official bootstrap sequence',
    risk: 'unknown',
    known: true,
  }],
  [0x97, {
    name: 'OFFICIAL_BOOTSTRAP_97',
    description: 'Кандидат из official bootstrap sequence',
    risk: 'unknown',
    known: true,
  }],
  [0xb2, {
    name: 'OFFICIAL_BOOTSTRAP_B2',
    description: 'Кандидат из official bootstrap sequence',
    risk: 'unknown',
    known: true,
  }],
  [0xfb, {
    name: 'OFFICIAL_BOOTSTRAP_FB',
    description: 'Кандидат из official bootstrap sequence',
    risk: 'unknown',
    known: true,
  }],
  [0xf2, {
    name: 'RESET_CANDIDATE_F2',
    description: 'Неизвестный reset-кандидат из ранних тестов',
    risk: 'unknown',
    known: true,
  }],
  [OPCODES.RESET, {
    name: 'RESET',
    description: 'Сброс сенсора',
    risk: 'destructive',
    known: true,
  }],
  [OPCODES.CLEAR_STORAGE, {
    name: 'CLEAR_STORAGE',
    description: 'Очистка памяти сенсора',
    risk: 'destructive',
    known: true,
  }],
]);

export const OPCODE_CATALOG: readonly OpcodeCatalogItem[] = Array.from({ length: 256 }, (_, opcode) => {
  const detail = OPCODE_DETAILS.get(opcode) || {
    name: 'UNKNOWN',
    description: 'Неизвестный opcode',
    risk: 'unknown' as const,
    known: false,
  };
  return {
    opcode,
    hex: opcodeHex(opcode),
    ...detail,
  };
});

export function opcodeHex(opcode: number): string {
  return `0x${(opcode & 0xff).toString(16).padStart(2, '0').toUpperCase()}`;
}

export function defaultParamsHex(opcode: number): string {
  switch (opcode & 0xff) {
    case OPCODES.SET_NEW_SENSOR:
      return bytesToHex(setNewSensorParams());
    case OPCODES.SET_AUTO_UPDATE_STATUS:
    case OPCODES.SET_DYNAMIC_ADV_MODE:
      return '01';
    case 0xca:
      return '82 76';
    case 0x96:
      return '9B EA DB';
    case 0x97:
      return '9B DB E8';
    case 0xb2:
      return '7A 47';
    case 0xfb:
      return 'F0 50';
    default:
      return '';
  }
}
