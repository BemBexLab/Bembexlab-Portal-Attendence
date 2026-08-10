export type ApiResponse<TData> = {
  data: TData;
  message?: string;
};

export type PaginatedResponse<TData> = {
  data: TData[];
  page: number;
  pageSize: number;
  total: number;
};
