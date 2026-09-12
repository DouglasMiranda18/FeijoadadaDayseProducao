export type OrderStatus = 'received' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'arrived' | 'delivered' | 'cancelled';

export type OrderItem = {
  productId?: string;
  name: string;
  category?: string;
  price?: number;
  quantity: number;
};

export type DeliveryOrder = {
  id: string;
  courierId: string;
  status: OrderStatus;
  customer?: { name?: string; phone?: string };
  delivery?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    cep?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  items?: OrderItem[];
  totals?: { total?: number };
  total?: number;
  paymentMethod?: string;
  notes?: string;
  createdAt?: { toMillis?: () => number };
};

export type DeliveryPosition = {
  courierId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  updatedAt?: number | object;
  trail?: Array<{ latitude: number; longitude: number; updatedAt: number }>;
};
