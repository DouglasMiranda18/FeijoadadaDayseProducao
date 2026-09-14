export function validateDeliveryProximity(destination, position, courierId, now = Date.now()) {
  const valid = (p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
  if (!valid(destination)) return { ok: false, message: 'O endereço não tem coordenadas válidas. Peça à loja para corrigir o destino.' };
  if (!valid(position) || position.courierId !== courierId || !Number.isFinite(position.sampledAt) || !Number.isFinite(position.updatedAt) || now - position.sampledAt > 60000 || now - position.updatedAt > 60000 || position.sampledAt > now + 10000 || position.updatedAt > now + 10000) return { ok: false, message: 'Atualize o GPS: precisamos de uma localização enviada há menos de 1 minuto.' };
  if (!Number.isFinite(position.accuracy) || position.accuracy < 0 || position.accuracy > 50) return { ok: false, message: 'GPS impreciso. Aguarde uma precisão de até 50 metros.' };
  const radians = (n) => n * Math.PI / 180;
  const lat = radians(position.latitude - destination.latitude);
  const lon = radians(position.longitude - destination.longitude);
  const a = Math.sin(lat / 2) ** 2 + Math.cos(radians(destination.latitude)) * Math.cos(radians(position.latitude)) * Math.sin(lon / 2) ** 2;
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return distance <= 100 ? { ok: true, distance } : { ok: false, distance, message: `Você está a ${Math.round(distance)} metros do destino. Chegue a até 100 metros para concluir esta etapa.` };
}
