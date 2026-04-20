import { useState } from "react";
import AppLayout from "../components/Layout";
import type { PageKey } from "../components/Layout";
import Dashboard from "./Dashboard";
import Employees from "./Employees";
import Stores from "./Stores";
import Areas from "./Areas";
import Schedule from "./Schedule";
import RosterTemplatePage from "./RosterTemplate";
import Rosters from "./Rosters";

export default function Index() {
  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard");

  console.log("[Index] currentPage:", currentPage);

  const handleNavigate = (page: string) => {
    console.log("[Index] navigating to:", page);
    setCurrentPage(page as PageKey);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "employees":
        return <Employees />;
      case "stores":
        return <Stores />;
      case "areas":
        return <Areas />;
      case "schedule":
        return <Schedule />;
      case "rosters":
        return <Rosters />;
      case "rosterTemplate":
        return <RosterTemplatePage />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} onPageChange={handleNavigate}>
      {renderPage()}
    </AppLayout>
  );
}
