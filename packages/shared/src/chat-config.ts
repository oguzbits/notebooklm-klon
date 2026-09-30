import { z } from 'zod';

/** How the assistant talks in a notebook. The default leaves the answers as they are. */
export const CHAT_STYLE = {
  DEFAULT: 'DEFAULT',
  LEARNING_GUIDE: 'LEARNING_GUIDE',
  CUSTOM: 'CUSTOM',
} as const;
export const CHAT_LENGTH = { DEFAULT: 'DEFAULT', SHORTER: 'SHORTER', LONGER: 'LONGER' } as const;
/** AUTO: the language of the question. */
export const CHAT_LANGUAGE = { AUTO: 'AUTO', DE: 'DE', EN: 'EN' } as const;

export const MAX_CUSTOM_INSTRUCTION_CHARS = 500;

export const ChatConfigSchema = z
  .object({
    style: z.enum(CHAT_STYLE),
    customInstruction: z.string().trim().max(MAX_CUSTOM_INSTRUCTION_CHARS),
    length: z.enum(CHAT_LENGTH),
    language: z.enum(CHAT_LANGUAGE),
  })
  .refine((config) => config.style !== CHAT_STYLE.CUSTOM || config.customInstruction !== '', {
    path: ['customInstruction'],
    message: 'The custom style needs an instruction.',
  });

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  style: CHAT_STYLE.DEFAULT,
  customInstruction: '',
  length: CHAT_LENGTH.DEFAULT,
  language: CHAT_LANGUAGE.AUTO,
};

export type ChatStyle = (typeof CHAT_STYLE)[keyof typeof CHAT_STYLE];
export type ChatLength = (typeof CHAT_LENGTH)[keyof typeof CHAT_LENGTH];
export type ChatLanguage = (typeof CHAT_LANGUAGE)[keyof typeof CHAT_LANGUAGE];
export type ChatConfig = z.infer<typeof ChatConfigSchema>;
