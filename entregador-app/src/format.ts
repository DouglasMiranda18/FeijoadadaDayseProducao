import type { DeliveryOrder, OrderItem, OrderStatus } from './types';

export const colors = {
  wine: '#7d1720', darkWine: '#561017', orange: '#d8560a', cream: '#fff9f1',
  paper: '#f7eee4', ink: '#2e1712', muted: '#806f68', green: '#159447', border: '#eadfd5', white: '#ffffff'
};

export function friendlyOrderId(id: string) {
  return `#FD${id.slice(-4).toUpperCase()}`;
}

export function money(value: number | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

export function addressOf(order: DeliveryOrder) {
  const d = order.delivery || {};
  return [d.street, d.number, d.neighborhood, d.city, d.cep].filter(Boolean).join(', ');
}

export function phoneLinks(order: DeliveryOrder) {
  const digits = String(order.customer?.phone || '').replace(/\D/g, '');
  const international = digits.startsWith('55') ? digits : `55${digits}`;
  const firstName = String(order.customer?.name || 'cliente').split(/\s+/)[0];
  const message = `Olá, ${firstName}! Sou o entregador da Feijoada da Dayse e estou a caminho com o pedido ${friendlyOrderId(order.id)}.`;
  return { phone: digits ? `tel:+${international}` : '', whatsapp: digits ? `https://wa.me/${international}?text=${encodeURIComponent(message)}` : '' };
}

export function navigationLinks(order: DeliveryOrder) {
  const destination = order.delivery?.latitude != null && order.delivery?.longitude != null
    ? `${order.delivery.latitude},${order.delivery.longitude}` : addressOf(order);
  const encoded = encodeURIComponent(destination);
  return {
    maps: `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving&dir_action=navigate`,
    waze: `https://waze.com/ul?q=${encoded}&navigate=yes`
  };
}

export function beverages(items: OrderItem[] = []) {
  return items.filter((item) => /bebida|refrigerante|suco|água|agua|cerveja|coca|guaraná|guarana/i.test(`${item.category || ''} ${item.name}`));
}

export const statusCopy: Record<OrderStatus, string> = {
  received: 'Recebido', confirmed: 'Confirmado', preparing: 'Em preparo', ready: 'Pronto para sair',
  out_for_delivery: 'Entrega em andamento', arrived: 'Você chegou', delivered: 'Entregue', cancelled: 'Cancelado'
};
