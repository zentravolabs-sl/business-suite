import { SupplierForm } from "@/components/suppliers/supplier-form";

export const metadata = {
  title: "New Supplier | Zentravo BMS",
};

export default function NewSupplierPage() {
  return (
    <div className="py-2">
      <SupplierForm />
    </div>
  );
}
