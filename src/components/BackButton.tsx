interface BackButtonProps {
  class?: string;
  onClick: () => void;
}

export function BackButton(props: BackButtonProps) {
  return (
    <button
      class={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-app-elevated text-xl font-black leading-none text-app-soft outline-none ring-1 ring-white/[0.06] transition-[background-color,color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:bg-white/[0.11] hover:text-app-ink active:translate-y-px active:scale-[0.96] active:bg-white/[0.14] focus-visible:shadow-[0_0_0_3px_rgba(255,255,255,0.12)] max-[700px]:min-h-10 max-[700px]:min-w-10 ${props.class ?? ''}`}
      type="button"
      aria-label="Назад"
      onClick={props.onClick}
    >
      <span aria-hidden="true">←</span>
    </button>
  );
}
