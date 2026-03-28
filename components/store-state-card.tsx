import { SectionContainer } from "@/components/ui/section-container";

type StoreStateCardProps = {
  title: string;
  description: string;
};

export function StoreStateCard({
  title,
  description,
}: StoreStateCardProps) {
  return (
    <SectionContainer title={title} description={description}>
      <div className="ui-subtle-panel text-sm leading-6 text-slate-600">
        Store-scoped data will begin loading automatically once a valid active
        store is available.
      </div>
    </SectionContainer>
  );
}
