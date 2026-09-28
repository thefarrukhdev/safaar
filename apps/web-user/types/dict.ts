export type TranslationDict = {
  [key: string]: string | TranslationDict | undefined;
};
export type AnyDict = Record<string, unknown>; // Wait, the rule says NO any.
