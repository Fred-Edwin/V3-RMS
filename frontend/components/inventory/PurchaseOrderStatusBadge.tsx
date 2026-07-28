import { Badge, type BadgeTone } from '@/components/ui'
import type { PurchaseOrderStatus } from '@/types/inventory'

const STATUS_TONE: Record<PurchaseOrderStatus, BadgeTone> = {
  DRAFT: 'warning',
  SENT: 'neutral',
  PARTIALLY_RECEIVED: 'neutral',
  CLOSED: 'success',
  CANCELLED: 'danger',
}

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIALLY_RECEIVED: 'Partially Received',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
}

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}
