import type { WorkforceDepartment } from "./types";

/**
 * SAMPLE workforce used only for the clearly-labelled preview (dashboard before any
 * agent is connected, and the landing page). Never mixed with real metrics.
 */
export const SAMPLE_PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "Claude Sonnet": { input: 3, output: 15 },
  "Claude Haiku": { input: 1, output: 5 },
  "GPT-5": { input: 1.25, output: 10 },
  "GPT-5 mini": { input: 0.25, output: 2 },
  "Gemini Pro": { input: 1.25, output: 10 },
  "Gemini Flash": { input: 0.3, output: 2.5 },
  "Llama 70B": { input: 0.6, output: 0.6 },
};

export const SAMPLE_WORKFORCE: WorkforceDepartment[] = [
  {
    id: "dep_sales",
    name: "Sales",
    agents: [
      {
        id: "agt_sales_lead",
        name: "Lead Research Agent",
        provider: "Anthropic",
        model: "Claude Sonnet",
        tools: ["web_search", "crm.read", "enrich_company"],
        tasks: [
          { name: "Find 50 SaaS companies in India", result: "47 qualified leads found" },
          { name: "Enrich Q4 pipeline accounts", result: "128 accounts enriched" },
        ],
      },
      {
        id: "agt_sales_outreach",
        name: "Outreach Writer",
        provider: "OpenAI",
        model: "GPT-5",
        tools: ["crm.read", "email.draft"],
        tasks: [{ name: "Draft follow-ups for demo no-shows", result: "22 emails drafted" }],
        approvalAction: "Send 22 external emails",
      },
      {
        id: "agt_sales_qual",
        name: "Deal Qualifier",
        provider: "Google",
        model: "Gemini Flash",
        tools: ["crm.read", "crm.update"],
        tasks: [{ name: "Score inbound leads (BANT)", result: "31 leads scored" }],
      },
      {
        id: "agt_sales_forecast",
        name: "Forecast Analyst",
        provider: "Anthropic",
        model: "Claude Haiku",
        tools: ["crm.read", "sheets.write"],
        tasks: [{ name: "Update weekly revenue forecast", result: "Forecast updated: $1.42M" }],
      },
      {
        id: "agt_sales_proposal",
        name: "Proposal Builder",
        provider: "OpenAI",
        model: "GPT-5 mini",
        tools: ["docs.write", "pricing.read"],
        tasks: [{ name: "Build proposal for Northwind", result: "Proposal v2 ready" }],
        approvalAction: "Apply 12% discount",
      },
    ],
  },
  {
    id: "dep_marketing",
    name: "Marketing",
    agents: [
      {
        id: "agt_mkt_content",
        name: "Content Strategist",
        provider: "Anthropic",
        model: "Claude Sonnet",
        tools: ["web_search", "docs.write"],
        tasks: [{ name: "Write launch blog post", result: "1,800-word draft ready" }],
        approvalAction: "Publish blog post",
      },
      {
        id: "agt_mkt_social",
        name: "Social Scheduler",
        provider: "OpenAI",
        model: "GPT-5 mini",
        tools: ["social.draft", "calendar.read"],
        tasks: [{ name: "Plan LinkedIn week", result: "5 posts scheduled" }],
        approvalAction: "Publish social media posts",
      },
      {
        id: "agt_mkt_seo",
        name: "SEO Auditor",
        provider: "Google",
        model: "Gemini Pro",
        tools: ["crawl_site", "web_search"],
        tasks: [{ name: "Audit pricing page SEO", result: "14 issues found" }],
      },
    ],
  },
  {
    id: "dep_support",
    name: "Customer Support",
    agents: [
      {
        id: "agt_sup_triage",
        name: "Ticket Triage",
        provider: "Anthropic",
        model: "Claude Haiku",
        tools: ["helpdesk.read", "helpdesk.tag"],
        tasks: [{ name: "Triage overnight tickets", result: "64 tickets routed" }],
      },
      {
        id: "agt_sup_reply",
        name: "Reply Assistant",
        provider: "OpenAI",
        model: "GPT-5",
        tools: ["kb.search", "helpdesk.reply"],
        tasks: [{ name: "Answer billing questions", result: "18 replies sent" }],
      },
      {
        id: "agt_sup_refund",
        name: "Refund Agent",
        provider: "Custom",
        model: "Llama 70B",
        tools: ["orders.read", "payments.refund"],
        tasks: [{ name: "Process refund request #8841", result: "Refund of $129 issued" }],
        approvalAction: "Issue $129 refund",
      },
      {
        id: "agt_sup_qa",
        name: "Quality Reviewer",
        provider: "Google",
        model: "Gemini Flash",
        tools: ["helpdesk.read"],
        tasks: [{ name: "Score yesterday's conversations", result: "CSAT forecast 4.6" }],
      },
    ],
  },
  {
    id: "dep_finance",
    name: "Finance",
    agents: [
      {
        id: "agt_fin_invoice",
        name: "Invoice Reconciler",
        provider: "Anthropic",
        model: "Claude Sonnet",
        tools: ["erp.read", "bank.read"],
        tasks: [{ name: "Reconcile September invoices", result: "212 invoices matched" }],
      },
      {
        id: "agt_fin_expense",
        name: "Expense Auditor",
        provider: "OpenAI",
        model: "GPT-5 mini",
        tools: ["expenses.read"],
        tasks: [{ name: "Flag out-of-policy expenses", result: "7 expenses flagged" }],
      },
    ],
  },
  {
    id: "dep_ops",
    name: "Operations",
    agents: [
      {
        id: "agt_ops_vendor",
        name: "Vendor Monitor",
        provider: "Google",
        model: "Gemini Pro",
        tools: ["web_search", "contracts.read"],
        tasks: [{ name: "Check vendor SLA breaches", result: "2 breaches reported" }],
      },
      {
        id: "agt_ops_inventory",
        name: "Inventory Planner",
        provider: "Anthropic",
        model: "Claude Haiku",
        tools: ["inventory.read", "sheets.write"],
        tasks: [{ name: "Forecast stock for next 14 days", result: "Reorder list: 9 SKUs" }],
        approvalAction: "Create purchase order ($8,420)",
      },
      {
        id: "agt_ops_sched",
        name: "Shift Scheduler",
        provider: "Custom",
        model: "Llama 70B",
        tools: ["calendar.write"],
        tasks: [{ name: "Build next week's rota", result: "Rota published" }],
      },
    ],
  },
  {
    id: "dep_engineering",
    name: "Engineering",
    agents: [
      {
        id: "agt_eng_review",
        name: "PR Reviewer",
        provider: "Anthropic",
        model: "Claude Sonnet",
        tools: ["github.read", "github.comment"],
        tasks: [{ name: "Review PR #482", result: "3 issues commented" }],
      },
      {
        id: "agt_eng_incident",
        name: "Incident Responder",
        provider: "OpenAI",
        model: "GPT-5",
        tools: ["logs.search", "metrics.query", "pager.read"],
        tasks: [{ name: "Investigate API latency alert", result: "Root cause: cold cache" }],
      },
    ],
  },
  {
    id: "dep_hr",
    name: "HR",
    agents: [
      {
        id: "agt_hr_screen",
        name: "Resume Screener",
        provider: "Google",
        model: "Gemini Flash",
        tools: ["ats.read"],
        tasks: [{ name: "Screen Backend Engineer applicants", result: "12 shortlisted" }],
      },
      {
        id: "agt_hr_onboard",
        name: "Onboarding Buddy",
        provider: "Anthropic",
        model: "Claude Haiku",
        tools: ["docs.read", "chat.send"],
        tasks: [{ name: "Prepare onboarding for 3 new hires", result: "3 checklists sent" }],
      },
    ],
  },
  {
    id: "dep_analytics",
    name: "Analytics",
    agents: [
      {
        id: "agt_an_report",
        name: "KPI Reporter",
        provider: "OpenAI",
        model: "GPT-5 mini",
        tools: ["warehouse.query", "sheets.write"],
        tasks: [{ name: "Build weekly KPI report", result: "Report shared with leadership" }],
      },
      {
        id: "agt_an_anomaly",
        name: "Anomaly Watcher",
        provider: "Google",
        model: "Gemini Pro",
        tools: ["warehouse.query"],
        tasks: [{ name: "Scan churn signals", result: "4 at-risk accounts" }],
      },
    ],
  },
];
