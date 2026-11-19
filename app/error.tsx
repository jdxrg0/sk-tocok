'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error Boundary caught error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-xl font-bold mb-2 text-slate-800 dark:text-slate-100">Something went wrong</h2>
      <p className="text-sm text-slate-500 mb-4 max-w-md">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
      >
        Try again
      </button>
    </div>
  );
}
