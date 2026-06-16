import { For, Show, createMemo, createSignal } from 'solid-js';
import type { OpcodeCommandResult } from '../ble-client';
import {
  OPCODE_CATALOG,
  defaultParamsHex,
} from '../app/opcode-catalog';
import type { OpcodeCatalogItem, OpcodeRisk } from '../app/opcode-catalog';
import type { LinxResetViewModel } from '../app/types';
import { ActionButton } from './ActionButton';
import { BluetoothAura } from './BluetoothAura';
import { QuizStepShell } from './QuizStepShell';
import { SensorSummary } from './SensorSummary';
import { SupportMessage } from './SupportMessage';

type ResetProbeScreenProps = Pick<
  LinxResetViewModel,
  | 'authenticated'
  | 'chooseAndConnect'
  | 'chooseDisabled'
  | 'logText'
  | 'opcodeCommandResults'
  | 'opcodeSendDisabled'
  | 'sendOpcodeCommand'
  | 'selectedLabel'
  | 'support'
  | 'supportIssue'
>;

const captionClass = 'px-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-app-dim';
const controlBaseClass = 'min-h-10 min-w-0 rounded-xl border border-white/[0.06] bg-app-field outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-white/[0.12] focus:border-app-accent/42 focus:shadow-[0_0_0_3px_rgba(88,216,196,0.12)] active:bg-black/20';
const selectClass = `${controlBaseClass} px-3 text-[12px] font-black text-app-ink`;
const selectCompactClass = `${controlBaseClass} px-2 text-[12px] font-black text-app-ink`;
const inputClass = `${controlBaseClass} px-3 font-mono text-[12px] font-bold text-app-ink placeholder:text-app-dim`;
const knownOpcodeBaseClass = 'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black leading-none transition-[background-color,border-color,color,transform,filter] duration-150 hover:-translate-y-px active:translate-y-px active:scale-[0.98]';

export function ResetProbeScreen(props: ResetProbeScreenProps) {
  const [selectedOpcode, setSelectedOpcode] = createSignal(0xf3);
  const [paramsHex, setParamsHex] = createSignal(defaultParamsHex(0xf3));
  const [timeoutMs, setTimeoutMs] = createSignal(18_000);
  const selectedItem = createMemo(() => OPCODE_CATALOG[selectedOpcode()]);
  const knownItems = createMemo(() => OPCODE_CATALOG.filter((item) => item.known));
  const parsedParams = createMemo(() => parseHexBytes(paramsHex()));
  const sendDisabled = createMemo(() => props.opcodeSendDisabled() || Boolean(parsedParams().error));
  const connectLabel = createMemo(() => {
    if (props.supportIssue()) return 'Bluetooth недоступен';
    return props.chooseDisabled() ? 'Подключение...' : 'Нажмите чтобы выбрать';
  });

  function selectOpcode(opcode: number): void {
    const normalizedOpcode = opcode & 0xff;
    setSelectedOpcode(normalizedOpcode);
    setParamsHex(defaultParamsHex(normalizedOpcode));
  }

  async function sendSelectedOpcode(): Promise<void> {
    const item = selectedItem();
    const parsed = parsedParams();
    if (parsed.error) {
      return;
    }

    if (requiresConfirmation(item.risk) && !window.confirm(confirmText(item))) {
      return;
    }

    await props.sendOpcodeCommand(item.opcode, parsed.bytes, timeoutMs());
  }

  return (
    <QuizStepShell title="Opcode lab" lead="Ручная отправка encrypted F002-команд">
      <Show
        when={props.authenticated()}
        fallback={(
          <div class="grid h-full min-h-0 grid-rows-[minmax(0,0.72fr)_minmax(0,1fr)_auto] gap-2.5">
            <BluetoothAura
              disabled={props.chooseDisabled()}
              label={connectLabel()}
              onClick={props.chooseAndConnect}
            />
            <LiveLog text={props.logText()} />
            <Show when={props.supportIssue()}>
              <div class="rounded-2xl border border-app-danger/35 bg-app-danger/10 px-3 py-2 text-center shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
                <SupportMessage support={props.support} />
              </div>
            </Show>
          </div>
        )}
      >
        <div class="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2.5">
          <SensorSummary selectedLabel={props.selectedLabel} />

          <section class="grid gap-2 rounded-2xl border border-white/[0.055] bg-app-panel/80 p-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
            <OpcodePicker
              items={OPCODE_CATALOG}
              selectedOpcode={selectedOpcode}
              onSelect={selectOpcode}
            />

            <KnownOpcodeStrip
              items={knownItems()}
              selectedOpcode={selectedOpcode()}
              onSelect={selectOpcode}
            />

            <div class="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
              <label class="grid min-w-0 gap-1">
                <span class={captionClass}>Payload hex</span>
                <input
                  class={inputClass}
                  value={paramsHex()}
                  inputmode="text"
                  spellcheck={false}
                  placeholder="00 01"
                  onInput={(event) => setParamsHex(event.currentTarget.value)}
                />
              </label>
              <label class="grid min-w-0 gap-1">
                <span class={captionClass}>Timeout</span>
                <select
                  class={selectCompactClass}
                  value={timeoutMs()}
                  onChange={(event) => setTimeoutMs(Number.parseInt(event.currentTarget.value, 10))}
                >
                  <option value={5000}>5s</option>
                  <option value={12000}>12s</option>
                  <option value={18000}>18s</option>
                  <option value={30000}>30s</option>
                </select>
              </label>
            </div>

            <div class="grid grid-cols-[minmax(0,1fr)_128px] items-center gap-2">
              <OpcodeMeta item={selectedItem()} error={parsedParams().error} />
              <ActionButton
                disabled={sendDisabled()}
                intent={selectedItem().risk === 'destructive' ? 'reset' : 'primary'}
                onClick={sendSelectedOpcode}
                wide
              >
                ОТПРАВИТЬ
              </ActionButton>
            </div>
          </section>

          <section class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <ResultStrip results={props.opcodeCommandResults()} />
            <LiveLog text={props.logText()} />
          </section>
        </div>
      </Show>
    </QuizStepShell>
  );
}

function OpcodePicker(props: {
  items: readonly OpcodeCatalogItem[];
  selectedOpcode: () => number;
  onSelect: (opcode: number) => void;
}) {
  return (
    <label class="grid min-w-0 gap-1">
      <span class={captionClass}>Opcode</span>
      <select
        class={selectClass}
        value={props.selectedOpcode()}
        onChange={(event) => props.onSelect(Number.parseInt(event.currentTarget.value, 10))}
      >
        <For each={props.items}>
          {(item) => (
            <option value={item.opcode}>
              {item.hex} {item.name}
            </option>
          )}
        </For>
      </select>
    </label>
  );
}

function KnownOpcodeStrip(props: {
  items: OpcodeCatalogItem[];
  selectedOpcode: number;
  onSelect: (opcode: number) => void;
}) {
  return (
    <div class="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5">
      <For each={props.items}>
        {(item) => (
          <button
            class={knownOpcodeClass(props.selectedOpcode === item.opcode)}
            type="button"
            onClick={() => props.onSelect(item.opcode)}
          >
            {item.hex}
          </button>
        )}
      </For>
    </div>
  );
}

function OpcodeMeta(props: { item: OpcodeCatalogItem; error: string }) {
  return (
    <div class="grid min-w-0 gap-1">
      <div class="flex min-w-0 items-center gap-1.5">
        <span class={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${riskClass(props.item.risk)}`}>
          {riskLabel(props.item.risk)}
        </span>
        <strong class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] leading-none text-app-ink">
          {props.item.name}
        </strong>
      </div>
      <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-semibold text-app-muted">
        <Show when={props.error} fallback={props.item.description}>
          {(error) => error()}
        </Show>
      </span>
    </div>
  );
}

function ResultStrip(props: { results: OpcodeCommandResult[] }) {
  return (
    <div class="min-h-0 overflow-hidden rounded-2xl border border-white/[0.055] bg-app-panel/70">
      <Show
        when={props.results.length > 0}
        fallback={<div class="px-3 py-3 text-center text-[12px] font-semibold text-app-muted">Результаты команд появятся здесь</div>}
      >
        <div class="flex h-full min-h-0 gap-1.5 overflow-x-auto p-2">
          <For each={props.results}>
            {(result) => (
              <div class="grid min-w-[168px] max-w-[210px] shrink-0 gap-1 rounded-xl bg-white/[0.045] px-2.5 py-2">
                <div class="flex items-center justify-between gap-2">
                  <strong class="text-[13px] leading-none text-app-ink">{result.opcodeHex}</strong>
                  <span class={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${resultStatusClass(result.status)}`}>
                    {result.status}
                  </span>
                </div>
                <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold text-app-muted">
                  {result.detail}
                </span>
                <span class="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] font-bold text-app-dim">
                  {result.plainHex || 'no plain packet'}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

function LiveLog(props: { text: string }) {
  return (
    <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/[0.055] bg-black/28">
      <div class="flex items-center justify-between border-b border-white/[0.045] px-3 py-2">
        <span class="text-[10px] font-black uppercase tracking-[0.14em] text-app-dim">Live log</span>
        <span class="text-[10px] font-bold text-app-dim">TX / RX</span>
      </div>
      <pre class="m-0 min-h-0 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-[10px] font-semibold leading-snug text-app-log">
        {props.text || 'Журнал пуст'}
      </pre>
    </div>
  );
}

function parseHexBytes(value: string): { bytes: number[]; error: string } {
  const compact = value
    .replace(/0x/gi, '')
    .replace(/[^0-9a-f]/gi, '');

  if (!compact) {
    return { bytes: [], error: '' };
  }

  if (compact.length % 2 !== 0) {
    return { bytes: [], error: 'Нечетное количество hex-символов' };
  }

  const bytes: number[] = [];
  for (let index = 0; index < compact.length; index += 2) {
    bytes.push(Number.parseInt(compact.slice(index, index + 2), 16));
  }

  return { bytes, error: '' };
}

function requiresConfirmation(risk: OpcodeRisk): boolean {
  return risk !== 'safe';
}

function knownOpcodeClass(active: boolean): string {
  const stateClass = active
    ? 'border-app-accent/42 bg-app-accent/18 text-app-accent'
    : 'border-white/[0.055] bg-white/[0.045] text-app-muted hover:border-white/[0.12] hover:text-app-soft';

  return `${knownOpcodeBaseClass} ${stateClass}`;
}

function confirmText(item: OpcodeCatalogItem): string {
  return [
    `Отправить ${item.hex} ${item.name}?`,
    `Риск: ${riskLabel(item.risk)}`,
    'Команда может изменить состояние сенсора.',
  ].join('\n');
}

function riskClass(risk: OpcodeRisk): string {
  switch (risk) {
    case 'safe':
      return 'bg-app-accent/14 text-app-accent';
    case 'state':
      return 'bg-app-warning/14 text-app-warning';
    case 'destructive':
      return 'bg-app-danger/14 text-app-danger';
    default:
      return 'bg-white/10 text-app-muted';
  }
}

function riskLabel(risk: OpcodeRisk): string {
  switch (risk) {
    case 'safe':
      return 'safe';
    case 'state':
      return 'state';
    case 'destructive':
      return 'danger';
    default:
      return 'unknown';
  }
}

function resultStatusClass(status: OpcodeCommandResult['status']): string {
  switch (status) {
    case 'ok':
      return 'bg-app-accent/14 text-app-accent';
    case 'warn':
      return 'bg-app-warning/14 text-app-warning';
    case 'error':
      return 'bg-app-danger/14 text-app-danger';
    default:
      return 'bg-white/10 text-app-muted';
  }
}
