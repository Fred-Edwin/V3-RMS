import { Router } from 'express';
import healthRoutes from './health-routes';
import authRoutes from './auth-routes';
import branchRoutes from './branch-routes';
import staffRoutes from './staff-routes';
import menuRoutes from './menu-routes';
import orderRoutes from './order-routes';
import prepTicketRoutes from './prep-ticket-routes';
import deliveryZoneRoutes from './delivery-zone-routes';
import shiftRoutes from './shift-routes';
import shiftAssignmentRoutes from './shift-assignment-routes';
import clockRoutes from './clock-routes';
import reportRoutes from './report-routes';
import incidentRoutes from './incident-routes';
import printRoutes from './print-routes';
import houseAccountRoutes from './house-account-routes';
import corporateAccountRoutes from './corporate-account-routes';
import customerCreditRoutes from './customer-credit-routes';
import otherIncomeRoutes from './other-income-routes';
import houseAccountAuthRoutes from './house-account-auth-routes';
import staffDiscountAuthRoutes from './staff-discount-auth-routes';
import discountRoutes from './discount-routes';
import customerDiscountAuthRoutes from './customer-discount-auth-routes';
import orderCancellationAuthRoutes from './order-cancellation-auth-routes';
import commsRoutes from './comms-routes';
import hrRoutes from './hr-routes';
import staffTransferRoutes from './staff-transfer-routes';
import payslipRoutes from './payslip-routes';
import orderCorrectionRoutes from './order-correction-routes';
import locationRoutes from './location-routes';
import departmentRoutes from './department-routes';
import inventoryRoutes from '../modules/inventory/catalog/inventory-routes';
import auditLogRoutes from '../modules/inventory/audit-log/audit-log-routes';
import permissionsRoutes from '../modules/inventory/_shared/permissions-routes';
import purchasingRoutes from '../modules/inventory/purchasing/purchasing-routes';
import prepRecordRoutes from '../modules/inventory/prep/record/record-routes';
import prepRunsRoutes from '../modules/inventory/prep/runs/runs-routes';
import prepFixRoutes from '../modules/inventory/prep/fix/fix-routes';
import prepReviewRoutes from '../modules/inventory/prep/review/review-routes';
import prepRecipesRoutes from '../modules/inventory/prep/recipes/recipes-routes';
import countingRoutes from '../modules/inventory/counting/counting-routes';
import stockHubRoutes from '../modules/inventory/stock/stock-hub-routes';
import wasteHubRoutes from '../modules/inventory/waste/waste-hub-routes';
import branchWasteRoutes from '../modules/inventory/waste/branch/branch-routes';
import branchDayRoutes from '../modules/inventory/branch-day/branch-day-routes';
import requisitionsRoutes from '../modules/inventory/requisitions/requisitions-routes';
import departmentsRoutes from '../modules/inventory/departments/departments-routes';
import dispatchRoutes from '../modules/inventory/dispatch/dispatch-routes';
import carriersRoutes from '../modules/inventory/dispatch/carriers-routes';
import deliveriesRoutes from '../modules/inventory/deliveries/deliveries-routes';
import discrepanciesRoutes from '../modules/inventory/discrepancies/discrepancies-routes';
import { workforcePermissionsRouter, workforceRulesRouter } from '../modules/workforce';

const apiRouter = Router();

apiRouter.use(healthRoutes);
apiRouter.use(authRoutes);
apiRouter.use(branchRoutes);
apiRouter.use(staffRoutes);
apiRouter.use(menuRoutes);
apiRouter.use(orderRoutes);
apiRouter.use(prepTicketRoutes);
apiRouter.use(deliveryZoneRoutes);
apiRouter.use(shiftRoutes);
apiRouter.use(shiftAssignmentRoutes);
apiRouter.use(clockRoutes);
apiRouter.use(reportRoutes);
apiRouter.use(incidentRoutes);
apiRouter.use(printRoutes);
apiRouter.use(houseAccountRoutes);
apiRouter.use(corporateAccountRoutes);
apiRouter.use(customerCreditRoutes);
apiRouter.use(otherIncomeRoutes);
apiRouter.use(houseAccountAuthRoutes);
apiRouter.use(staffDiscountAuthRoutes);
apiRouter.use(discountRoutes);
apiRouter.use(customerDiscountAuthRoutes);
apiRouter.use(orderCancellationAuthRoutes);
apiRouter.use(commsRoutes);
apiRouter.use(hrRoutes);
apiRouter.use(staffTransferRoutes);
apiRouter.use(payslipRoutes);
apiRouter.use(orderCorrectionRoutes);
apiRouter.use(locationRoutes);
apiRouter.use(departmentRoutes);
apiRouter.use(inventoryRoutes);
apiRouter.use(auditLogRoutes);
apiRouter.use(permissionsRoutes);
apiRouter.use(purchasingRoutes);
apiRouter.use(prepRecordRoutes);
apiRouter.use(prepReviewRoutes); // before prepRunsRoutes: `/runs/export` must win over `/runs/:id`
apiRouter.use(prepRunsRoutes);
apiRouter.use(prepFixRoutes);
apiRouter.use('/inventory/prep', prepRecipesRoutes);
// The Stock, Counting and Waste rebuild (feat/stock-count-waste): new paths under /inventory/stock, none shared with the old
// routers above, which are deleted at release. Each aggregator lists its folders; the build sessions fill the folder routers.
apiRouter.use(countingRoutes);
apiRouter.use(stockHubRoutes);
apiRouter.use(wasteHubRoutes);
// Final pass, Block 3 (docs/features/inventory/branch-waste-contract.md): the rebuilt Branch waste, BW1 to BW7. It replaces the Department
// Head's three old endpoints under /inventory/waste, which are gone.
apiRouter.use('/inventory/branch-waste', branchWasteRoutes);
// Final pass, Block 4 (docs/features/inventory/branch-day-contract.md): the rebuilt Branch day, BD1 to BD21. It replaces the old
// /branch-day router, the reopen, the KES threshold and the branch thresholds endpoints, which are gone.
apiRouter.use('/inventory/branch-day', branchDayRoutes);
// Final pass, Block 1 (docs/features/inventory/requisitions-contract.md): the rebuilt Requisitions and Departments, new paths
// under /inventory/requisitions and /inventory/departments.
apiRouter.use('/inventory/requisitions', requisitionsRoutes);
apiRouter.use('/inventory/departments', departmentsRoutes);
// Final pass, Block 2 (docs/features/inventory/dispatch-contract.md): the rebuilt Dispatch, Carriers, Deliveries and Discrepancies.
// Dispatch and Carriers (back end C), Deliveries and Discrepancies (back end D) are all filled. The old /dispatch, /deliveries and
// /discrepancies router (Milestone Five) is deleted.
apiRouter.use('/inventory/dispatch', dispatchRoutes);
apiRouter.use('/inventory/carriers', carriersRoutes);
apiRouter.use('/inventory/deliveries', deliveriesRoutes);
apiRouter.use('/inventory/discrepancies', discrepanciesRoutes);
apiRouter.use(workforcePermissionsRouter);
apiRouter.use(workforceRulesRouter);

export default apiRouter;
