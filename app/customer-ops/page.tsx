import { PagePlaceholder } from "@/components/page-placeholder";

export default function CustomerOpsPage() {
  return (
    <PagePlaceholder
      eyebrow="Customer Ops"
      title="Keep customer context visible as operations mature."
      summary="Customer Ops is reserved for the buyer-side workflows that sit closest to repeat orders, delivery follow-up, and relationship history. It is intentionally lightweight in Phase 1 so we can keep the current MVP stable."
      focusAreas={[
        "Protect the new operations-based navigation model.",
        "Reserve space for customer records and repeat-order context.",
        "Avoid adding new backend complexity before the core ops restructure is stable.",
      ]}
      nextStep="Use Sales Ops and Finance Ops for live work during Phase 1."
    />
  );
}
