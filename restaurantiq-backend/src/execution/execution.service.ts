import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LlmRouterService } from '../llm/llm-router.service';

type ExecutionType = 'PRICE_ADJUSTMENT' | 'PROMOTION' | 'MENU_UPDATE' | 'SOCIAL_POST' | 'REVIEW_REPLY' | 'INVENTORY_ORDER';
type ExecutionStatus = 'PENDING' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'ROLLED_BACK' | 'FAILED' | 'REJECTED';

@Injectable()
export class ExecutionService {
  constructor(
    private prisma: PrismaService,
    private llmRouter: LlmRouterService,
  ) {}

  /**
   * Create execution with snapshot
   */
  async createExecution(tenantId: string, input: {
    type: ExecutionType;
    description: string;
    descriptionZh?: string;
    platform?: string;
    targetIds?: any[];
    changes: any[];
  }) {
    // Calculate impact score using Claude Opus
    const impactScore = await this.calculateImpactScore(input);

    // Create execution record
    const execution = await this.prisma.execution.create({
      data: {
        tenantId,
        type: input.type,
        status: 'PENDING',
        description: input.description,
        descriptionZh: input.descriptionZh,
        platform: input.platform,
        targetIds: input.targetIds,
        changes: input.changes,
        impactScore: impactScore.score,
        snapshotBefore: impactScore.snapshot,
      },
    });

    return execution;
  }

  /**
   * Calculate impact score using AI
   */
  private async calculateImpactScore(input: any) {
    const result = await this.llmRouter.powerfulChatJson<{
      score: number;
      snapshot: any;
      reasoning: string;
    }>({
      system: `You are a restaurant operations expert. Calculate the impact score for proposed changes.

Impact Score Formula:
Impact = (影响幅度 × 0.4) + (时间敏感度 × 0.3) + (执行简易度 × 0.15) + (置信度 × 0.15)

Return JSON with:
- score: number (0-100)
- snapshot: current state snapshot
- reasoning: brief explanation`,
      messages: [
        {
          role: 'user',
          content: `Calculate impact score for this execution:
${JSON.stringify(input, null, 2)}`,
        },
      ],
      maxTokens: 1000,
      temperature: 0.3,
    });

    return result.data;
  }

  /**
   * Approve execution
   */
  async approveExecution(id: string, approvedBy: string) {
    const execution = await this.prisma.execution.findUnique({
      where: { id },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status !== 'PENDING') {
      throw new Error('Execution cannot be approved in current status');
    }

    // Update execution status
    const updated = await this.prisma.execution.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        updatedAt: new Date(),
      },
    });

    // Execute the changes
    await this.executeChanges(updated);

    return updated;
  }

  /**
   * Execute changes
   */
  private async executeChanges(execution: any) {
    try {
      // Update status to EXECUTING
      await this.prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'EXECUTING',
          executedAt: new Date(),
        },
      });

      // Execute based on type
      switch (execution.type) {
        case 'PRICE_ADJUSTMENT':
          await this.executePriceAdjustment(execution);
          break;
        case 'PROMOTION':
          await this.executePromotion(execution);
          break;
        case 'MENU_UPDATE':
          await this.executeMenuUpdate(execution);
          break;
        case 'SOCIAL_POST':
          await this.executeSocialPost(execution);
          break;
        case 'REVIEW_REPLY':
          await this.executeReviewReply(execution);
          break;
        case 'INVENTORY_ORDER':
          await this.executeInventoryOrder(execution);
          break;
        default:
          throw new Error(`Unknown execution type: ${execution.type}`);
      }

      // Update status to COMPLETED
      await this.prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date(),
        },
      });

      // Set rollback deadline (5 minutes for price/promotion, 1 minute for social)
      const rollbackMinutes = ['PRICE_ADJUSTMENT', 'PROMOTION'].includes(execution.type) ? 5 : 1;
      const rollbackBefore = new Date(Date.now() + rollbackMinutes * 60 * 1000);

      await this.prisma.execution.update({
        where: { id: execution.id },
        data: { rollbackBefore },
      });

    } catch (error) {
      // Update status to FAILED
      await this.prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Rollback execution
   */
  async rollbackExecution(id: string) {
    const execution = await this.prisma.execution.findUnique({
      where: { id },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status !== 'COMPLETED') {
      throw new Error('Execution cannot be rolled back in current status');
    }

    if (execution.rollbackBefore && new Date() > execution.rollbackBefore) {
      throw new Error('Rollback window has expired');
    }

    // Restore from snapshot
    await this.restoreSnapshot(execution);

    // Update status
    const updated = await this.prisma.execution.update({
      where: { id },
      data: {
        status: 'ROLLED_BACK',
        rolledBackAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Restore from snapshot
   */
  private async restoreSnapshot(execution: any) {
    const snapshot = execution.snapshotBefore;
    const changes = execution.changes;

    // Reverse each change
    for (const change of changes.reverse()) {
      await this.applyChange(change.field, change.oldValue, execution.platform);
    }

    console.log(`[ExecutionService] Rolled back execution ${execution.id}`);
  }

  /**
   * Execution methods for each type
   */
  private async executePriceAdjustment(execution: any) {
    // TODO: Implement price adjustment via platform API
    console.log(`[ExecutionService] Executing price adjustment: ${execution.id}`);
  }

  private async executePromotion(execution: any) {
    // TODO: Implement promotion via platform API
    console.log(`[ExecutionService] Executing promotion: ${execution.id}`);
  }

  private async executeMenuUpdate(execution: any) {
    // TODO: Implement menu update via platform API
    console.log(`[ExecutionService] Executing menu update: ${execution.id}`);
  }

  private async executeSocialPost(execution: any) {
    // TODO: Implement social post via platform API
    console.log(`[ExecutionService] Executing social post: ${execution.id}`);
  }

  private async executeReviewReply(execution: any) {
    // TODO: Implement review reply via platform API
    console.log(`[ExecutionService] Executing review reply: ${execution.id}`);
  }

  private async executeInventoryOrder(execution: any) {
    // TODO: Implement inventory order via supplier API
    console.log(`[ExecutionService] Executing inventory order: ${execution.id}`);
  }

  /**
   * Apply a single change
   */
  private async applyChange(field: string, value: any, platform?: string) {
    // TODO: Implement change application via platform API
    console.log(`[ExecutionService] Applying change: ${field} = ${value}`);
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(tenantId: string, filters?: {
    type?: ExecutionType;
    status?: ExecutionStatus;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { tenantId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const [executions, total] = await Promise.all([
      this.prisma.execution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.execution.count({ where }),
    ]);

    return {
      executions,
      total,
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
    };
  }

  /**
   * Get execution by ID
   */
  async getExecutionById(id: string) {
    const execution = await this.prisma.execution.findUnique({
      where: { id },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    return execution;
  }
}