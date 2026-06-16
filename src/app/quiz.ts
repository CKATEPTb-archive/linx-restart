import step1 from '../assets/quiz/step-1.png';
import step2 from '../assets/quiz/step-2.png';
import step3 from '../assets/quiz/step-3.png';
import step4 from '../assets/quiz/step-4.png';
import step5 from '../assets/quiz/step-5.png';

export type PreparationStepId = 'disconnect-active' | 'forget-device';
export type QuizStepId = PreparationStepId | 'select-sensor' | 'sensor-info' | 'reset-complete';

export interface QuizScreenshot {
  src: string;
  alt: string;
  caption: string;
}

export interface PreparationStepContent {
  id: PreparationStepId;
  title: string;
  doneLabel: string;
  screenshots: QuizScreenshot[];
}

export interface CompletionStepContent {
  title: string;
  lead: string;
  screenshots: QuizScreenshot[];
}

export const QUIZ_STEPS: readonly QuizStepId[] = [
  'disconnect-active',
  'forget-device',
  'select-sensor',
  'sensor-info',
  'reset-complete',
];

export const QUIZ_PROGRESS_TOTAL = 4;

export const PREPARATION_STEPS: Record<PreparationStepId, PreparationStepContent> = {
  'disconnect-active': {
    id: 'disconnect-active',
    title: 'Разорвите активные сопряжения',
    doneLabel: 'Следующий шаг →',
    screenshots: [
      {
        src: step1,
        alt: 'Экран профиля приложения сенсора с выделенным пунктом Сопряжение',
        caption: 'Откройте «Сопряжение»',
      },
      {
        src: step2,
        alt: 'Экран сопряжения с подключенным устройством',
        caption: 'Выберите подключенный сенсор',
      },
      {
        src: step3,
        alt: 'Экран отключения сенсора с зеленой строкой и красной опасной кнопкой',
        caption: 'Нажмите зеленую строку',
      },
    ],
  },
  'forget-device': {
    id: 'forget-device',
    title: 'Разорвите пару в Bluetooth',
    doneLabel: 'Следующий шаг →',
    screenshots: [
      {
        src: step4,
        alt: 'Настройки Bluetooth на iPhone с выделенным устройством LinX и кнопкой информации',
        caption: 'Откройте информацию об устройстве',
      },
      {
        src: step5,
        alt: 'Экран устройства Bluetooth с пунктом Забыть это устройство',
        caption: 'Нажмите «Забыть это устройство»',
      },
    ],
  },
};

export const RESET_COMPLETE_STEP: CompletionStepContent = {
  title: 'Сенсор перезапущен!',
  lead: 'Разорвите пару с вашим устройством в настройках Bluetooth-соединений.',
  screenshots: [
    {
      src: step4,
      alt: 'Настройки Bluetooth на iPhone с выделенным устройством LinX и кнопкой информации',
      caption: 'Откройте информацию об устройстве',
    },
    {
      src: step5,
      alt: 'Экран устройства Bluetooth с пунктом Забыть это устройство',
      caption: 'Нажмите «Забыть это устройство»',
    },
  ],
};

export function quizStepNumber(step: QuizStepId): number {
  return Math.min(QUIZ_STEPS.indexOf(step) + 1, QUIZ_PROGRESS_TOTAL);
}
