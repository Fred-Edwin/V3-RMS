import type { Request, Response } from 'express';
import { branchService } from '../services/branch-service';
import { createBranchSchema, updateBranchSchema, updateBranchProfileSchema, branchIdParamSchema } from '../validators/branch-schemas';

export const branchController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    const branches = await branchService.listBranches();

    res.status(200).json({
      success: true,
      data: branches,
    });
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const data = createBranchSchema.parse(req.body);
    const branch = await branchService.createBranch(data);

    res.status(201).json({
      success: true,
      data: branch,
      message: 'Branch created successfully',
    });
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const data = updateBranchSchema.parse(req.body);
    const { id: branchId } = branchIdParamSchema.parse(req.params);
    const branch = await branchService.updateBranch(branchId, data);

    res.status(200).json({
      success: true,
      data: branch,
      message: 'Branch updated successfully',
    });
  },

  getProfile: async (req: Request, res: Response): Promise<void> => {
    const { id: branchId } = branchIdParamSchema.parse(req.params);
    const branch = await branchService.getBranchProfile(branchId);

    res.status(200).json({
      success: true,
      data: branch,
    });
  },

  updateProfile: async (req: Request, res: Response): Promise<void> => {
    const { id: branchId } = branchIdParamSchema.parse(req.params);
    const data = updateBranchProfileSchema.parse(req.body);
    const branch = await branchService.updateBranchProfile(branchId, req.user!, data);

    res.status(200).json({
      success: true,
      data: branch,
      message: 'Branch details updated successfully',
    });
  },

  setHub: async (req: Request, res: Response): Promise<void> => {
    const { id: branchId } = branchIdParamSchema.parse(req.params);
    const branch = await branchService.setHubBranch(branchId);

    res.status(200).json({
      success: true,
      data: branch,
      message: `${branch.name} set as hub branch`,
    });
  },
};
