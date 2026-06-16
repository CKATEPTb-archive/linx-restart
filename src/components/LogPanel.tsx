import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { LogSummary } from '../app/types';

interface LogPanelProps {
  logSummary: Accessor<LogSummary>;
  logText: Accessor<string>;
  open: Accessor<boolean>;
  onClose: () => void;
}

export function LogPanel(props: LogPanelProps) {
  return (
    <Show when={props.open()}>
      <section class="pointer-events-auto min-h-0 max-h-[42dvh] overflow-hidden rounded-2xl border border-white/[0.075] bg-app-panel/95 shadow-[0_20px_52px_rgba(0,0,0,0.46)] backdrop-blur-md">
        <button
          type="button"
          onClick={props.onClose}
          class={`grid min-h-9 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden px-3 py-2 text-left text-xs font-extrabold leading-tight transition-[background,transform,color] duration-150 hover:bg-white/[0.055] active:scale-[0.995] active:bg-white/[0.085] ${summaryColor(props.logSummary().level)}`}
        >
          <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{panelTitle(props.logSummary())}</span>
          <span class="grid size-6 place-items-center rounded-full bg-white/[0.065] text-[13px] leading-none text-app-muted">x</span>
        </button>
        <pre
          id="logOutput"
          aria-live="polite"
          class="m-0 max-h-[calc(42dvh-36px)] overflow-auto border-t border-white/[0.045] bg-black/18 px-3 py-2 font-mono text-[10px] leading-[1.35] whitespace-pre-wrap text-app-log"
        >
          {props.logText() || 'Журнал пуст'}
        </pre>
      </section>
    </Show>
  );
}

function summaryColor(level: LogSummary['level']): string {
  return level === 'error' ? 'text-app-danger' : 'text-app-muted';
}

function panelTitle(summary: LogSummary): string {
  return summary.text.replace(/^Показать журнал:?\s*/i, '') || 'Журнал';
}
