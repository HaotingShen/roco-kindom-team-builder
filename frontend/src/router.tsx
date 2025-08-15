import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import BuilderPage from "./features/builder/BuilderPage";
import AnalyzePage from "./features/analyze/AnalyzePage";
import DexPage from "./features/dex/DexPage";
import SavedTeamPage from "./features/teams/SavedTeamPage";
import TeamsListPage from "./features/teams/TeamsListPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <BuilderPage /> },
      { path: "build", element: <BuilderPage /> },
      { path: "analyze", element: <AnalyzePage /> },
      { path: "dex", element: <DexPage /> },
      { path: "teams", element: <TeamsListPage /> },
      { path: "teams/:id", element: <SavedTeamPage /> }
    ]
  }
]);

export default router;