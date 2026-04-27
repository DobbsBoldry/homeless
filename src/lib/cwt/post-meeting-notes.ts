import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  buildPostMeetingNotesUserPrompt,
  POST_MEETING_NOTES_PROMPT_VERSION,
  POST_MEETING_NOTES_SYSTEM_PROMPT,
  type PostMeetingNotesOutput,
  PostMeetingNotesSchema,
} from '@/ai/prompts/post-meeting-notes';

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const MODEL_ID = 'claude-sonnet-4-6';

export type PostMeetingNotesResult = {
  output: PostMeetingNotesOutput;
  modelId: string;
  promptVersion: string;
};

export async function structurePostMeetingNotes(rawNotes: string): Promise<PostMeetingNotesResult> {
  const response = await client().messages.parse({
    model: MODEL_ID,
    max_tokens: 1200,
    system: [
      {
        type: 'text',
        text: POST_MEETING_NOTES_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildPostMeetingNotesUserPrompt(rawNotes) }],
    output_config: { format: zodOutputFormat(PostMeetingNotesSchema) },
  });

  if (!response.parsed_output) {
    throw new Error(`[post-meeting-notes] parse failed; stop_reason=${response.stop_reason}`);
  }

  return {
    output: response.parsed_output,
    modelId: MODEL_ID,
    promptVersion: POST_MEETING_NOTES_PROMPT_VERSION,
  };
}
