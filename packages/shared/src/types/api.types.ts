// ─── API Response Envelope ───────────────────────────────────────────────────

export interface ApiMeta {
    timestamp: string;
    requestId: string;
}

export interface ApiSuccessResponse<T> {
    data: T;
    meta: ApiMeta;
}

export interface ApiErrorDetail {
    code: string;
    message: string;
    statusCode: number;
}

export interface ApiErrorResponse {
    error: ApiErrorDetail;
    meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
