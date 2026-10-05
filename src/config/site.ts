/** Public branding and contact details used on the marketing site. */
export const STUDIO = {
  name: "Velorex Studio",
  descriptor: "IT Services",
  developer: "Aijaz",
  /** Default inbox for enquiries; override with INQUIRY_TO_EMAIL. */
  email: "velorexdesign@gmail.com",
} as const;

export const SERVICE_OPTIONS = [
  "Web application development",
  "Mobile app development",
  "AI agents & automation",
  "UI / UX design",
  "Branding & graphic design",
  "E-commerce website",
  "Maintenance & support",
  "Other",
] as const;

export const BUDGET_OPTIONS = [
  "Under $1,000",
  "$1,000 – $5,000",
  "$5,000 – $15,000",
  "$15,000+",
  "Not sure yet",
] as const;
export const TIMELINE_OPTIONS = [
  "ASAP",
  "Within 1 month",
  "1 – 3 months",
  "3+ months",
  "Flexible",
] as const;
export const TEAM_SIZE_OPTIONS = [
  "1 – 10",
  "11 – 50",
  "51 – 200",
  "201 – 1,000",
  "1,000+",
] as const;
