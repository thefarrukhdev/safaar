import apiClient from "./client";

export interface HeroBackgroundAdminItem {
  id: string;
  page: string;
  imageUrl: string;
  title: { uz?: string; ru?: string; en?: string } | null;
  subtitle: { uz?: string; ru?: string; en?: string } | null;
  isActive: boolean;
  sortOrder: number;
}

export const adminHeroBgApi = {
  list: async (params?: { page?: string; is_active?: boolean }) => {
    const { data } = await apiClient.get<HeroBackgroundAdminItem[]>("/admin/hero-backgrounds", { params });
    return data;
  },

  create: async (data: Partial<HeroBackgroundAdminItem>) => {
    const { data: resData } = await apiClient.post<HeroBackgroundAdminItem>("/admin/hero-backgrounds", data);
    return resData;
  },

  update: async (id: string, data: Partial<HeroBackgroundAdminItem>) => {
    const { data: resData } = await apiClient.patch<HeroBackgroundAdminItem>(`/admin/hero-backgrounds/${id}`, data);
    return resData;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/admin/hero-backgrounds/${id}`);
    return data;
  },

  toggleActive: async (id: string, isActive?: boolean) => {
    const { data } = await apiClient.post(`/admin/hero-backgrounds/${id}/toggle-active`, { isActive });
    return data;
  },
    
  publish: async (id: string) => {
    const { data } = await apiClient.post(`/admin/hero-backgrounds/${id}/publish`);
    return data;
  },
    
  unpublish: async (id: string) => {
    const { data } = await apiClient.post(`/admin/hero-backgrounds/${id}/unpublish`);
    return data;
  },
    
  reorder: async (orderedIds: string[]) => {
    const { data } = await apiClient.post(`/admin/hero-backgrounds/reorder`, { orderedIds });
    return data;
  },
};
