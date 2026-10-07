import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { purchaseFileController, uploadPurchaseFile } from './files-controller';

const router = Router();

router.use(authenticate);

// Anyone who can attach a photo to a purchase file may upload one: the delivery note, an invoice, a proof of payment, an extra document.
router.post(
  '/uploads',
  requireCapability('orders.request', 'orders.receive', 'orders.approve', 'payables.record_deposit', 'payables.record_invoice', 'payables.record_payment'),
  uploadPurchaseFile,
  purchaseFileController.upload,
);

// Viewing: the service withholds invoice and payment files from a caller blind to financials.
router.get('/uploads/:id/url', requireCapability('orders.read', 'payables.read'), purchaseFileController.download);

export default router;
