-- Make LeaveRequest.organizationId nullable to support cross-branch roles (ACCOUNTANT)
-- who have no organizationId in their user record but are entitled to submit leave.
ALTER TABLE "leave_requests" ALTER COLUMN "organization_id" DROP NOT NULL;
