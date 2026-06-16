import type { Accessor } from 'solid-js';
import type { LogSummary } from '../app/types';

interface LogPanelProps {
  logSummary: Accessor<LogSummary>;
  logText: Accessor<string>;
}

export function LogPanel(props: LogPanelProps) {
  return (
    <details class="group min-h-0 max-h-[28dvh] overflow-hidden rounded-2xl border border-white/[0.055] bg-app-panel/82 shadow-[0_10px_26px_rgba(0,0,0,0.16)]">
      <summary class={`grid min-h-9 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden px-3 py-2 text-xs font-extrabold leading-tight marker:hidden [&::-webkit-details-marker]:hidden ${summaryColor(props.logSummary().level)}`}>
        <span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{props.logSummary().text}</span>
        <span class="rounded-full bg-white/[0.055] px-2 py-0.5 text-[10px] text-app-muted group-open:hidden">+</span>
        <span class="hidden rounded-full bg-white/[0.055] px-2 py-0.5 text-[10px] text-app-muted group-open:inline">-</span>
      </summary>
      <pre
        id="logOutput"
        aria-live="polite"
        class="m-0 max-h-[calc(28dvh-36px)] overflow-auto border-t border-white/[0.045] bg-black/16 px-3 py-2 font-mono text-[10px] leading-[1.35] whitespace-pre-wrap text-app-log"
      >
        {props.logText()}
      </pre>
    </details>
  );
}

function summaryColor(level: LogSummary['level']): string {
  return level === 'error' ? 'text-app-danger' : 'text-app-muted';
}
