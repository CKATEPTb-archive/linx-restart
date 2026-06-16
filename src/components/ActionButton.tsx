import type { JSX } from 'solid-js';

interface ActionButtonProps {
  children: JSX.Element;
  disabled: boolean;
  intent: 'primary' | 'reset';
  onClick: () => void | Promise<void>;
  wide?: boolean;
}

const baseClass = 'inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border-0 px-3 text-center text-sm font-black leading-none tracking-normal outline-none transition-[background-color,box-shadow,transform,filter] duration-150 ease-out enabled:hover:-translate-y-px enabled:active:translate-y-px enabled:active:scale-[0.985] focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.16)] disabled:cursor-not-allowed disabled:opacity-40 max-[340px]:text-[11px] max-[700px]:min-h-10';

const intentClass = {
  primary: 'bg-[linear-gradient(135deg,var(--color-app-accent),#83dfcb)] text-app-accent-ink shadow-[0_10px_24px_rgba(88,216,196,0.16)] enabled:hover:brightness-110 enabled:hover:shadow-[0_14px_30px_rgba(88,216,196,0.2)] enabled:active:brightness-95 enabled:active:shadow-[0_5px_14px_rgba(88,216,196,0.14)]',
  reset: 'bg-[linear-gradient(135deg,#f36f6f,#ff8a74)] text-app-danger-ink shadow-[0_10px_24px_rgba(243,111,111,0.16)] enabled:hover:brightness-110 enabled:hover:shadow-[0_14px_30px_rgba(243,111,111,0.2)] enabled:active:brightness-95 enabled:active:shadow-[0_5px_14px_rgba(243,111,111,0.14)]',
};

export function ActionButton(props: ActionButtonProps) {
  return (
    <button
      class={`${baseClass} ${intentClass[props.intent]}`}
      classList={{ 'w-full': props.wide }}
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
