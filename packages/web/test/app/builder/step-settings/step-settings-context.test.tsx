import { FlowTriggerType } from '@activepieces/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/pieces', async () => {
  const { z } = await import('zod');
  return { formUtils: { buildPieceSchema: () => z.object({}) } };
});

describe('step settings context', () => {
  it('shares settings between provider and consumer module versions after a reload', async () => {
    const providerModule: typeof import('@/app/builder/step-settings/step-settings-context') =
      await import(`${contextModulePath}?version=provider`);
    const consumerModule: typeof import('@/app/builder/step-settings/step-settings-context') =
      await import(`${contextModulePath}?version=consumer`);

    const SettingsConsumer = () => {
      const { selectedStep } = consumerModule.useStepSettingsContext();
      return createElement('span', null, selectedStep.displayName);
    };

    const view = renderToStaticMarkup(
      <providerModule.StepSettingsProvider
        selectedStep={{
          name: 'trigger',
          displayName: 'Webhook settings',
          type: FlowTriggerType.EMPTY,
          valid: false,
          lastUpdatedDate: '2026-10-15T08:46:33.335Z',
          settings: {},
        }}
        pieceModel={undefined}
        pieceModelNotFound={false}
      >
        <SettingsConsumer />
      </providerModule.StepSettingsProvider>,
    );

    expect(providerModule).not.toBe(consumerModule);
    expect(view).toBe('<span>Webhook settings</span>');
  });
});

const contextModulePath = '@/app/builder/step-settings/step-settings-context';
