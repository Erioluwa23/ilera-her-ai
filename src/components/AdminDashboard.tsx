"use client";

import { useEffect, useMemo, useState } from "react";

type Report = {
  generatedAt: string;
  users: { total: number; last_7_days: number; last_30_days: number };
  feedback: {
    total: number;
    average_rating: string;
    new_count: number;
    last_7_days: number;
  };
  categories: Array<{ category: string; count: number }>;
  recent: Array<{
    id: number;
    rating: number;
    category: string;
    message: string;
    status: string;
    created_at: string;
    phone_tail: string;
  }>;
};

export default function AdminDashboard() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/admin/report", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Could not load the report.");
      return;
    }
    setReport(data);
    setError("");
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  async function updateStatus(id: number, status: string) {
    const response = await fetch("/api/admin/report", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (response.ok) await load();
  }

  const maxCategory = useMemo(
    () => Math.max(1, ...(report?.categories.map((item) => item.count) || [1])),
    [report],
  );

  if (error) return <p className="authError">{error}</p>;
  if (!report) return <p className="statusBox">Loading report…</p>;

  return (
    <div className="adminDashboard">
      <div className="adminStats">
        <article>
          <span>Total users</span>
          <strong>{report.users.total}</strong>
          <small>+{report.users.last_7_days} in 7 days</small>
        </article>
        <article>
          <span>Feedback</span>
          <strong>{report.feedback.total}</strong>
          <small>{report.feedback.new_count} new</small>
        </article>
        <article>
          <span>Average rating</span>
          <strong>{report.feedback.average_rating}/5</strong>
          <small>{report.feedback.last_7_days} responses in 7 days</small>
        </article>
        <article>
          <span>30-day signups</span>
          <strong>{report.users.last_30_days}</strong>
          <small>registered users</small>
        </article>
      </div>

      <section className="adminSection">
        <div className="sectionHeading">
          <div>
            <span className="eyebrow">Feedback categories</span>
            <h2>What users are talking about</h2>
          </div>
          <button
            className="secondaryBtn"
            type="button"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
        <div className="categoryBars">
          {report.categories.length === 0 ? (
            <p className="muted">No feedback yet.</p>
          ) : (
            report.categories.map((item) => (
              <div className="categoryBar" key={item.category}>
                <span>{item.category}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(8, (item.count / maxCategory) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{item.count}</strong>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="adminSection">
        <span className="eyebrow">Latest feedback</span>
        <h2>Review user reports</h2>
        <div className="feedbackTableWrap">
          <table className="feedbackTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Rating</th>
                <th>Category</th>
                <th>Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.recent.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleDateString()}</td>
                  <td>••••{item.phone_tail}</td>
                  <td>{item.rating}/5</td>
                  <td>{item.category}</td>
                  <td>{item.message}</td>
                  <td>
                    <select
                      value={item.status}
                      onChange={(event) =>
                        void updateStatus(item.id, event.target.value)
                      }
                    >
                      <option value="new">New</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small className="muted">
          User phone numbers are masked in the dashboard.
        </small>
      </section>
    </div>
  );
}
