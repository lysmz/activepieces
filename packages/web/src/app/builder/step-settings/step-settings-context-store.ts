import { createContext } from 'react';

import type { StepSettingsContextState } from './step-settings-context';

export const StepSettingsContext = createContext<
  StepSettingsContextState | undefined
>(undefined);
