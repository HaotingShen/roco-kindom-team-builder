import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 ml-sidebar min-w-0">
        <Topbar />
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}