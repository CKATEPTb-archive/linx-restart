import type { Accessor } from 'solid-js';
import type { ConnectionMode, ConnectionState } from '../app/types';

interface StatusPillProps {
  connection: Accessor<ConnectionState>;
}

const dotClass: Record<ConnectionMode, string> = {
  idle: 'bg-app-idle',
  busy: 'bg-app-warning shadow-[0_0_0_4px_rgba(216,184,108,0.13)]',
  ready: 'bg-app-accent shadow-[0_0_0_4px_rgba(88,216,196,0.13)]',
  error: 'bg-app-danger shadow-[0_0_0_4px_rgba(243,111,111,0.13)]',
};

export function StatusPill(props: StatusPillProps) {
  return (
    <div class="inline-flex min-h-5 max-w-[112px] items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full bg-black/18 px-2 py-0.5 text-[10px] font-extrabold leading-none text-app-muted ring-1 ring-white/[0.045] max-[340px]:max-w-[92px]">
      <span class={`size-[6px] shrink-0 rounded-full ${dotClass[props.connection().mode]}`} />
      <span class="min-w-0 overflow-hidden text-ellipsis">{props.connection().label}</span>
    </div>
  );
}
