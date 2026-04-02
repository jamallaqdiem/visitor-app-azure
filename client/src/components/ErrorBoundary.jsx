import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // log to the browser console.
    console.error("🚨 UI Rendering Error:", error, errorInfo);

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-slate-800 p-8">
          <div className="bg-white p-10 rounded-xl shadow-2xl border border-red-100 max-w-md text-center">
            <span className="text-6xl mb-4 block">⚠️</span>
            <h1 className="text-2xl font-bold mb-2 text-red-600">
              Something went wrong
            </h1>
            <p className="text-slate-600 mb-6">
              The application encountered an unexpected error. Don't worry, your
              data is safe.
            </p>

            {/* Show technical details only in development mode */}
            {import.meta.env.DEV && (
              <details className="mb-6 p-3 bg-slate-100 rounded text-left text-xs font-mono overflow-auto max-h-40">
                <summary className="cursor-pointer font-bold text-slate-500 uppercase tracking-widest">
                  Debug Info
                </summary>
                <p className="mt-2 text-red-700">
                  {this.state.error?.toString()}
                </p>
                <p className="mt-1 text-slate-500 whitespace-pre-wrap">
                  {this.state.errorInfo?.componentStack}
                </p>
              </details>
            )}

            <button
              onClick={() => (window.location.href = "/")}
              className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg active:scale-95"
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
