import { BrowserRouter } from "react-router";
import AppRoutes from "./router.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
