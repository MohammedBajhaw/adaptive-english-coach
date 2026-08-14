export type ReportViewData<T> = { weekly: T; monthly: T };

export function resolveReportViewData<T>(isAuthenticated: boolean, reportData: ReportViewData<T> | undefined, fallback: ReportViewData<T>) {
  return isAuthenticated && reportData ? reportData : fallback;
}
