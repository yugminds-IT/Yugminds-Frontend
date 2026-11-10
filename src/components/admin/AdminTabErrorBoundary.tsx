"use client";

import React from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  tabName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AdminTabErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[AdminTabErrorBoundary] Error in ${this.props.tabName ?? 'tab'}:`, error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <section className="sd-panel" role="alert">
          <div className="sd-empty">
            <b>{this.props.tabName ? `${this.props.tabName} did not load` : "Something went wrong"}</b>
            <p>{this.state.error?.message ?? "An unexpected error stopped this section from showing."} Try again, and if it keeps happening, refresh the page.</p>
            <button className="sd-btn sd-btn--amber" onClick={this.reset}><RefreshCw aria-hidden="true" />Try again</button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
