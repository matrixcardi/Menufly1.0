import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

interface Category {
  id: string;
  name: string;
  sort_order: number | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean | null;
  sort_order: number;
  category_id: string | null;
  cashback: number | null;
  is_popular: boolean | null;
}

interface ProductCategoryLink {
  product_id: string;
  category_id: string;
}

const formatCurrency = (value: number) =>
  `R$ ${value.toFixed(2).replace(".", ",")}`;

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = base64;
  });
}

export async function exportMenuPDF(restaurantId: string, restaurantName: string, logoUrl?: string | null) {
  // Fetch all data in parallel
  const [categoriesRes, productsRes, linksRes, restaurantRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, sort_order")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("products")
      .select("id, name, description, price, image_url, is_active, sort_order, category_id, cashback, is_popular")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_categories")
      .select("product_id, category_id"),
    supabase
      .from("restaurants")
      .select("banner_url, description, delivery_available, pickup_available")
      .eq("id", restaurantId)
      .single(),
  ]);

  const categories = categoriesRes.data as Category[] | null;
  const products = productsRes.data as Product[] | null;
  const links = (linksRes.data || []) as ProductCategoryLink[];
  const restaurantInfo = restaurantRes.data;

  if (!categories || !products) {
    throw new Error("Não foi possível carregar os dados do cardápio");
  }

  // Pre-load all product images + logo + banner in parallel
  const imageUrls = new Set<string>();
  if (logoUrl) imageUrls.add(logoUrl);
  if (restaurantInfo?.banner_url) imageUrls.add(restaurantInfo.banner_url);
  products.forEach((p) => {
    if (p.image_url) imageUrls.add(p.image_url);
  });

  const imageCache = new Map<string, string>();
  const imageEntries = Array.from(imageUrls);
  const loaded = await Promise.all(imageEntries.map((url) => loadImageAsBase64(url)));
  imageEntries.forEach((url, i) => {
    if (loaded[i]) imageCache.set(url, loaded[i]!);
  });

  // Build category -> products map
  const getProductsForCategory = (categoryId: string): Product[] => {
    const directProducts = products.filter((p) => p.category_id === categoryId);
    const linkedProductIds = links
      .filter((l) => l.category_id === categoryId)
      .map((l) => l.product_id);
    const linkedProducts = products.filter(
      (p) => linkedProductIds.includes(p.id) && p.category_id !== categoryId
    );
    const all = [...directProducts, ...linkedProducts];
    const seen = new Set<string>();
    return all.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  };

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const checkNewPage = (needed: number) => {
    if (y + needed > pageHeight - 12) {
      doc.addPage();
      y = 10;
      return true;
    }
    return false;
  };

  // ===== BANNER =====
  const bannerHeight = 35;
  const bannerBase64 = restaurantInfo?.banner_url ? imageCache.get(restaurantInfo.banner_url) : null;
  if (bannerBase64) {
    try {
      doc.addImage(bannerBase64, "JPEG", 0, 0, pageWidth, bannerHeight);
      // Dark overlay
      doc.setFillColor(0, 0, 0);
      doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
      doc.rect(0, 0, pageWidth, bannerHeight, "F");
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
    } catch {
      doc.setFillColor(234, 88, 12); // orange
      doc.rect(0, 0, pageWidth, bannerHeight, "F");
    }
  } else {
    doc.setFillColor(234, 88, 12);
    doc.rect(0, 0, pageWidth, bannerHeight, "F");
  }
  y = bannerHeight;

  // ===== LOGO (below banner, with clear spacing) =====
  const logoSize = 20;
  const logoX = pageWidth / 2 - logoSize / 2;
  y += 5;
  const logoY = y;

  if (logoUrl && imageCache.get(logoUrl)) {
    try {
      doc.addImage(imageCache.get(logoUrl)!, "PNG", logoX, logoY, logoSize, logoSize);
      y = logoY + logoSize + 6;
    } catch {
      // skip logo
    }
  }

  // ===== RESTAURANT NAME =====
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(restaurantName, pageWidth / 2, y, { align: "center" });
  y += 8;

  // ===== DESCRIPTION =====
  if (restaurantInfo?.description) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    const descLines = doc.splitTextToSize(restaurantInfo.description, contentWidth - 20);
    for (const line of descLines) {
      doc.text(line, pageWidth / 2, y, { align: "center" });
      y += 4;
    }
    y += 1;
  }

  // ===== STATUS & DELIVERY OPTIONS (text only, no emojis) =====
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const statusParts: string[] = [];
  if (restaurantInfo?.delivery_available) statusParts.push("Entrega");
  if (restaurantInfo?.pickup_available) statusParts.push("Retirada");
  if (statusParts.length > 0) {
    doc.setTextColor(100, 100, 100);
    doc.text(statusParts.join("  |  "), pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  // Date line
  const now = new Date();
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Gerado em ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 6;

  // Divider
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ===== POPULAR PRODUCTS SECTION =====
  const popularProducts = products.filter((p) => p.is_popular);
  if (popularProducts.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Mais Pedidos", margin, y);
    y += 6;

    // Render popular as small cards in a row
    const cardW = 32;
    const cardH = 38;
    const gap = 4;
    const maxPerRow = Math.floor((contentWidth + gap) / (cardW + gap));
    let col = 0;

    for (const product of popularProducts) {
      if (col >= maxPerRow) {
        col = 0;
        y += cardH + 4;
      }
      checkNewPage(cardH + 10);

      const cx = margin + col * (cardW + gap);

      // Product image
      const imgBase64 = product.image_url ? imageCache.get(product.image_url) : null;
      if (imgBase64) {
        try {
          doc.addImage(imgBase64, "JPEG", cx, y, cardW, cardW);
        } catch {
          doc.setFillColor(240, 240, 240);
          doc.roundedRect(cx, y, cardW, cardW, 2, 2, "F");
        }
      } else {
        doc.setFillColor(240, 240, 240);
        doc.roundedRect(cx, y, cardW, cardW, 2, 2, "F");
      }

      // Name below image
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      const nameLines = doc.splitTextToSize(product.name, cardW);
      doc.text(nameLines.slice(0, 2), cx, y + cardW + 4);

      // Price
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(234, 88, 12);
      doc.text(formatCurrency(product.price), cx, y + cardW + 4 + (Math.min(nameLines.length, 2)) * 3);

      col++;
    }
    y += cardH + 8;

    // Divider after popular
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  // ===== CATEGORIES & PRODUCTS =====
  const productImgSize = 20;
  const productRowHeight = productImgSize + 4;

  for (const category of categories) {
    const catProducts = getProductsForCategory(category.id);
    if (catProducts.length === 0) continue;

    // Category header
    checkNewPage(productRowHeight + 14);

    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y - 1, contentWidth, 9, 2, 2, "F");

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(category.name, margin + 4, y + 5);
    y += 13;

    // Products - horizontal card style like the menu
    for (const product of catProducts) {
      const descLines = product.description
        ? doc.splitTextToSize(product.description, contentWidth - productImgSize - 16)
        : [];
      const textHeight = 5 + Math.min(descLines.length, 2) * 3.5 + 5;
      const rowH = Math.max(productImgSize + 2, textHeight + 2);

      checkNewPage(rowH + 4);

      const rowY = y;

      // Text side (left)
      const textX = margin + 2;
      const textMaxW = contentWidth - productImgSize - 12;
      let textY = rowY + 4;

      // Product name
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      const nameLines = doc.splitTextToSize(product.name, textMaxW);
      doc.text(nameLines.slice(0, 1).join(""), textX, textY);
      textY += 4.5;

      // Description (max 2 lines)
      if (descLines.length > 0) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(130, 130, 130);
        const showLines = descLines.slice(0, 2);
        for (const line of showLines) {
          doc.text(line, textX, textY);
          textY += 3.5;
        }
      }

      // Price
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(234, 88, 12);
      doc.text(formatCurrency(product.price), textX, textY + 1.5);

      // Cashback badge
      if (product.cashback) {
        const priceWidth = doc.getTextWidth(formatCurrency(product.price));
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setFillColor(16, 185, 129);
        const cbText = `${product.cashback}% cashback`;
        const cbW = doc.getTextWidth(cbText) + 4;
        doc.roundedRect(textX + priceWidth + 3, textY - 1, cbW, 4, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(cbText, textX + priceWidth + 5, textY + 1.5);
      }

      // Image side (right)
      const imgX = pageWidth - margin - productImgSize;
      const imgY = rowY;
      const imgBase64 = product.image_url ? imageCache.get(product.image_url) : null;
      if (imgBase64) {
        try {
          doc.addImage(imgBase64, "JPEG", imgX, imgY, productImgSize, productImgSize);
        } catch {
          doc.setFillColor(245, 245, 245);
          doc.roundedRect(imgX, imgY, productImgSize, productImgSize, 2, 2, "F");
        }
      }

      y = rowY + rowH;

      // Separator line
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.15);
      doc.line(margin + 2, y, pageWidth - margin - 2, y);
      y += 2;
    }

    y += 4;
  }

  // ===== FOOTER =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 180, 180);
    doc.text(
      `${restaurantName} • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
    doc.text("Feito com Menufly", pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  const safeName = restaurantName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  doc.save(`cardapio_${safeName}.pdf`);
}
