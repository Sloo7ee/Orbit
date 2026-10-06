import { navigation } from "@/components/shell/navigation";
import { Badge, EmptyState, Surface } from "@/components/ui/primitives";
export function SectionPreview({ section }: { section: string }) {
  const item = navigation.find((item) => item.href === `/${section}`)!;
  const Icon = item.icon;
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>{item.label}</h1>
        </div>
      </div>
      <Surface className="placeholder-surface">
        <Badge>Not available yet</Badge>
        <EmptyState
          icon={<Icon size={32} strokeWidth={1.3} />}
          title={item.label}
        >
          This feature is planned for a later phase.
        </EmptyState>
      </Surface>
    </div>
  );
}
