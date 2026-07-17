import React from "react";

/**
 * @description Type contract for the ErrorBoundary component properties.
 */
export interface ErrorBoundaryProps {
  /** The child components that this boundary wraps and monitors for errors. */
  children: React.ReactNode;
  /** An optional fallback UI to render instead of the default error screen. */
  fallback?: React.ReactNode;
}

/**
 * @description Type contract for the internal ErrorBoundary state tracking.
 */
export interface ErrorBoundaryState {
  /** Flags whether an uncaught runtime error has been intercepted in the child tree. */
  hasError: boolean;
  /** Stores the actual Error object thrown by the application for debugging or logging. */
  error: Error | null;
}
