import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function StoreIndexPage() {
  const store = await prisma.onlineStore.findFirst({
    where: { isPublished: true },
    select: { slug: true },
    orderBy: { createdAt: "asc" },
  });

  if (store) {
    redirect(`/store/${store.slug}`);
  }

  // Fallback if no store created yet
  redirect("/store/abc-electronics");
}
