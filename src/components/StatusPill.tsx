import type { Accessor } from 'solid-js';
import type { ConnectionMode, ConnectionState } from '../app/types';

interface StatusPillProps {
  connection: Accessor<ConnectionState>;
  logOpen: Accessor<boolean>;
  onClick: () => void;
}

const dotClass: Record<ConnectionMode, string> = {
  idle: 'bg-app-idle',
  busy: 'bg-app-warning shadow-[0_0_0_4px_rgba(216,184,108,0.13)]',
  ready: 'bg-app-accent shadow-[0_0_0_4px_rgba(88,216,196,0.13)]',
  error: 'bg-app-danger shadow-[0_0_0_4px_rgba(243,111,111,0.13)]',
};

export function StatusPill(props: StatusPillProps) {
  return (
    <button
      type="button"
      aria-label="Показать журнал"
      aria-pressed={props.logOpen()}
      onClick={props.onClick}
      class="inline-flex min-h-5 max-w-[112px] items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full bg-black/18 px-2 py-0.5 text-[10px] font-extrabold leading-none text-app-muted ring-1 ring-white/[0.045] transition-[background,transform,color,box-shadow] duration-150 hover:bg-white/[0.075] hover:text-app-ink active:scale-[0.97] active:bg-white/[0.11] aria-pressed:bg-app-accent/12 aria-pressed:text-app-accent aria-pressed:ring-app-accent/24 max-[340px]:max-w-[92px]"
    >
      <span class={`size-[6px] shrink-0 rounded-full ${dotClass[props.connection().mode]}`} />
      <span class="min-w-0 overflow-hidden text-ellipsis">{props.connection().label}</span>
    </button>
  );
}
