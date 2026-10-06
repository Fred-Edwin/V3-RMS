import { Router } from 'express';
import filesRoutes from './files/files-routes';
import needsRestockingRoutes from './needs-restocking/needs-restocking-routes';
import ordersRoutes from './orders/orders-routes';
import receivingRoutes from './receiving/receiving-routes';
import payablesRoutes from './payables/payables-routes';
import supplierAccountRoutes from './supplier-account/supplier-account-routes';

// Every Purchasing route lives under /inventory/purchasing. The six folders have no path in common
// (files: /uploads, needs-restocking: /needs-restocking and /catalog, orders: /summary and /orders,
// receiving: /orders/:id/receive, payables: /orders/:id/deposits|invoice|documents, /invoices, /payments,
// supplier-account: /suppliers/:id/orders|statement). Each router authenticates and gates by capability itself.
const router = Router();

router.use('/inventory/purchasing', filesRoutes);
router.use('/inventory/purchasing', needsRestockingRoutes);
router.use('/inventory/purchasing', ordersRoutes);
router.use('/inventory/purchasing', receivingRoutes);
router.use('/inventory/purchasing', payablesRoutes);
router.use('/inventory/purchasing', supplierAccountRoutes);

export default router;
