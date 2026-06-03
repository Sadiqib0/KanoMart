import type { Product, ProductModerationRecord, ProductModerationStatus } from "./types";
import { products, storageKeys } from "./data";
import { getStoredList, setStoredList, createId } from "./storage";

export interface VendorProductInput {
  vendor: string;
  vendorPhone: string;
  area: string;
  name: string;
  nameHa?: string;
  descriptionEn?: string;
  descriptionHa?: string;
  priceValue: number;
  quantityAvailable?: number;
  category: string;
  imageDataUrl?: string;
}

const categoryCopy: Record<string, { en: string; ha: string }> = {
  food: { en: "Food", ha: "Abinci" },
  fashion: { en: "Fashion", ha: "Kaya" },
  children: { en: "Children", ha: "Yara" },
  essentials: { en: "Essentials", ha: "Kayan yau da kullum" },
};

function sanitizeProductText(value: string, maxLength = 120): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function formatProductPrice(amount: number): string {
  return `NGN ${amount.toLocaleString("en-NG")}`;
}

export function getVendorProducts(): Product[] {
  return getStoredList<Product>(storageKeys.vendorProducts).map((product) => ({
    ...product,
    listingStatus: product.listingStatus ?? "active",
  }));
}

export function getLiveProducts(): Product[] {
  return getStoredList<Product>(storageKeys.liveProducts).map((product) => ({
    ...product,
    listingStatus: product.listingStatus ?? "active",
  }));
}

export function setLiveProducts(nextProducts: Product[]): void {
  setStoredList(storageKeys.liveProducts, nextProducts);
}

export function setLiveVendorProducts(nextProducts: Product[]): void {
  setStoredList(storageKeys.vendorProducts, nextProducts);
}

export function getAllProducts(): Product[] {
  const seen = new Set<string>();
  return [...products, ...getLiveProducts(), ...getVendorProducts()].filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

export function getProductModerationRecords(): ProductModerationRecord[] {
  return getStoredList<ProductModerationRecord>(storageKeys.productModeration);
}

export function getProductStatus(productId: string): ProductModerationStatus {
  // Check the separate moderation record first (written by admin actions / live sync)
  const record = getProductModerationRecords().find((r) => r.productId === productId);
  if (record) return record.status;

  // Fall back to the moderationStatus stored directly on the product object
  // (set by the API via mapApiProduct or by saveVendorProduct)
  const product = [...getLiveProducts(), ...getVendorProducts()].find((p) => p.id === productId);
  if (product?.moderationStatus) return product.moderationStatus;

  // Seed products default to approved
  return "approved";
}

export function isProductApproved(productId: string): boolean {
  return getProductStatus(productId) === "approved";
}

export function getCatalogProducts(): Product[] {
  return getAllProducts().filter(
    (product) => isProductApproved(product.id) && (product.listingStatus ?? "active") === "active"
  );
}

export function getProductById(productId: string, options: { includeModerated?: boolean } = {}): Product | undefined {
  const product = getAllProducts().find((item) => item.id === productId);
  if (!product) return undefined;
  if (options.includeModerated) return product;
  return isProductApproved(productId) && (product.listingStatus ?? "active") === "active" ? product : undefined;
}

export function saveVendorProduct(input: VendorProductInput): Product {
  const name = sanitizeProductText(input.name, 90);
  const category = categoryCopy[input.category] ?? categoryCopy.essentials;
  const product: Product = {
    id: createId(),
    name: { en: name, ha: sanitizeProductText(input.nameHa || name, 90) },
    description: {
      en: sanitizeProductText(input.descriptionEn || "", 240),
      ha: sanitizeProductText(input.descriptionHa || input.descriptionEn || "", 240),
    },
    category,
    subcategory: { en: "Vendor product", ha: "Kayan dan kasuwa" },
    price: formatProductPrice(Math.max(0, input.priceValue)),
    quantityAvailable: Math.max(0, Number(input.quantityAvailable ?? 1)),
    imageDataUrl: input.imageDataUrl,
    vendor: sanitizeProductText(input.vendor, 80),
    vendorPhone: sanitizeProductText(input.vendorPhone, 24),
    area: sanitizeProductText(input.area || "Kano", 80),
    availability:
      Number(input.quantityAvailable ?? 1) > 0
        ? { en: "Available now", ha: "Akwai yanzu" }
        : { en: "Out of stock", ha: "Ya kare" },
    listingStatus: Number(input.quantityAvailable ?? 1) > 0 ? "active" : "out_of_stock",
    // New products always start pending — admin must approve before they appear in catalog
    moderationStatus: "pending",
    accent: "#1f7b84",
    tags: [name, input.category, input.vendor, input.area].filter(Boolean).map((item) => item.toLowerCase()),
  };

  setStoredList(storageKeys.vendorProducts, [product, ...getVendorProducts()]);

  // Create the moderation record so admin dashboard shows it as "Pending"
  const records = getProductModerationRecords();
  const pendingRecord: ProductModerationRecord = {
    productId: product.id,
    status: "pending",
    reviewedAt: new Date().toISOString(),
    reviewNote: "",
  };
  setStoredList(storageKeys.productModeration, [pendingRecord, ...records]);

  return product;
}

export function getProductsForVendor(vendorPhone: string): Product[] {
  return getVendorProducts().filter((product) => product.vendorPhone === vendorPhone);
}

export function setVendorProductListingStatus(
  productId: string,
  listingStatus: NonNullable<Product["listingStatus"]>
): Product | null {
  const vendorProducts = getVendorProducts();
  const product = vendorProducts.find((item) => item.id === productId);
  if (!product) return null;

  product.listingStatus = listingStatus;
  product.availability =
    listingStatus === "active"
      ? { en: "Available now", ha: "Akwai yanzu" }
      : listingStatus === "out_of_stock"
        ? { en: "Out of stock", ha: "Ya kare" }
        : { en: "Taken down", ha: "An cire daga kasuwa" };
  setStoredList(storageKeys.vendorProducts, vendorProducts);
  return product;
}

export function updateVendorProduct(productId: string, input: Partial<VendorProductInput>): Product | null {
  const vendorProducts = getVendorProducts();
  const product = vendorProducts.find((item) => item.id === productId);
  if (!product) return null;

  if (input.name) product.name.en = sanitizeProductText(input.name, 90);
  if (input.nameHa) product.name.ha = sanitizeProductText(input.nameHa, 90);
  if (input.descriptionEn || input.descriptionHa) {
    product.description = {
      en: sanitizeProductText(input.descriptionEn ?? product.description?.en ?? "", 240),
      ha: sanitizeProductText(input.descriptionHa ?? product.description?.ha ?? "", 240),
    };
  }
  if (typeof input.priceValue === "number") product.price = formatProductPrice(Math.max(0, input.priceValue));
  if (typeof input.quantityAvailable === "number") {
    product.quantityAvailable = Math.max(0, input.quantityAvailable);
    setVendorProductListingStatus(productId, product.quantityAvailable > 0 ? "active" : "out_of_stock");
  }
  if (input.imageDataUrl) product.imageDataUrl = input.imageDataUrl;
  setStoredList(storageKeys.vendorProducts, vendorProducts);
  return product;
}

export function moderateProduct(
  productId: string,
  status: ProductModerationStatus,
  reviewNote = ""
): ProductModerationRecord | null {
  if (!getAllProducts().some((product) => product.id === productId)) return null;

  // Update the separate moderation record (used by admin dashboard / getProductStatus())
  const records = getProductModerationRecords();
  const nextRecord: ProductModerationRecord = {
    productId,
    status,
    reviewedAt: new Date().toISOString(),
    reviewNote: reviewNote.trim(),
  };
  const nextRecords = [nextRecord, ...records.filter((record) => record.productId !== productId)];
  setStoredList(storageKeys.productModeration, nextRecords);

  // Also write moderationStatus back onto the stored product object so the vendor
  // dashboard (which reads product.moderationStatus directly) stays in sync.
  const vendorProducts = getVendorProducts();
  const storedProduct = vendorProducts.find((p) => p.id === productId);
  if (storedProduct) {
    storedProduct.moderationStatus = status;
    setStoredList(storageKeys.vendorProducts, vendorProducts);
  }

  return nextRecord;
}

export function getProductStatusCounts(): Record<ProductModerationStatus, number> {
  return getAllProducts().reduce(
    (counts, product) => {
      counts[getProductStatus(product.id)] += 1;
      return counts;
    },
    { pending: 0, approved: 0, hidden: 0, rejected: 0 } as Record<ProductModerationStatus, number>
  );
}
