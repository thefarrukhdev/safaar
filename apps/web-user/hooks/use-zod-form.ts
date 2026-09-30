import { useForm, type UseFormProps, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";

export interface UseZodFormProps<T extends FieldValues> extends UseFormProps<T> {
  schema: ZodType<T>;
}

/**
 * Zod va React Hook Form'ni birlashtiruvchi tayyor hook.
 *
 * @example
 * const schema = z.object({ name: z.string().min(2) });
 * const form = useZodForm({ schema, defaultValues: { name: "" } });
 */
export function useZodForm<T extends FieldValues>({
  schema,
  ...formProps
}: UseZodFormProps<T>) {
  return useForm<T>({
    ...formProps,
    // @ts-expect-error - zodResolver generic typing often mismatches with react-hook-form internals
    resolver: zodResolver(schema),
  });
}
