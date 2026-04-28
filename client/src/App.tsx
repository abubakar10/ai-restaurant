import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Sales } from "./pages/Sales";
import { Inventory } from "./pages/Inventory";
import { Recipes } from "./pages/Recipes";
import { Suggestions } from "./pages/Suggestions";
import { Items } from "./pages/Items";
import { Suppliers } from "./pages/Suppliers";
import { PoStatus } from "./pages/PoStatus";
import { Receiving } from "./pages/Receiving";
import { SupplierPortal } from "./pages/SupplierPortal";

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
          <Route path="/po/supplier/:token" element={<SupplierPortal />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/items" element={<Items />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/po-status" element={<PoStatus />} />
            <Route path="/receiving" element={<Receiving />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
