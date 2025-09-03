import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import BuilderPage from "./features/builder/BuilderPage";
import DexPage from "./features/dex/DexPage";
import MonsterDetailPage from "./features/dex/MonsterDetailPage";
import SavedTeamPage from "./features/teams/SavedTeamPage";
import TeamsListPage from "./features/teams/TeamsListPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <BuilderPage /> },
      { path: "build", element: <BuilderPage /> },
      { path: "dex", element: <DexPage /> },
      { path: "dex/monsters/:id", element: <MonsterDetailPage /> },
      { path: "teams", element: <TeamsListPage /> },
      { path: "teams/:id", element: <SavedTeamPage /> }
    ]
  }
]);

export default router;