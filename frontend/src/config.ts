export const BACKEND_URL = window.location.origin.includes('localhost') ? 'http://localhost:8080' : '';
export const VIRTUAL_MARKETER_API_KEY = "M1e5wYxM-n3y1-gj4c-AZos-APbsnvg9TWxN";
export const VIRTUAL_MARKETER_LOGO_URL = 'http://virtual-marketer.de/wp-content/uploads/2023/04/cropped-Virtual-Marketer-Logo-128x128-New.png';
export const CORS_PROXY_URL = `${BACKEND_URL}/api/proxy-feed?url=`;

export const MANDATORY_FIELDS = ['id', 'title', 'brand', 'description', 'image_link', 'price', 'gtin', 'mpn'];
export const COGS_FIELD_NAME = 'cost_of_goods_sold';
export const MANDATORY_FIELDS_FOR_ANALYSIS = [...MANDATORY_FIELDS, COGS_FIELD_NAME];

export const GOOGLE_SHOPPING_ATTRIBUTES = [
  'id', 'title', 'description', 'link', 'image_link', 'additional_image_link', 'mobile_link',
  'availability', 'availability_date', 'cost_of_goods_sold', 'expiration_date', 'price',
  'sale_price', 'sale_price_effective_date', 'unit_pricing_measure', 'unit_pricing_base_measure',
  'installment', 'subscription_cost', 'google_product_category', 'product_type', 'brand', 'gtin',
  'mpn', 'identifier_exists', 'condition', 'adult', 'multipack', 'is_bundle', 'energy_efficiency_class',
  'min_energy_efficiency_class', 'max_energy_efficiency_class', 'age_group', 'color', 'gender',
  'material', 'pattern', 'size', 'size_type', 'size_system', 'item_group_id', 'custom_label_0',
  'custom_label_1', 'custom_label_2', 'custom_label_3', 'custom_label_4', 'promotion_id', 'shipping',
  'shipping_label', 'shipping_weight', 'shipping_length', 'shipping_width', 'shipping_height',
  'transit_time_label', 'min_handling_time', 'max_handling_time', 'tax', 'tax_category',
  'ads_redirect', 'product_detail', 'product_highlight', 'lifestyle_image_link', 'ads_labels',
  'ads_grouping', 'display_ads_id', 'display_ads_link', 'display_ads_title', 'display_ads_value',
  'promotion_destination_ids', 'promotion_effective_dates', 'excluded_destination', 'included_destination',
].sort();
export const DO_NOT_IMPORT_VALUE = "--- DO_NOT_IMPORT ---";
