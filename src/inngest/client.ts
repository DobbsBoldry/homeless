import { Inngest } from 'inngest';

/**
 * Single Inngest client for the app.
 *
 * Per-event types are declared inline in the trigger via a Standard Schema
 * (zod) when needed. Add new typed events at the function definition site,
 * not in a central registry, so the type stays close to its handler.
 */
export const inngest = new Inngest({ id: 'daviess-coalition' });
