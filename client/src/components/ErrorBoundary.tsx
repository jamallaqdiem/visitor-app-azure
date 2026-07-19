import React from "react";
import type { ErrorBoundaryProps, ErrorBoundaryState } from "../types";

/**
 * @description Catch-all boundary component designed to intercept unhandled
 * runtime exceptions within the React child tree and display a robust fallback UI.
 */
// JS, build a component blueprint called ErrorBoundary that acts like a React Component.
// TS, make sure incoming properties follow 'ErrorBoundaryProps' and my state follows 'ErrorBoundaryState'.
class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState & { errorInfo: React.ErrorInfo | null }
> {
  //When this component is born, run this setup function immediately and accept the incoming configuration settings (props).
  constructor(props: ErrorBoundaryProps) {
    //Create internal state
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }
  // flip 'hasError' to true, and save the error to block the total white screen.
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("🚨 UI Rendering Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render(): React.ReactNode {
    // Encapsulated Tailwind v4 layout configurations
    const styles = {
      layoutWrapper:
        "flex flex-col items-center justify-center min-h-screen bg-gray-50 text-slate-800 p-8",
      cardContainer:
        "bg-white p-10 rounded-xl shadow-2xl border border-red-100 max-w-md text-center",
      warningIcon: "text-6xl mb-4 block",
      errorHeader: "text-2xl font-bold mb-2 text-red-600",
      descriptionText: "text-slate-600 mb-6",
      debugDetails:
        "mb-6 p-3 bg-slate-100 rounded text-left text-xs font-mono overflow-auto max-h-40",
      debugSummary:
        "cursor-pointer font-bold text-slate-500 uppercase tracking-widest",
      errorMessage: "mt-2 text-red-700",
      stackTrace: "mt-1 text-slate-500 whitespace-pre-wrap",
      actionButton:
        "w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg active:scale-95",
    };

    if (this.state.hasError) {
      // Allow custom parent fallback overrides or fall back to default design
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={styles.layoutWrapper}>
          <div className={styles.cardContainer}>
            <span className={styles.warningIcon}>⚠️</span>
            <h1 className={styles.errorHeader}>Something went wrong</h1>
            <p className={styles.descriptionText}>
              The application encountered an unexpected error. Don't worry, your
              data is safe.
            </p>

            {/* Render telemetry information strictly inside local development environments */}
            {import.meta.env.DEV && (
              <details className={styles.debugDetails}>
                <summary className={styles.debugSummary}>Debug Info</summary>
                <p className={styles.errorMessage}>
                  {this.state.error?.toString()}
                </p>
                <p className={styles.stackTrace}>
                  {this.state.errorInfo?.componentStack}
                </p>
              </details>
            )}

            <button
              //Force a brutal, hard browser network refresh to completely wipe out any corrupt memory state and start fresh at the dashboard.
              onClick={() => (window.location.href = "/")}
              className={styles.actionButton}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
