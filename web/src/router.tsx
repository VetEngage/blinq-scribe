import { createBrowserRouter } from "react-router";
import { AuthGate } from "./screens/AuthGate";
import { Shell } from "./screens/Shell";
import { Home } from "./screens/Home";
import { NotesScreen } from "./screens/Notes";
import { SignIn } from "./screens/SignIn";
import { AcceptInvite } from "./screens/AcceptInvite";
import { ResetPassword } from "./screens/ResetPassword";
import { VisitScreen } from "./screens/visit/VisitScreen";
import { HouseholdRedirect, PatientRedirect, RecordScreen } from "./screens/record/RecordScreen";
import { EndOfDayScreen } from "./screens/EndOfDay";
import { TeamScreen } from "./screens/Team";
import { AccountScreen } from "./screens/account/Account";
import { LetterScreen } from "./screens/record/LetterScreen";

// Each screen of the console is its own route, so the back button and a reload land where the vet was.
export const router = createBrowserRouter([
  { path: "/sign-in", element: <SignIn /> },
  { path: "/invite", element: <AcceptInvite /> },
  { path: "/reset-password", element: <ResetPassword /> },
  // The component gallery: dev builds and the demo clinic only, loaded on its own, linked from nowhere.
  { path: "/ui", lazy: () => import("./screens/Gallery").then((m) => ({ Component: m.GalleryScreen })) },
  {
    element: <AuthGate />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <Home /> },
          // The old Morning address lands on Home, which changes with the moment.
          { path: "morning", element: <Home /> },
          { path: "notes", element: <NotesScreen /> },
          { path: "visit/:appointmentId", element: <VisitScreen /> },
          { path: "record/:clientId", element: <RecordScreen /> },
          { path: "patient/:patientId/letters/:letterId", element: <LetterScreen /> },
          // The old patient and household pages land on the record.
          { path: "patient/:patientId", element: <PatientRedirect /> },
          { path: "household/:clientId", element: <HouseholdRedirect /> },
          { path: "end-of-day", element: <EndOfDayScreen /> },
          { path: "team", element: <TeamScreen /> },
          { path: "account", element: <AccountScreen /> },
        ],
      },
    ],
  },
]);
