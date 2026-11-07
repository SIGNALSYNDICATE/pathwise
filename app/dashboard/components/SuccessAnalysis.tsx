
"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface JobApplication {
  id: string;
  company?: string | null;
  role?: string | null;
  date_applied?: string | null;
  interviewed?: boolean | null;
  offered?: boolean | null;
  got_job?: boolean | null;
  resume_data?: string | null;
  user_id?: string;
}

interface SuccessAnalysisProps {
  applications: JobApplication[];
}

interface InsightStrength {
  title: string;
  evidence: string;
}

interface ImprovementArea {
  title: string;
  evidence: string;
  suggestion: string;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  title: string;
  action: string;
}

interface CareerInsights {
  summary: string;
  strengths: InsightStrength[];
  areasToImprove: ImprovementArea[];
  recommendations: Recommendation[];
  limitations: string;
}

interface CareerStatistics {
  totalApplications: number;
  interviewed: number;
  offered: number;
  hired: number;
  interviewRate: number | null;
  offerRate: number | null;
  interviewToOfferRate: number | null;
  hiringRate: number | null;
}

interface ApiResponse {
  success?: boolean;
  statistics?: CareerStatistics;
  insights?: CareerInsights;
  error?: string;
}

function formatRate(value: number | null | undefined) {
  return value == null ? "—" : `${value}%`;
}

export default function SuccessAnalysis({
  applications,
}: SuccessAnalysisProps) {
  const [insights, setInsights] = useState<CareerInsights | null>(
    null
  );
  const [statistics, setStatistics] =
    useState<CareerStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Calculate simple metrics from the existing dashboard data.
  const total = applications.length;

  const interviewed = applications.filter(
    (app) => app.interviewed === true
  ).length;

  const offered = applications.filter(
    (app) => app.offered === true
  ).length;

  const successfulApps = applications.filter(
    (app) => app.got_job === true
  ).length;

  const interviewRate =
    total > 0 ? Math.round((interviewed / total) * 100) : null;

  const offerRate =
    total > 0 ? Math.round((offered / total) * 100) : null;

  const hiredRate =
    total > 0
      ? Math.round((successfulApps / total) * 100)
      : null;

  async function generateInsights() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const response = await fetch("/api/career-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      const result: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to generate career insights."
        );
      }

      if (!result.insights || !result.statistics) {
        throw new Error(
          "The AI returned an incomplete response. Please retry."
        );
      }

      setInsights(result.insights);
      setStatistics(result.statistics);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/20 bg-white/5 p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 p-2">
          <Target className="h-5 w-5 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-white">
            Success Analysis
          </h2>
          <p className="mt-1 text-sm text-orange-200">
            Career insights powered by Gemma 4
          </p>
        </div>
      </div>

      {/* Actual application statistics */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-orange-200">
            Applications
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {total}
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-orange-200">
            Interview rate
          </p>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {formatRate(interviewRate)}
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-orange-200">
            Offer rate
          </p>
          <p className="mt-1 text-2xl font-bold text-cyan-400">
            {formatRate(offerRate)}
          </p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/10 p-3">
          <p className="text-xs text-orange-200">
            Hiring rate
          </p>
          <p className="mt-1 text-2xl font-bold text-orange-400">
            {formatRate(hiredRate)}
          </p>
        </div>
      </div>

      {/* AI action */}
      <button
        type="button"
        onClick={generateInsights}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 font-semibold text-white transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            Analyzing your career...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {insights ? "Refresh AI Insights" : "Generate Career Insights"}
          </>
        )}
      </button>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="text-sm text-red-200">{error}</p>
              <button
                onClick={generateInsights}
                disabled={loading}
                className="mt-2 text-sm font-semibold text-orange-300 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Initial state */}
      {!insights && !loading && !error && (
        <div className="mt-5 rounded-lg border border-dashed border-white/20 p-4 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
          <p className="text-sm font-medium text-white">
            Discover your career patterns
          </p>
          <p className="mt-1 text-xs leading-5 text-orange-200">
            Gemma will analyze your application outcomes and suggest
            practical next steps based on your recorded data.
          </p>
        </div>
      )}

      {/* AI-generated content */}
      {insights && (
        <div className="mt-6 space-y-6">
          {/* Summary */}
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <h3 className="font-semibold text-emerald-300">
                Career Overview
              </h3>
            </div>
            <p className="text-sm leading-6 text-white">
              {insights.summary}
            </p>
          </div>

          {/* Strengths */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <h3 className="font-semibold text-green-400">
                What&apos;s Working
              </h3>
            </div>

            {insights.strengths.length > 0 ? (
              <ul className="space-y-3">
                {insights.strengths.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-orange-100">
                        {item.evidence}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-orange-200">
                More outcome data is needed to identify reliable strengths.
              </p>
            )}
          </div>

          {/* Improvement areas */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-400" />
              <h3 className="font-semibold text-orange-400">
                Areas to Improve
              </h3>
            </div>

            {insights.areasToImprove.length > 0 ? (
              <ul className="space-y-4">
                {insights.areasToImprove.map((item, index) => (
                  <li
                    key={`${item.title}-${index}`}
                    className="rounded-lg border border-white/10 bg-black/10 p-3"
                  >
                    <p className="text-sm font-semibold text-white">
                      {item.title}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-orange-100">
                      <span className="font-semibold">Evidence: </span>
                      {item.evidence}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-white">
                      <span className="font-semibold text-orange-300">
                        Suggestion:{" "}
                      </span>
                      {item.suggestion}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-orange-200">
                No specific improvement areas were identified from the
                available evidence.
              </p>
            )}
          </div>

          {/* Recommendations */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-cyan-400" />
              <h3 className="font-semibold text-cyan-400">
                Recommended Next Steps
              </h3>
            </div>

            {insights.recommendations.length > 0 ? (
              <ul className="space-y-3">
                {insights.recommendations.map((item, index) => (
                  <li
                    key={`${item.title}-${index}`}
                    className="rounded-lg border border-white/10 p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          item.priority === "high"
                            ? "bg-orange-500/20 text-orange-300"
                            : item.priority === "medium"
                              ? "bg-cyan-500/20 text-cyan-300"
                              : "bg-white/10 text-orange-100"
                        }`}
                      >
                        {item.priority} priority
                      </span>
                    </div>
                    <p className="text-sm leading-5 text-orange-100">
                      {item.action}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-orange-200">
                Recommendations will become more specific as you record
                more application outcomes.
              </p>
            )}
          </div>

          {/* Limitations */}
          {insights.limitations && (
            <p className="border-t border-white/10 pt-4 text-xs leading-5 text-orange-200">
              <span className="font-semibold">Note: </span>
              {insights.limitations}
            </p>
          )}

          {statistics && (
            <p className="text-xs text-orange-200">
              Based on {statistics.totalApplications} recorded
              applications, including {statistics.interviewed} interviews
              and {statistics.offered} offers.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
