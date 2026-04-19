import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Sales } from "./pages/Sales";
import { Inventory } from "./pages/Inventory";
import { Recipes } from "./pages/Recipes";
import { Suggestions } from "./pages/Suggestions";

function Mesh() {
  return (
    <div className="mesh-orbs" aria-hidden>
      <span />
      <span />
      <span />
    </div>
  );
}

export default function App() {
  return (
    <>
      <Mesh />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/suggestions" element={<Suggestions />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
