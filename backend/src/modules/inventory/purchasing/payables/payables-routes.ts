import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { payablesController } from './payables-controller';

const router = Router();

router.use(authenticate);

router.post('/orders/:id/deposits', requireCapability('payables.record_deposit'), payablesController.recordDeposit);
router.post('/orders/:id/invoice', requireCapability('payables.record_invoice'), payablesController.addInvoice);
router.post('/orders/:id/documents', requireCapability('payables.record_invoice', 'payables.record_payment', 'orders.approve'), payablesController.addDocument);
router.post('/invoices/:id/settle-dispute', requireCapability('payables.record_invoice'), payablesController.settleDispute);
router.post('/invoices/:id/void', requireCapability('payables.record_invoice'), payablesController.voidInvoice);
router.post('/invoices/:id/payments', requireCapability('payables.record_payment'), payablesController.recordPayment);
router.post('/payments/:id/reverse', requireCapability('payables.record_payment'), payablesController.reversePayment);
router.get('/payments/:id/advice', requireCapability('payables.read'), payablesController.getAdvice);

export default router;
