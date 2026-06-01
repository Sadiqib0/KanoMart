import type { Product } from "../backend/types";
import { moderateProduct, setLiveProducts } from "../backend/products";
import { setLiveVendorRequests } from "../backend/vendors";
import { api, type ApiProduct, type ApiVendorApplication } from "./api-client";

const categoryLabels: Record<string, Product["category"]> = {
  food: { en: "Food", ha: "Abinci" },
  fashion: { en: "Fashion", ha: "Kaya" },
  children: { en: "Children", ha: "Yara" },
  essentials: { en: "Essentials", ha: "Kayan yau da kullum" },
};

function formatApiPrice(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString("en-NG")}`;
}

function mapApiProduct(product: ApiProduct): Product {
  const nameEn = product.name?.en || product.name?.ha || "Product";
  const nameHa = product.name?.ha || product.name?.en || nameEn;
  const category = categoryLabels[product.category] ?? {
    en: product.category || "Essentials",
    ha: product.category || "Kayan yau da kullum",
  };

  return {
    id: product.id,
    name: { en: nameEn, ha: nameHa },
    description: {
      en: product.description?.en || "",
      ha: product.description?.ha || product.description?.en || "",
    },
    category,
    subcategory: { en: "Live vendor product", ha: "Kayan dillali live" },
    price: formatApiPrice(product.price),
    quantityAvailable: product.quantityAvailable ?? 0,
    imageDataUrl: product.imageUrl,
    vendor: product.vendorName || "Kano Mart vendor",
    vendorPhone: product.vendorPhone,
    area: product.area || "Kano",
    availability:
      (product.quantityAvailable ?? 0) > 0
        ? { en: "Available now", ha: "Akwai yanzu" }
        : { en: "Out of stock", ha: "Ya kare" },
    listingStatus: product.listingStatus ?? "active",
    accent: "#176b4d",
    tags: [nameEn, nameHa, product.category, product.vendorName, product.area, ...(product.tags ?? [])]
      .filter(Boolean)
      .map((item) => String(item).toLowerCase()),
  };
}

export async function refreshLiveProducts(query = ""): Promise<Product[]> {
  const response = await api.products(query);
  const products = response.products.map(mapApiProduct);
  setLiveProducts(products);
  return products;
}

function mapApiVendorApplication(application: ApiVendorApplication) {
  return {
    id: application.id,
    businessName: application.businessName,
    phone: application.phone,
    area: application.area,
    category: application.category,
    status: application.status,
    reviewedAt: application.reviewedAt,
    reviewNote: application.adminNote,
    createdAt: application.createdAt,
  };
}

export async function refreshLiveAdminQueues(): Promise<void> {
  const [vendors, products] = await Promise.all([api.adminVendorApplications(), api.adminProducts()]);
  setLiveVendorRequests(vendors.applications.map(mapApiVendorApplication));
  setLiveProducts(products.products.map(mapApiProduct));
  for (const product of products.products) {
    if (product.moderationStatus) {
      moderateProduct(product.id, product.moderationStatus, "Synced from live admin API");
    }
  }
}
