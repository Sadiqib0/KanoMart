-- Kano Mart backend schema baseline.
-- This is the database contract we will move toward when PostgreSQL is added.

CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'vendor', 'admin')),
  delivery_address TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ha')),
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendor_applications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX vendor_applications_status_idx ON vendor_applications(status);

CREATE TABLE products (
  id UUID PRIMARY KEY,
  vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_ha TEXT NOT NULL,
  description_en TEXT,
  description_ha TEXT,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  quantity_available INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  area TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  listing_status TEXT NOT NULL DEFAULT 'active' CHECK (listing_status IN ('active', 'out_of_stock', 'taken_down')),
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'hidden', 'rejected')),
  review_note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_vendor_user_id_idx ON products(vendor_user_id);
CREATE INDEX products_public_catalog_idx ON products(category, moderation_status, listing_status);

CREATE TABLE cart_items (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_option TEXT NOT NULL CHECK (delivery_option IN ('delivery', 'pickup')),
  delivery_address TEXT,
  delivery_area TEXT NOT NULL,
  delivery_fee INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  payment_method TEXT NOT NULL,
  payment_reference TEXT NOT NULL UNIQUE,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  items_subtotal INTEGER NOT NULL CHECK (items_subtotal >= 0),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  commission_total INTEGER NOT NULL DEFAULT 0 CHECK (commission_total >= 0),
  vendor_payout_total INTEGER NOT NULL DEFAULT 0 CHECK (vendor_payout_total >= 0),
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation' CHECK (
    status IN ('awaiting_confirmation', 'preparing_order', 'ready_for_pickup', 'assigned_to_rider', 'out_for_delivery', 'delivered', 'cancelled')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name_en TEXT NOT NULL,
  name_ha TEXT NOT NULL,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  original_unit_price INTEGER NOT NULL CHECK (original_unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0),
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  promotion_id UUID,
  commission_rate NUMERIC(5, 4) NOT NULL,
  commission_amount INTEGER NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
  vendor_payout INTEGER NOT NULL DEFAULT 0 CHECK (vendor_payout >= 0)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL,
  gateway TEXT NOT NULL CHECK (gateway IN ('manual', 'paystack', 'monnify', 'flutterwave', 'prototype')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  admin_note TEXT,
  verified_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wallet_ledger (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('vendor_pending_credit', 'platform_commission', 'vendor_withdrawal_debit')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'available')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  available_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_customer_user_id_idx ON orders(customer_user_id);
CREATE INDEX order_items_vendor_user_id_idx ON order_items(vendor_user_id);
CREATE INDEX payments_status_idx ON payments(status);
CREATE INDEX wallet_ledger_vendor_user_id_idx ON wallet_ledger(vendor_user_id);

CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  audience TEXT NOT NULL CHECK (audience IN ('customer', 'vendor', 'admin')),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wishlists (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  hidden BOOLEAN NOT NULL DEFAULT false,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE promotions (
  id UUID PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_ha TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discount_code', 'flash_sale', 'featured_product', 'featured_vendor', 'seasonal_campaign')),
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
  code TEXT,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payout_requests (
  id UUID PRIMARY KEY,
  vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  admin_note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE categories (
  key TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ha TEXT NOT NULL,
  search_terms TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_views (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  views INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);

CREATE TABLE search_events (
  id UUID PRIMARY KEY,
  query TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_user_id_idx ON notifications(recipient_user_id, read_at);
CREATE INDEX reviews_product_id_idx ON reviews(product_id);
CREATE INDEX reviews_vendor_user_id_idx ON reviews(vendor_user_id);
CREATE INDEX promotions_active_idx ON promotions(active, code, category);
CREATE INDEX payout_requests_vendor_user_id_idx ON payout_requests(vendor_user_id);
CREATE INDEX search_events_query_idx ON search_events(query);
