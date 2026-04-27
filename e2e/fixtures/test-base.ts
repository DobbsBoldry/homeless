import { test as base, expect } from '@playwright/test';
import { type Persona, signInAs } from './auth';

type Fixtures = {
  signInAs: (persona: Persona) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  signInAs: async ({ page, context }, use) => {
    await use(async (persona: Persona) => {
      await signInAs(persona, page, context);
    });
  },
});

export type { Persona };
export { expect };
