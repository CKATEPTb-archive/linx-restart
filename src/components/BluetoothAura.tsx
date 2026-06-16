interface BluetoothAuraProps {
  disabled: boolean;
  label: string;
  onClick: () => void | Promise<void>;
}

export function BluetoothAura(props: BluetoothAuraProps) {
  return (
    <div class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2 rounded-2xl border border-white/[0.045] bg-[linear-gradient(180deg,rgba(27,35,32,0.58),rgba(15,21,19,0.34))] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
      <button
        class="group relative grid min-h-0 appearance-none place-items-center overflow-hidden rounded-2xl border-0 bg-transparent p-0 text-app-accent outline-none transition-[transform,filter,opacity] duration-150 ease-out enabled:hover:scale-[1.01] enabled:hover:drop-shadow-[0_0_24px_rgba(88,216,196,0.18)] enabled:active:scale-[0.985] enabled:active:brightness-90 focus-visible:drop-shadow-[0_0_20px_rgba(88,216,196,0.36)] disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={props.disabled}
        onClick={props.onClick}
        aria-label="Подключить сенсор"
      >
        <span class="pointer-events-none absolute size-56 rounded-full bg-[radial-gradient(circle,rgba(88,216,196,0.2),rgba(88,216,196,0.06)_45%,rgba(88,216,196,0)_70%)] shadow-[0_0_70px_rgba(88,216,196,0.2)] motion-safe:animate-[aura-pulse_2.6s_ease-in-out_infinite] max-[340px]:size-44" />
        <span class="pointer-events-none absolute size-40 rounded-full bg-app-accent/14 blur-2xl motion-safe:animate-[aura-glow_2.6s_ease-in-out_infinite] max-[340px]:size-32" />
        <span class="pointer-events-none absolute size-28 rounded-full bg-[radial-gradient(circle,rgba(88,216,196,0.16),rgba(88,216,196,0.04)_54%,rgba(88,216,196,0)_72%)] shadow-[0_0_34px_rgba(88,216,196,0.24)] motion-safe:animate-[aura-pulse_2.6s_ease-in-out_infinite] max-[340px]:size-24" />
        <svg
          class="relative size-24 drop-shadow-[0_0_26px_rgba(88,216,196,0.62)] motion-safe:animate-[bluetooth-pulse_2.6s_ease-in-out_infinite] max-[340px]:size-20"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M7 7l10 10-5 5V2l5 5L7 17"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
          />
        </svg>
      </button>
      <span class="text-center text-[11px] font-bold leading-none text-app-dim/80">
        {props.label}
      </span>
    </div>
  );
}
