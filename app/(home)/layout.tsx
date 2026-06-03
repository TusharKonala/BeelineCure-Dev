import { BeelineCureMarketingNav } from "@/components/beeline-cure/BeelineCureMarketingNav";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <BeelineCureMarketingNav />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
