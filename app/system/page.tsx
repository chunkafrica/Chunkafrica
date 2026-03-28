import { PagePlaceholder } from "@/components/page-placeholder";

export default function SystemPage() {
  return (
    <PagePlaceholder
      eyebrow="System"
      title="Keep configuration separate from daily operating work."
      summary="System is the place for business configuration, access, and platform settings. It exists in the navigation now so the product reads as a structured operating system instead of a collection of unrelated tools."
      focusAreas={[
        "Separate settings from frontline operations.",
        "Preserve a clean place for future role and configuration work.",
        "Avoid cluttering dashboard and ops modules with admin-only tasks.",
      ]}
      nextStep="No new system management features are being added in Phase 1."
    />
  );
}
