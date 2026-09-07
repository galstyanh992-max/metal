"use client";

import React from "react";

/**
 * Simple Error Boundary to catch and display component errors.
 * Prevents the entire app from crashing if a child component throws.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message ?? "Unknown error" };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="border border-status-red/30 bg-status-red/5 p-4 rounded-lg">
            <div className="text-sm font-medium text-status-red mb-1">
              ⚠️ Բաղադրիչի սխալ
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: "" })}
              className="mt-3 text-xs border border-hairline px-3 py-1 rounded hover:bg-muted/40"
            >
              Կրկնել
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
