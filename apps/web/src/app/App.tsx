import { RouterProvider } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { router } from "./router";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Analytics />
    </>
  );
}
