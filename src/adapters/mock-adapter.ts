import type { Project } from "@/domain/project";
import { ProjectsSchema } from "@/domain/project";
import type { ProjectRepository } from "@/repository/project-repository";

/**
 * Deterministic sample data so the full UI is viewable with no credentials.
 * Enable via DATA_SOURCE=mock. Never used when DATA_SOURCE=trello.
 */
const daysFromNow = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString();
};

const RAW: Project[] = [
  {
    id: "niva-01",
    name: "Unified Patient Intake Redesign",
    status: "Blocked",
    priority: "Urgent",
    phase: "In Progress",
    progress: 62,
    checklistDone: 0,
    checklistTotal: 0,
    owners: [{ id: "u1", name: "Dr. Amara Foss", initials: "AF", avatarUrl: null }],
    targetCompletion: daysFromNow(12),
    lastUpdated: daysFromNow(-1),
    description:
      "Consolidating three legacy intake flows into a single HIPAA-compliant experience to cut onboarding time and data-entry errors. Blocked on security sign-off for the third-party eligibility vendor.",
    recentActivity: [
      { id: "a1", text: "Moved to In Progress", at: daysFromNow(-1) },
      { id: "a2", text: "Comment: Vendor SOC 2 report requested", at: daysFromNow(-2) },
    ],
  },
  {
    id: "niva-02",
    name: "Provider Scheduling Optimization",
    status: "Active",
    priority: "High",
    phase: "Leadership Review",
    progress: 88,
    checklistDone: 7,
    checklistTotal: 8,
    owners: [{ id: "u2", name: "Marcus Lee", initials: "ML", avatarUrl: null }],
    targetCompletion: daysFromNow(6),
    lastUpdated: daysFromNow(-3),
    description: "AI-assisted scheduling to reduce provider idle time and patient wait times across the network.",
    recentActivity: [{ id: "a3", text: "Moved to Leadership Review", at: daysFromNow(-3) }],
  },
  {
    id: "niva-03",
    name: "Telehealth Reimbursement Engine",
    status: "Active",
    priority: "Normal",
    phase: "Ready",
    progress: 20,
    checklistDone: 0,
    checklistTotal: 0,
    owners: [{ id: "u3", name: "Priya Nair", initials: "PN", avatarUrl: null }],
    targetCompletion: daysFromNow(40),
    lastUpdated: daysFromNow(-20),
    description: "Automating payer-specific reimbursement rules for telehealth visits to accelerate revenue capture.",
    recentActivity: [{ id: "a4", text: "Initiative updated", at: daysFromNow(-20) }],
  },
  {
    id: "niva-04",
    name: "Clinical Data Warehouse (BigQuery)",
    status: "Active",
    priority: "High",
    phase: "In Design",
    progress: 35,
    checklistDone: 0,
    checklistTotal: 0,
    owners: [{ id: "u4", name: "Sofia Alvarez", initials: "SA", avatarUrl: null }],
    targetCompletion: daysFromNow(-2),
    lastUpdated: daysFromNow(-4),
    description:
      "Foundational analytics warehouse unifying EHR, claims, and operational data for executive reporting. Data-governance policy pending legal review.",
    recentActivity: [{ id: "a5", text: "Moved to In Design", at: daysFromNow(-4) }],
  },
  {
    id: "niva-05",
    name: "Patient Portal Accessibility Overhaul",
    status: "Completed",
    priority: "Normal",
    phase: "Completed",
    progress: 100,
    checklistDone: 0,
    checklistTotal: 0,
    owners: [{ id: "u5", name: "Grace Kim", initials: "GK", avatarUrl: null }],
    targetCompletion: daysFromNow(-3),
    lastUpdated: daysFromNow(-2),
    description: "WCAG 2.1 AA compliance across the patient portal. Shipped.",
    recentActivity: [{ id: "a6", text: "Moved to Completed", at: daysFromNow(-2) }],
  },
  {
    id: "niva-06",
    name: "Care Coordination Mobile App",
    status: "Blocked",
    priority: "High",
    phase: "Validation",
    progress: 74,
    checklistDone: 0,
    checklistTotal: 0,
    owners: [{ id: "u6", name: "Daniel Osei", initials: "DO", avatarUrl: null }],
    targetCompletion: daysFromNow(18),
    lastUpdated: daysFromNow(-6),
    description:
      "Mobile app enabling care teams to coordinate across settings in real time. Push-notification reliability is failing acceptance criteria.",
    recentActivity: [{ id: "a7", text: "Progress checklist updated", at: daysFromNow(-6) }],
  },
  {
    id: "niva-07",
    name: "Referral Network Analytics",
    status: "Not Started",
    priority: "Normal",
    phase: "Planned",
    progress: 0,
    checklistDone: 0,
    checklistTotal: 0,
    owners: [],
    targetCompletion: null,
    lastUpdated: daysFromNow(-15),
    description: "Backlog item — analytics on referral leakage across the network. Not yet scoped.",
    recentActivity: [{ id: "a8", text: "Initiative created", at: daysFromNow(-15) }],
  },
];

export class MockAdapter implements ProjectRepository {
  async getProjects(): Promise<Project[]> {
    return ProjectsSchema.parse(RAW);
  }
  async getProjectById(id: string): Promise<Project | null> {
    return RAW.find((p) => p.id === id) ?? null;
  }
}
