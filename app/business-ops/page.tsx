import { PagePlaceholder } from "@/components/page-placeholder";

export default function BusinessOpsPage() {
  return (
    <PagePlaceholder
      eyebrow="Business Ops"
      title="Hold the cross-business controls that support production."
      summary="Business Ops is where non-frontline operational controls can grow without diluting the production-first workflow. Phase 1 keeps this module present in the structure while the team repositions the product around operations."
      focusAreas={[
        "Reserve room for suppliers, controls, and operating policy.",
        "Keep the sidebar aligned with the new product thesis.",
        "Avoid rebuilding working MVP flows before they need to move.",
      ]}
      nextStep="Inventory Ops, Production Ops, and Finance Ops remain the active Phase 1 modules."
    />
  );
}
