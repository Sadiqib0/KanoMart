// Resend email integration — https://resend.com
// Set RESEND_API_KEY in env vars. Falls back gracefully if not set.
// Set EMAIL_FROM to your verified sender (e.g. "Kano Mart <noreply@yourapp.ng>")

const RESEND_URL = "https://api.resend.com/emails";
const GREEN = "#176b4d";
const LIGHT = "#f4f6f1";

function base(content, previewText = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kano Mart</title>
</head>
<body style="margin:0;padding:0;background:#f0f2ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2ed;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0" border="0">
        <!-- Header -->
        <tr>
          <td style="background:${GREEN};border-radius:12px 12px 0 0;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="display:inline-block;background:rgba(255,255,255,0.15);color:#fff;font-weight:900;font-size:14px;padding:4px 10px;border-radius:6px;letter-spacing:0.5px;">KM</span>
                  <span style="color:#fff;font-weight:700;font-size:18px;margin-left:10px;vertical-align:middle;">Kano Mart</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px 32px 24px;border-radius:0 0 12px 12px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 0;text-align:center;">
            <p style="margin:0;color:#888;font-size:12px;">Kano Mart · Your trusted local marketplace</p>
            <p style="margin:4px 0 0;color:#aaa;font-size:11px;">You're receiving this because you have an account on Kano Mart.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function heading(text) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#151a17;line-height:1.2;">${text}</h1>`;
}

function subtext(text) {
  return `<p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">${text}</p>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #e8ebe5;margin:20px 0;" />`;
}

function pill(label, color = GREEN) {
  return `<span style="display:inline-block;background:${color}20;color:${color};font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;">${label}</span>`;
}

function ctaButton(label, url) {
  return `<a href="${url}" style="display:inline-block;background:${GREEN};color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:12px 28px;border-radius:8px;margin:8px 0;">${label}</a>`;
}

function kv(label, value) {
  return `<tr>
    <td style="padding:8px 0;font-size:14px;color:#666;width:45%;">${label}</td>
    <td style="padding:8px 0;font-size:14px;color:#151a17;font-weight:600;">${value}</td>
  </tr>`;
}

function orderItemsTable(items) {
  const rows = items.map((item) => `
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#151a17;border-bottom:1px solid #f0f0f0;">${item.name?.en ?? item.name ?? "Product"}</td>
      <td style="padding:8px 0;font-size:14px;color:#555;border-bottom:1px solid #f0f0f0;text-align:center;">×${item.quantity}</td>
      <td style="padding:8px 0;font-size:14px;color:#151a17;font-weight:600;border-bottom:1px solid #f0f0f0;text-align:right;">₦${Number(item.lineTotal ?? 0).toLocaleString()}</td>
    </tr>`).join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
    <thead>
      <tr>
        <th style="text-align:left;font-size:12px;color:#888;padding:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Item</th>
        <th style="text-align:center;font-size:12px;color:#888;padding:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
        <th style="text-align:right;font-size:12px;color:#888;padding:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function orderConfirmationEmail(order, customerName) {
  const siteUrl = process.env.CORS_ORIGIN ?? "https://kano-mart.vercel.app";
  return base(
    `${heading("Order received!")}
     ${subtext(`Hi ${customerName}, your order has been placed and is awaiting confirmation. We'll update you as it progresses.`)}
     ${divider()}
     <table width="100%" cellpadding="0" cellspacing="0" border="0">
       ${kv("Order ID", order.id)}
       ${kv("Payment", order.paymentStatus === "paid" ? "✅ Paid" : "⏳ Pending payment")}
       ${kv("Delivery", order.deliveryOption === "pickup" ? "Pickup" : order.deliveryArea)}
       ${kv("Total", `₦${Number(order.subtotal ?? 0).toLocaleString()}`)}
     </table>
     ${order.items?.length ? orderItemsTable(order.items) : ""}
     ${divider()}
     ${ctaButton("Track your order", `${siteUrl}/#orders`)}`,
    `Order ${order.id} received — ₦${Number(order.subtotal ?? 0).toLocaleString()}`
  );
}

export function orderStatusEmail(order, customerName) {
  const statusLabels = {
    preparing_order: { label: "Preparing", color: "#d69b2d", desc: "Your vendor is preparing your order." },
    ready_for_pickup: { label: "Ready for pickup", color: GREEN, desc: "Your order is ready. You can pick it up now." },
    assigned_to_rider: { label: "Assigned to rider", color: "#1d7881", desc: "A rider has been assigned to deliver your order." },
    out_for_delivery: { label: "Out for delivery", color: "#1d7881", desc: "Your order is on its way!" },
    delivered: { label: "Delivered", color: GREEN, desc: "Your order has been delivered. Enjoy!" },
    cancelled: { label: "Cancelled", color: "#b64232", desc: "Your order has been cancelled." },
  };
  const s = statusLabels[order.status] ?? { label: order.status, color: GREEN, desc: "Your order status has been updated." };
  const siteUrl = process.env.CORS_ORIGIN ?? "https://kano-mart.vercel.app";
  return base(
    `${heading("Order update")}
     ${pill(s.label, s.color)}
     <p style="margin:12px 0 20px;font-size:15px;color:#444;line-height:1.6;">Hi ${customerName}, ${s.desc}</p>
     ${divider()}
     <table width="100%" cellpadding="0" cellspacing="0" border="0">
       ${kv("Order ID", order.id)}
       ${kv("Status", s.label)}
     </table>
     ${divider()}
     ${ctaButton("View order details", `${siteUrl}/#orders`)}`,
    `Order ${order.id} is now ${s.label}`
  );
}

export function paymentStatusEmail(order, customerName, status) {
  const isSuccess = status === "paid";
  const siteUrl = process.env.CORS_ORIGIN ?? "https://kano-mart.vercel.app";
  return base(
    `${heading(isSuccess ? "Payment confirmed ✅" : status === "failed" ? "Payment failed ❌" : "Payment refunded")}
     ${subtext(`Hi ${customerName}, ${isSuccess ? "we've confirmed your payment for order" : status === "failed" ? "we were unable to process your payment for order" : "your payment for order"} ${order.id}.`)}
     ${divider()}
     <table width="100%" cellpadding="0" cellspacing="0" border="0">
       ${kv("Order ID", order.id)}
       ${kv("Amount", `₦${Number(order.subtotal ?? 0).toLocaleString()}`)}
       ${kv("Payment status", isSuccess ? "✅ Paid" : status === "failed" ? "❌ Failed" : "🔄 Refunded")}
     </table>
     ${divider()}
     ${ctaButton("View order", `${siteUrl}/#orders`)}`,
    `Payment ${status} for order ${order.id}`
  );
}

export function vendorApprovalEmail(vendorName, businessName, approved) {
  const siteUrl = process.env.CORS_ORIGIN ?? "https://kano-mart.vercel.app";
  return base(
    approved
      ? `${heading("Welcome to Kano Mart! 🎉")}
         ${subtext(`Congratulations ${vendorName}! Your vendor application for <strong>${businessName}</strong> has been approved. You can now list products and start selling.`)}
         ${divider()}
         <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.6;">
           Next steps:<br/>
           1. Log in to your account<br/>
           2. Go to <strong>Vendor Center → Products</strong><br/>
           3. Add your first product with a photo, price, and quantity<br/>
           4. It will go live after a quick review
         </p>
         ${ctaButton("Start selling", `${siteUrl}/#vendor`)}`
      : `${heading("Vendor application update")}
         ${subtext(`Hi ${vendorName}, we've reviewed your application for <strong>${businessName}</strong> and are unable to approve it at this time.`)}
         ${divider()}
         <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">If you believe this is an error or would like to reapply with additional information, please contact our support team.</p>`,
    approved ? `Your store ${businessName} is approved and ready` : `Update on your vendor application`
  );
}

export function vendorNewOrderEmail(vendorName, order) {
  const siteUrl = process.env.CORS_ORIGIN ?? "https://kano-mart.vercel.app";
  const vendorItems = order.items?.filter((i) => i.vendorName === vendorName || true) ?? [];
  return base(
    `${heading("New order received!")}
     ${subtext(`Hi ${vendorName}, you have a new order that needs your attention.`)}
     ${divider()}
     <table width="100%" cellpadding="0" cellspacing="0" border="0">
       ${kv("Order ID", order.id)}
       ${kv("Payment", order.paymentStatus === "paid" ? "✅ Paid" : "⏳ Pending")}
       ${kv("Delivery", order.deliveryOption === "pickup" ? "Customer pickup" : `Deliver to ${order.deliveryArea}`)}
     </table>
     ${vendorItems.length ? orderItemsTable(vendorItems) : ""}
     ${divider()}
     ${ctaButton("View order queue", `${siteUrl}/#vendor`)}`,
    `New order ${order.id} is waiting`
  );
}

export function payoutDecisionEmail(vendorName, amount, approved) {
  const siteUrl = process.env.CORS_ORIGIN ?? "https://kano-mart.vercel.app";
  return base(
    `${heading(approved ? "Payout approved ✅" : "Payout update")}
     ${subtext(approved
       ? `Hi ${vendorName}, your payout request of ₦${Number(amount).toLocaleString()} has been approved and is being processed.`
       : `Hi ${vendorName}, we were unable to process your payout request of ₦${Number(amount).toLocaleString()} at this time. Please contact support for details.`
     )}
     ${divider()}
     ${ctaButton("View wallet", `${siteUrl}/#vendor`)}`,
    `Payout of ₦${Number(amount).toLocaleString()} ${approved ? "approved" : "update needed"}`
  );
}

// ── Sender ────────────────────────────────────────────────────────────────────

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return; // graceful no-op — email is best-effort

  const from = process.env.EMAIL_FROM ?? "Kano Mart <onboarding@resend.dev>";

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Resend error:", res.status, err.slice(0, 200));
    }
  } catch (err) {
    console.error("[email] Send failed:", err?.message ?? err);
  }
}
