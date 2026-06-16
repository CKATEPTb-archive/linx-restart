import type { PreparationStepContent } from '../app/quiz';
import { ActionButton } from './ActionButton';
import { BackButton } from './BackButton';
import { QuizStepShell } from './QuizStepShell';
import { ScreenshotGallery } from './ScreenshotGallery';

interface PreparationStepProps {
  canGoBack: boolean;
  content: PreparationStepContent;
  onDone: (id: PreparationStepContent['id']) => void;
  onBack: () => void;
}

export function PreparationStep(props: PreparationStepProps) {
  return (
    <QuizStepShell title={props.content.title}>
      <div class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2.5">
        <ScreenshotGallery screenshots={props.content.screenshots} />

        <div
          class="grid gap-2"
          classList={{ 'grid-cols-[auto_minmax(0,1fr)]': props.canGoBack }}
        >
          {props.canGoBack && <BackButton onClick={props.onBack} />}
          <ActionButton
            disabled={false}
            intent="primary"
            onClick={() => props.onDone(props.content.id)}
            wide
          >
            {props.content.doneLabel}
          </ActionButton>
        </div>
      </div>
    </QuizStepShell>
  );
}
