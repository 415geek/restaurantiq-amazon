import { Controller, Get, Post, Body, Param, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { ExecutionService } from './execution.service';

type ExecutionType = 'PRICE_ADJUSTMENT' | 'PROMOTION' | 'MENU_UPDATE' | 'SOCIAL_POST' | 'REVIEW_REPLY' | 'INVENTORY_ORDER';

@Controller('executions')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  /**
   * Create execution
   */
  @Post()
  async createExecution(
    @Body() body: {
      tenantId: string;
      type: ExecutionType;
      description: string;
      descriptionZh?: string;
      platform?: string;
      targetIds?: any[];
      changes: any[];
    },
  ) {
    if (!body.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    try {
      const execution = await this.executionService.createExecution(body.tenantId, body);
      return { success: true, execution };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to create execution');
    }
  }

  /**
   * Get execution by ID
   */
  @Get(':id')
  async getExecution(@Param('id') id: string) {
    try {
      const execution = await this.executionService.getExecutionById(id);
      return execution;
    } catch (error) {
      throw new NotFoundException('Execution not found');
    }
  }

  /**
   * Approve execution
   */
  @Post(':id/approve')
  async approveExecution(
    @Param('id') id: string,
    @Body() body: { approvedBy: string },
  ) {
    if (!body.approvedBy) {
      throw new BadRequestException('approvedBy is required');
    }

    try {
      const execution = await this.executionService.approveExecution(id, body.approvedBy);
      return { success: true, execution };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to approve execution');
    }
  }

  /**
   * Rollback execution
   */
  @Post(':id/rollback')
  async rollbackExecution(@Param('id') id: string) {
    try {
      const execution = await this.executionService.rollbackExecution(id);
      return { success: true, execution };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to rollback execution');
    }
  }

  /**
   * Get execution history
   */
  @Get('history')
  async getExecutionHistory(
    @Query('tenantId') tenantId: string,
    @Query('type') type?: ExecutionType,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    return await this.executionService.getExecutionHistory(tenantId, {
      type,
      status: status as any,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }
}