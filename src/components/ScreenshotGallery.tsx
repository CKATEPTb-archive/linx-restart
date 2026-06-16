import { Carousel } from '@fancyapps/ui/dist/carousel/carousel';
import '@fancyapps/ui/dist/carousel/carousel.css';
import { Fancybox } from '@fancyapps/ui/dist/fancybox';
import '@fancyapps/ui/dist/fancybox/fancybox.css';
import { For, createSignal, onCleanup, onMount } from 'solid-js';
import type { CarouselInstance } from '@fancyapps/ui/dist/carousel/carousel';
import type { QuizScreenshot } from '../app/quiz';

interface ScreenshotGalleryProps {
  screenshots: readonly QuizScreenshot[];
}

export function ScreenshotGallery(props: ScreenshotGalleryProps) {
  const [activeIndex, setActiveIndex] = createSignal(0);
  let galleryElement: HTMLDivElement | undefined;
  let carousel: CarouselInstance | undefined;

  function setActiveFromCarousel(api: CarouselInstance): void {
    const page = api.getPage();
    const nextIndex = page.slides[0]?.index ?? page.index;

    if (Number.isFinite(nextIndex)) {
      setActiveIndex(nextIndex);
    }
  }

  onMount(() => {
    carousel = Carousel(galleryElement ?? null, {
      center: false,
      infinite: props.screenshots.length > 1,
      on: {
        change: (api) => {
          setActiveFromCarousel(api);
        },
        ready: (api) => {
          setActiveFromCarousel(api);
        },
        settle: (api) => {
          setActiveFromCarousel(api);
        },
      },
      slidesPerPage: 1,
      transition: 'slide',
    }).init();

    Fancybox.bind(galleryElement ?? null, '[data-fancybox="quiz-screenshots"]', {
      Carousel: {
        Arrows: false,
        Thumbs: false,
        Toolbar: {
          display: {
            left: ['counter'],
            middle: [],
            right: ['close'],
          },
        },
      },
      closeButton: false,
      groupAttr: 'data-fancybox',
      theme: 'dark',
    });
  });

  onCleanup(() => {
    Fancybox.unbind(galleryElement ?? null, '[data-fancybox="quiz-screenshots"]');
    Fancybox.close();
    carousel?.destroy();
  });

  function slideTo(index: number): void {
    carousel?.goTo(index, { transition: 'tween' });
  }

  function handleCardClick(event: MouseEvent, index: number): void {
    if (index !== activeIndex()) {
      event.preventDefault();
      slideTo(index);
    }
  }

  return (
    <div
      class="quiz-carousel relative h-full min-h-[180px] overflow-hidden rounded-2xl border border-white/[0.055] bg-app-panel/70 p-2 pb-10 shadow-[0_16px_42px_rgba(0,0,0,0.2)] touch-pan-y"
      ref={galleryElement}
    >
      <For each={props.screenshots}>
        {(screenshot, index) => (
          <a
            class="f-carousel__slide quiz-carousel__slide outline-none"
            href={screenshot.src}
            data-fancybox="quiz-screenshots"
            aria-label="Открыть изображение"
            onClick={(event) => handleCardClick(event, index())}
          >
            <img
              class="quiz-screenshot-fit"
              src={screenshot.src}
              alt={screenshot.alt}
              draggable={false}
            />
          </a>
        )}
      </For>
      <div class="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2.5">
        <For each={props.screenshots}>
          {(_, index) => (
            <button
              class="size-3.5 rounded-full border border-app-accent/28 bg-app-accent/28 p-0 shadow-[0_0_10px_rgba(88,216,196,0.24)] outline-none transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out hover:bg-app-accent/70 hover:shadow-[0_0_14px_rgba(88,216,196,0.38)] active:scale-90 focus-visible:shadow-[0_0_0_3px_rgba(88,216,196,0.16)]"
              classList={{
                'scale-110 bg-app-accent opacity-100': index() === activeIndex(),
                'opacity-55': index() !== activeIndex(),
              }}
              type="button"
              aria-label={`Показать изображение ${index() + 1}`}
              aria-current={index() === activeIndex() ? 'true' : undefined}
              onClick={() => slideTo(index())}
            />
          )}
        </For>
      </div>
    </div>
  );
}
