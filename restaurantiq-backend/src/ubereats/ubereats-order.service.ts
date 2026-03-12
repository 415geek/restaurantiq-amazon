import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DeliveryGateway } from '../delivery/delivery.gateway';

type DeliveryOrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

type UberWebhookOrder = {
  id: string;
  channelOrderId: string;
  customerName: string;
  status: DeliveryOrderStatus;
  placedAt: string;
  amount: number;
  etaMins: number;
  items: string[];
  notes?: string;
  storeId?: string;
  raw: Record<string, unknown>;
  receivedAt: string;
};

@Injectable()
export class UberEatsOrderService {
  constructor(
    private prisma: PrismaService,
    private deliveryGateway: DeliveryGateway,
  ) {}

  /**
   * Parse Uber Eats webhook payload to normalized order
   */
  parseWebhookOrder(payload: any, storeId?: string): UberWebhookOrder | null {
    const orderRecord = this.findOrderRecord(payload);
    const id = this.pickString(orderRecord, ['id', 'order_id', 'orderId', 'uuid', 'order.uuid', 'order.id']) ??
                 this.pickString(payload, ['id', 'order_id', 'orderId', 'uuid']);
    
    if (!id) return null;

    const status = this.statusFromTopic(
      this.pickString(orderRecord, ['status', 'state', 'fulfillment_status']) ??
      payload.eventType ??
      payload.topic ??
      null
    ) ?? 'new';

    const channelOrderId = this.pickString(orderRecord, ['display_id', 'order_number', 'order_id', 'orderId', 'id']) ?? id;

    const customerName = this.pickString(orderRecord, [
      'customer_name',
      'customer.name',
      'consumer.name',
      'delivery.recipient_name',
      'eater.name',
      'eater.first_name',
    ]) ?? this.pickString(payload, ['customer_name', 'customer.name']) ?? 'Unknown';

    const placedAt = this.normalizeIso(
      this.readByPath(orderRecord, 'created_at') ??
      this.readByPath(orderRecord, 'createdAt') ??
      this.readByPath(orderRecord, 'placed_at') ??
      this.readByPath(orderRecord, 'requested_at') ??
      this.readByPath(orderRecord, 'timestamps.created_at') ??
      payload.created_at,
      new Date().toISOString()
    );

    const amount = this.pickNumber(orderRecord, [
      'total',
      'total_amount',
      'total.value',
      'payment.total.amount',
      'price.total.amount',
      'basket.total.amount',
      'order_total',
      'subtotal',
    ]) ?? this.pickNumber(payload, ['total', 'total_amount']) ?? 0;

    const etaMins = Math.max(
      0,
      Math.round(
        this.pickNumber(orderRecord, [
          'eta_mins',
          'eta_minutes',
          'estimated_prep_time_minutes',
          'fulfillment.eta_minutes',
        ]) ?? 0
      )
    );

    const items = this.extractItemNames(orderRecord);
    const notes = this.pickString(orderRecord, ['notes', 'special_instructions', 'delivery_notes', 'customer_note']) ??
                  this.pickString(payload, ['notes', 'special_instructions']) ??
                  undefined;

    return {
      id,
      channelOrderId,
      customerName,
      status,
      placedAt,
      amount,
      etaMins,
      items,
      notes,
      storeId,
      raw: orderRecord,
      receivedAt: new Date().toISOString(),
    };
  }

  /**
   * Save order to database
   */
  async saveOrder(tenantId: string, order: UberWebhookOrder): Promise<void> {
    // Check if order already exists
    const existingOrder = await this.prisma.order.findUnique({
      where: {
        platform_platformOrderId: {
          platform: 'UBEREATS',
          platformOrderId: order.id,
        },
      },
    });

    if (existingOrder) {
      // Update existing order
      await this.prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          status: order.status,
          customerName: order.customerName,
          items: order.items,
          subtotal: order.amount,
          notes: order.notes,
          etaMins: order.etaMins,
          rawPayload: order.raw,
          updatedAt: new Date(),
        },
      });

      console.log(`[Uber Eats Order] Updated order ${order.id}`);
    } else {
      // Create new order
      await this.prisma.order.create({
        data: {
          tenantId,
          platform: 'UBEREATS',
          platformOrderId: order.id,
          displayOrderId: order.channelOrderId,
          status: order.status,
          customerName: order.customerName,
          items: order.items,
          subtotal: order.amount,
          total: order.amount,
          notes: order.notes,
          etaMins: order.etaMins,
          placedAt: new Date(order.placedAt),
          rawPayload: order.raw,
          source: 'WEBHOOK',
        },
      });

      console.log(`[Uber Eats Order] Created new order ${order.id}`);

      // Broadcast new order event via WebSocket
      await this.deliveryGateway.broadcastOrderEvent(tenantId, 'order:new', {
        id: order.id,
        displayOrderId: order.channelOrderId,
        platform: 'UBEREATS',
        status: order.status,
        customerName: order.customerName,
        amount: order.amount,
        items: order.items,
        placedAt: order.placedAt,
        etaMins: order.etaMins,
      });
    }
  }

  /**
   * Helper methods for parsing
   */
  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private safeString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return null;
  }

  private safeNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[$,%￥¥,]/g, '').trim();
      if (!cleaned) return null;
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readByPath(record: Record<string, unknown>, path: string) {
    const segments = path.split('.');
    let cursor: unknown = record;
    for (const segment of segments) {
      const current = this.asRecord(cursor);
      if (!current) return undefined;
      cursor = current[segment];
    }
    return cursor;
  }

  private pickString(record: Record<string, unknown>, paths: string[]): string | null {
    for (const path of paths) {
      const value = this.safeString(this.readByPath(record, path));
      if (value) return value;
    }
    return null;
  }

  private pickNumber(record: Record<string, unknown>, paths: string[]): number | null {
    for (const path of paths) {
      const value = this.safeNumber(this.readByPath(record, path));
      if (value !== null) return value;
    }
    return null;
  }

  private normalizeIso(value: unknown, fallbackIso: string): string {
    const text = this.safeString(value);
    if (!text) return fallbackIso;
    const ts = Date.parse(text);
    if (!Number.isFinite(ts)) return fallbackIso;
    return new Date(ts).toISOString();
  }

  private statusFromTopic(value: string | null): DeliveryOrderStatus | null {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (normalized.includes('cancel')) return 'cancelled';
    if (normalized.includes('complete') || normalized.includes('deliver')) return 'completed';
    if (normalized.includes('ready') || normalized.includes('pickup')) return 'ready';
    if (normalized.includes('prep') || normalized.includes('cook') || normalized.includes('kitchen')) return 'preparing';
    if (normalized.includes('accept') || normalized.includes('confirm')) return 'accepted';
    if (normalized.includes('created') || normalized.includes('new') || normalized.includes('placed')) return 'new';
    return null;
  }

  private findOrderRecord(payload: unknown): Record<string, unknown> {
    const root = this.asRecord(payload) ?? {};
    const directOrder = this.asRecord(root.order);
    if (directOrder) return directOrder;

    const data = this.asRecord(root.data);
    if (data) {
      const dataOrder = this.asRecord(data.order);
      if (dataOrder) return dataOrder;
      const hasOrderIdentity = Boolean(
        this.pickString(data, ['id', 'order_id', 'orderId', 'uuid', 'display_id', 'order_number'])
      );
      if (hasOrderIdentity) return data;
    }

    return root;
  }

  private extractItemNames(orderRecord: Record<string, unknown>): string[] {
    const candidates = [
      this.readByPath(orderRecord, 'items'),
      this.readByPath(orderRecord, 'order.items'),
      this.readByPath(orderRecord, 'line_items'),
      this.readByPath(orderRecord, 'basket.items'),
      this.readByPath(orderRecord, 'cart.items'),
    ];

    for (const candidate of candidates) {
      if (!Array.isArray(candidate)) continue;
      const names = candidate
        .map((row) => {
          const record = this.asRecord(row);
          if (!record) return null;
          return (
            this.pickString(record, ['name', 'title', 'item_name', 'product_name']) ??
            this.pickString(record, ['product.name'])
          );
        })
        .filter((value): value is string => Boolean(value));

      if (names.length) return names;
    }

    return [];
  }
}