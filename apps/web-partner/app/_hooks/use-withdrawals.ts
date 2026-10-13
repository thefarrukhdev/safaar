"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWithdrawals,
  createWithdrawal,
  type WithdrawalRequest,
} from "../_lib/api/endpoints/partners";
import { useAuthStore } from "../_stores/auth-store";

export const withdrawalsQueryKey = ["partner", "withdrawals"] as const;

export function useWithdrawals(enabled = true) {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);

  const query = useQuery({
    queryKey: [...withdrawalsQueryKey, accessToken],
    queryFn: () => getWithdrawals(useAuthStore.getState().tokens?.accessToken ?? accessToken),
    enabled: Boolean(accessToken) && enabled,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading && !query.data,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateWithdrawal() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { amount: number; bankAccount: string }) => {
      const token = useAuthStore.getState().tokens?.accessToken ?? accessToken;
      return createWithdrawal(body, token);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: withdrawalsQueryKey });
    },
  });
}

export type { WithdrawalRequest };
