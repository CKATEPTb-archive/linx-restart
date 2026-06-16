import type { CompletionStepContent } from '../app/quiz';
import { QuizStepShell } from './QuizStepShell';
import { ScreenshotGallery } from './ScreenshotGallery';

interface ResetCompleteStepProps {
  content: CompletionStepContent;
}

export function ResetCompleteStep(props: ResetCompleteStepProps) {
  return (
    <QuizStepShell title={props.content.title} lead={props.content.lead}>
      <div class="grid h-full min-h-0">
        <ScreenshotGallery screenshots={props.content.screenshots} />
      </div>
    </QuizStepShell>
  );
}
