import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    let readable = 'An unexpected error occurred while loading your business workspace.';
    if (error instanceof Error) {
      try {
        const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
        if (parsed.error?.includes('Quota exceeded')) {
          readable =
            'Your Firestore daily free-tier quota has been reached. Quotas reset the next day.';
        } else if (parsed.error?.includes('Missing or insufficient permissions')) {
          readable =
            'Permission denied while syncing your business records. Please verify your account is signed in with a verified Google email.';
        } else if (parsed.error) {
          readable = parsed.error;
        }
      } catch {
        readable = error.message || readable;
      }
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: unknown) {
    console.error('VendorPilot AI ErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <h1 className="text-base font-semibold text-slate-900">
                  Something went wrong
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {this.state.message}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                <RotateCcw className="h-4 w-4" />
                Reload workspace
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
