import { TabBar } from "@/components/tab-bar";

// The three-tab shell. Non-tab surfaces (join, admin) render without it.
export default function TabsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <TabBar />
    </>
  );
}
